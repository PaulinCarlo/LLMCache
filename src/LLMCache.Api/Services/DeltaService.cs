using System.Diagnostics;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using LLMCache.Api.DTOs;

namespace LLMCache.Api.Services;

public class DeltaService(
    ISnippetService snippetService,
    IHttpClientFactory httpClientFactory,
    IConfiguration config,
    ILogger<DeltaService> logger) : IDeltaService
{
    private readonly HttpClient _httpClient = httpClientFactory.CreateClient();
    private readonly string _apiKey = config["Delta:ApiKey"] ?? string.Empty;
    private readonly string _model = config["Delta:Model"] ?? "gemini-1.5-flash";
    private readonly string _provider = config["Delta:Provider"] ?? "google";
    private const int SimilarityThreshold = 60;

    public async Task<DeltaResponse> ComputeDeltaAsync(DeltaRequest request, CancellationToken ct = default)
    {
        var sw = Stopwatch.StartNew();

        SnippetResponse? cached;
        double similarityScore;

        if (request.CachedSnippetId.HasValue)
        {
            cached = await snippetService.GetSnippetAsync(request.CachedSnippetId.Value, ct);
            similarityScore = cached is not null ? 1.0 : 0.0;
        }
        else
        {
            var searchResults = await snippetService.SearchSimilarAsync(request.NewPrompt, 1, 0.5, ct);
            if (searchResults.Count == 0)
            {
                return new DeltaResponse
                {
                    CacheStatus = "miss",
                    ConfidenceScore = 0,
                    DiffSummary = "No similar cached snippet found.",
                    ProcessingTimeMs = sw.ElapsedMilliseconds
                };
            }
            cached = searchResults[0].Snippet;
            similarityScore = searchResults[0].SimilarityScore;
        }

        if (cached is null)
        {
            return new DeltaResponse
            {
                CacheStatus = "miss",
                ConfidenceScore = 0,
                DiffSummary = "Requested snippet not found.",
                ProcessingTimeMs = sw.ElapsedMilliseconds
            };
        }

        var deltaAnalysis = await AnalyzeWithLlmAsync(request.NewPrompt, cached, ct);

        sw.Stop();
        return new DeltaResponse
        {
            CacheStatus = deltaAnalysis.ConfidenceScore >= SimilarityThreshold ? "hit" : "partial",
            CachedSnippet = cached,
            ConfidenceScore = deltaAnalysis.ConfidenceScore,
            DiffSummary = deltaAnalysis.DiffSummary,
            AnnotatedPatch = deltaAnalysis.AnnotatedPatch,
            WhatChanges = deltaAnalysis.WhatChanges,
            WhatRemains = deltaAnalysis.WhatRemains,
            ProcessingTimeMs = sw.ElapsedMilliseconds
        };
    }

    private async Task<LlmDeltaAnalysis> AnalyzeWithLlmAsync(
        string newPrompt,
        SnippetResponse cached,
        CancellationToken ct)
    {
        if (string.IsNullOrEmpty(_apiKey))
        {
            logger.LogWarning("No LLM API key for delta analysis, returning basic analysis");
            return BasicAnalysis(newPrompt, cached);
        }

        var systemPrompt = """
            You are a code diff analyzer. Given a cached code snippet and a new prompt, analyze:
            1. How well the cached code addresses the new prompt.
            2. What would need to change.
            3. Generate a unified diff patch.

            Respond ONLY with a valid JSON object in this exact structure:
            {
              "confidence_score": <integer 0-100>,
              "diff_summary": "<one paragraph explaining what the cached code covers vs what's needed>",
              "annotated_patch": "<unified diff format showing required changes>",
              "what_changes": ["<change 1>", "<change 2>"],
              "what_remains": ["<what still applies 1>", "<what still applies 2>"]
            }
            """;

        var userPrompt = $"""
            CACHED PROMPT: {cached.Prompt}

            CACHED CODE:
            ```
            {cached.Code}
            ```

            NEW PROMPT: {newPrompt}

            Analyze how much of the cached code applies and what changes are needed.
            """;

        try
        {
            var rawJson = _provider.ToLowerInvariant() switch
            {
                "google" => await CallGoogleGeminiAsync(systemPrompt, userPrompt, ct),
                "openai" => await CallOpenAiAsync(systemPrompt, userPrompt, ct),
                _ => throw new InvalidOperationException($"Unknown LLM provider: {_provider}")
            };

            return ParseLlmResponse(rawJson) ?? BasicAnalysis(newPrompt, cached);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "LLM delta analysis failed, using fallback");
            return BasicAnalysis(newPrompt, cached);
        }
    }

    private async Task<string> CallGoogleGeminiAsync(string systemPrompt, string userPrompt, CancellationToken ct)
    {
        var url = $"https://generativelanguage.googleapis.com/v1beta/models/{_model}:generateContent?key={_apiKey}";
        var request = new
        {
            system_instruction = new { parts = new[] { new { text = systemPrompt } } },
            contents = new[] { new { role = "user", parts = new[] { new { text = userPrompt } } } },
            generationConfig = new { response_mime_type = "application/json" }
        };

        var response = await _httpClient.PostAsJsonAsync(url, request, ct);
        response.EnsureSuccessStatusCode();

        using var doc = await response.Content.ReadFromJsonAsync<JsonDocument>(cancellationToken: ct);
        return doc?.RootElement
            .GetProperty("candidates")[0]
            .GetProperty("content")
            .GetProperty("parts")[0]
            .GetProperty("text")
            .GetString() ?? "{}";
    }

    private async Task<string> CallOpenAiAsync(string systemPrompt, string userPrompt, CancellationToken ct)
    {
        _httpClient.DefaultRequestHeaders.Authorization =
            new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", _apiKey);

        var request = new
        {
            model = _model,
            messages = new[]
            {
                new { role = "system", content = systemPrompt },
                new { role = "user", content = userPrompt }
            },
            response_format = new { type = "json_object" }
        };

        var response = await _httpClient.PostAsJsonAsync("https://api.openai.com/v1/chat/completions", request, ct);
        response.EnsureSuccessStatusCode();

        using var doc = await response.Content.ReadFromJsonAsync<JsonDocument>(cancellationToken: ct);
        return doc?.RootElement
            .GetProperty("choices")[0]
            .GetProperty("message")
            .GetProperty("content")
            .GetString() ?? "{}";
    }

    private static LlmDeltaAnalysis? ParseLlmResponse(string json)
    {
        try
        {
            using var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;
            return new LlmDeltaAnalysis
            {
                ConfidenceScore = root.TryGetProperty("confidence_score", out var cs) ? cs.GetInt32() : 0,
                DiffSummary = root.TryGetProperty("diff_summary", out var ds) ? ds.GetString() ?? "" : "",
                AnnotatedPatch = root.TryGetProperty("annotated_patch", out var ap) ? ap.GetString() ?? "" : "",
                WhatChanges = root.TryGetProperty("what_changes", out var wc)
                    ? wc.EnumerateArray().Select(e => e.GetString() ?? "").ToList()
                    : [],
                WhatRemains = root.TryGetProperty("what_remains", out var wr)
                    ? wr.EnumerateArray().Select(e => e.GetString() ?? "").ToList()
                    : []
            };
        }
        catch
        {
            return null;
        }
    }

    private static LlmDeltaAnalysis BasicAnalysis(string newPrompt, SnippetResponse cached)
    {
        var newWords = new HashSet<string>(newPrompt.ToLowerInvariant().Split(' ', StringSplitOptions.RemoveEmptyEntries));
        var cachedWords = new HashSet<string>(cached.Prompt.ToLowerInvariant().Split(' ', StringSplitOptions.RemoveEmptyEntries));
        var intersection = newWords.Intersect(cachedWords).Count();
        var union = newWords.Union(cachedWords).Count();
        var jaccardSimilarity = union == 0 ? 0 : (double)intersection / union;
        var confidence = (int)(jaccardSimilarity * 100);

        return new LlmDeltaAnalysis
        {
            ConfidenceScore = confidence,
            DiffSummary = $"Basic similarity analysis (no LLM configured). Estimated {confidence}% overlap between prompts.",
            AnnotatedPatch = "# LLM not configured - manual review required",
            WhatChanges = ["Review and adapt the cached code to match new requirements"],
            WhatRemains = ["Core logic structure may apply"]
        };
    }

    private sealed class LlmDeltaAnalysis
    {
        public int ConfidenceScore { get; set; }
        public string DiffSummary { get; set; } = string.Empty;
        public string AnnotatedPatch { get; set; } = string.Empty;
        public List<string> WhatChanges { get; set; } = [];
        public List<string> WhatRemains { get; set; } = [];
    }
}
