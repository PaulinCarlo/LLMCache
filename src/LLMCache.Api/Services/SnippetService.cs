using LLMCache.Api.Data;
using LLMCache.Api.DTOs;
using LLMCache.Api.Models;
using Microsoft.EntityFrameworkCore;
using Pgvector;
using Pgvector.EntityFrameworkCore;

namespace LLMCache.Api.Services;

public class SnippetService(AppDbContext db, IEmbeddingService embeddingService, IConfiguration config, ILogger<SnippetService> logger) : ISnippetService
{
    private readonly string _embeddingModel = config["Embeddings:Model"] ?? "text-embedding-3-small";
    public async Task<SnippetResponse> CreateSnippetAsync(CreateSnippetRequest request, Guid userId, CancellationToken ct = default)
    {
        var lineCount = request.Code.Split('\n', StringSplitOptions.None).Length;

        logger.LogDebug(
            "Creating snippet for user {UserId}. Language={Language} LineCount={LineCount}",
            userId,
            SanitizeForLog(request.Environment.Language),
            lineCount);

        var snippet = new Snippet
        {
            UserId = userId,
            Prompt = request.Prompt,
            Code = request.Code,
            LineCount = lineCount,
            Intent = request.Intent,
            Constraints = request.Constraints,
            Tags = request.Tags,
            IsPublic = request.IsPublic,
            Environment = new SnippetEnvironment
            {
                Language = request.Environment.Language,
                LanguageVersion = request.Environment.LanguageVersion,
                Framework = request.Environment.Framework,
                FrameworkVersion = request.Environment.FrameworkVersion,
                RuntimeVersion = request.Environment.RuntimeVersion,
                StrictMode = request.Environment.StrictMode,
                PackageManager = request.Environment.PackageManager,
                KeyDependencies = request.Environment.KeyDependencies,
                TargetPlatform = request.Environment.TargetPlatform,
                OperatingSystem = request.Environment.OperatingSystem,
                BuildTool = request.Environment.BuildTool,
                CustomMetadata = request.Environment.CustomMetadata
            }
        };

        db.Snippets.Add(snippet);

        try
        {
            var embeddingText = BuildEmbeddingText(snippet);
            logger.LogDebug("Generating embedding for snippet {SnippetId} using model {Model}", snippet.Id, _embeddingModel);
            var vector = await embeddingService.GenerateEmbeddingAsync(embeddingText, ct);
            var embedding = new SnippetEmbedding
            {
                SnippetId = snippet.Id,
                EmbeddingVector = new Vector(vector),
                ModelName = _embeddingModel,
                Dimensions = vector.Length
            };
            db.SnippetEmbeddings.Add(embedding);
            logger.LogDebug("Embedding generated for snippet {SnippetId}. Dimensions={Dimensions}", snippet.Id, vector.Length);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Could not generate embedding for snippet {SnippetId}, proceeding without it", snippet.Id);
        }

        await db.SaveChangesAsync(ct);
        logger.LogInformation("Snippet {SnippetId} saved for user {UserId}", snippet.Id, userId);
        return MapToResponse(snippet);
    }

    public async Task<SnippetResponse?> GetSnippetAsync(Guid id, CancellationToken ct = default)
    {
        logger.LogDebug("Fetching snippet {SnippetId}", id);
        var snippet = await db.Snippets
            .Include(s => s.Embedding)
            .FirstOrDefaultAsync(s => s.Id == id, ct);
        if (snippet is null)
            logger.LogDebug("Snippet {SnippetId} not found", id);
        return snippet is null ? null : MapToResponse(snippet);
    }

    public async Task<List<SnippetResponse>> GetUserSnippetsAsync(Guid userId, int page, int pageSize, CancellationToken ct = default)
    {
        logger.LogDebug("Listing snippets for user {UserId}. Page={Page} PageSize={PageSize}", userId, page, pageSize);
        var snippets = await db.Snippets
            .Where(s => s.UserId == userId)
            .OrderByDescending(s => s.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);
        logger.LogDebug("Found {Count} snippets for user {UserId}", snippets.Count, userId);
        return snippets.Select(MapToResponse).ToList();
    }

