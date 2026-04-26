using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace LLMCache.Api.Services;

public class EmbeddingService(HttpClient httpClient, IConfiguration config, ILogger<EmbeddingService> logger) : IEmbeddingService
{
    private readonly string _apiKey = config["Embeddings:ApiKey"] ?? string.Empty;
    private readonly string _model = config["Embeddings:Model"] ?? "text-embedding-3-small";
    private readonly string _provider = config["Embeddings:Provider"] ?? "openai";

    public async Task<float[]> GenerateEmbeddingAsync(string text, CancellationToken ct = default)
    {
        if (string.IsNullOrEmpty(_apiKey))
        {
            logger.LogWarning("No embedding API key configured, returning zero vector");
            return new float[1536];
        }

        try
        {
            return _provider.ToLowerInvariant() switch
            {
                "openai" => await GenerateOpenAiEmbeddingAsync(text, ct),
                "google" => await GenerateGoogleEmbeddingAsync(text, ct),
                _ => throw new InvalidOperationException($"Unknown embedding provider: {_provider}")
            };
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to generate embedding for text");
            throw;
        }
    }

    private async Task<float[]> GenerateOpenAiEmbeddingAsync(string text, CancellationToken ct)
    {
        httpClient.DefaultRequestHeaders.Authorization =
            new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", _apiKey);

        var request = new { model = _model, input = text };
        var response = await httpClient.PostAsJsonAsync(
            "https://api.openai.com/v1/embeddings", request, ct);
        response.EnsureSuccessStatusCode();

        var result = await response.Content.ReadFromJsonAsync<OpenAiEmbeddingResponse>(cancellationToken: ct);
        return result?.Data?[0]?.Embedding ?? [];
    }

    private async Task<float[]> GenerateGoogleEmbeddingAsync(string text, CancellationToken ct)
    {
        var url = $"https://generativelanguage.googleapis.com/v1beta/models/{_model}:embedContent?key={_apiKey}";
        var request = new
        {
            model = $"models/{_model}",
            content = new { parts = new[] { new { text } } }
        };

        var response = await httpClient.PostAsJsonAsync(url, request, ct);
        response.EnsureSuccessStatusCode();

        var result = await response.Content.ReadFromJsonAsync<GoogleEmbeddingResponse>(cancellationToken: ct);
        return result?.Embedding?.Values ?? [];
    }

    private sealed class OpenAiEmbeddingResponse
    {
        [JsonPropertyName("data")]
        public List<OpenAiEmbeddingData>? Data { get; set; }
    }

    private sealed class OpenAiEmbeddingData
    {
        [JsonPropertyName("embedding")]
        public float[]? Embedding { get; set; }
    }

    private sealed class GoogleEmbeddingResponse
    {
        [JsonPropertyName("embedding")]
        public GoogleEmbeddingValues? Embedding { get; set; }
    }

    private sealed class GoogleEmbeddingValues
    {
        [JsonPropertyName("values")]
        public float[]? Values { get; set; }
    }
}
