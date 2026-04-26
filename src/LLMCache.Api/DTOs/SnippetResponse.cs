namespace LLMCache.Api.DTOs;

public class SnippetResponse
{
    public Guid Id { get; set; }
    public string Prompt { get; set; } = string.Empty;
    public string Code { get; set; } = string.Empty;
    public int LineCount { get; set; }
    public string Intent { get; set; } = string.Empty;
    public string Constraints { get; set; } = string.Empty;
    public SnippetEnvironmentDto Environment { get; set; } = new();
    public List<string> Tags { get; set; } = [];
    public bool IsPublic { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

public class SearchResult
{
    public SnippetResponse Snippet { get; set; } = null!;
    public double SimilarityScore { get; set; }
}