    public async Task<List<SearchResult>> SearchSimilarAsync(string prompt, int topK, double minSimilarity, CancellationToken ct = default)
    {
        logger.LogDebug(
            "Searching similar snippets. TopK={TopK} MinSimilarity={MinSimilarity} PromptLength={PromptLength}",
            topK, minSimilarity, prompt.Length);

        float[] queryVector;
        try
        {
            queryVector = await embeddingService.GenerateEmbeddingAsync(prompt, ct);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to generate embedding for search query");
            return [];
        }

        var pgVector = new Vector(queryVector);

        var results = await db.SnippetEmbeddings
            .Include(e => e.Snippet)
            .OrderBy(e => e.EmbeddingVector.CosineDistance(pgVector))
            // Fetch topK*2 candidates so that enough results remain after filtering by minSimilarity
            .Take(topK * 2)
            .Select(e => new
            {
                Snippet = e.Snippet!,
                Distance = e.EmbeddingVector.CosineDistance(pgVector)
            })
            .ToListAsync(ct);

        var filtered = results
            .Select(r => new SearchResult
            {
                Snippet = MapToResponse(r.Snippet),
                SimilarityScore = 1.0 - (double)r.Distance
            })
            .Where(r => r.SimilarityScore >= minSimilarity)
            .Take(topK)
            .ToList();

        logger.LogDebug(
            "Search completed. Candidates={Candidates} ResultsAfterFilter={Results}",
            results.Count, filtered.Count);

        return filtered;
    }

    public async Task<bool> DeleteSnippetAsync(Guid id, Guid userId, CancellationToken ct = default)
    {
        logger.LogDebug("Deleting snippet {SnippetId} for user {UserId}", id, userId);
        var snippet = await db.Snippets.FirstOrDefaultAsync(s => s.Id == id && s.UserId == userId, ct);
        if (snippet is null)
        {
            logger.LogDebug("Snippet {SnippetId} not found for user {UserId}", id, userId);
            return false;
        }
        db.Snippets.Remove(snippet);
        await db.SaveChangesAsync(ct);
        logger.LogInformation("Snippet {SnippetId} deleted for user {UserId}", id, userId);
        return true;
    }

    private static string BuildEmbeddingText(Snippet snippet)
    {
        var parts = new List<string> { snippet.Prompt };
        if (!string.IsNullOrWhiteSpace(snippet.Intent))
            parts.Add($"Intent: {snippet.Intent}");
        if (!string.IsNullOrWhiteSpace(snippet.Constraints))
            parts.Add($"Constraints: {snippet.Constraints}");
        if (snippet.Environment.Language is not null)
            parts.Add($"Language: {snippet.Environment.Language}");
        if (snippet.Environment.Framework is not null)
            parts.Add($"Framework: {snippet.Environment.Framework}");
        return string.Join(". ", parts);
    }

    private static SnippetResponse MapToResponse(Snippet snippet) => new()
    {
        Id = snippet.Id,
        Prompt = snippet.Prompt,
        Code = snippet.Code,
        LineCount = snippet.LineCount,
        Intent = snippet.Intent,
        Constraints = snippet.Constraints,
        Tags = snippet.Tags,
        IsPublic = snippet.IsPublic,
        CreatedAt = snippet.CreatedAt,
        UpdatedAt = snippet.UpdatedAt,
        Environment = new SnippetEnvironmentDto
        {
            Language = snippet.Environment.Language,
            LanguageVersion = snippet.Environment.LanguageVersion,
            Framework = snippet.Environment.Framework,
            FrameworkVersion = snippet.Environment.FrameworkVersion,
            RuntimeVersion = snippet.Environment.RuntimeVersion,
            StrictMode = snippet.Environment.StrictMode,
            PackageManager = snippet.Environment.PackageManager,
            KeyDependencies = snippet.Environment.KeyDependencies,
            TargetPlatform = snippet.Environment.TargetPlatform,
            OperatingSystem = snippet.Environment.OperatingSystem,
            BuildTool = snippet.Environment.BuildTool,
            CustomMetadata = snippet.Environment.CustomMetadata
        }
    };

    /// <summary>Strips newline characters to prevent log-injection attacks.</summary>
    private static string SanitizeForLog(string? value) =>
        (value ?? string.Empty).Replace("\r", "").Replace("\n", "");
}
