namespace LLMCache.Api.DTOs;

public class DeltaResponse
{
    public string CacheStatus { get; set; } = "miss";
    public SnippetResponse? CachedSnippet { get; set; }
    public int ConfidenceScore { get; set; }
    public string DiffSummary { get; set; } = string.Empty;
    public string AnnotatedPatch { get; set; } = string.Empty;
    public List<string> WhatChanges { get; set; } = [];
    public List<string> WhatRemains { get; set; } = [];
    public long ProcessingTimeMs { get; set; }
}
