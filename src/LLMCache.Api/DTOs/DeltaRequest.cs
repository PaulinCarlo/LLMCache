using System.ComponentModel.DataAnnotations;

namespace LLMCache.Api.DTOs;

public class DeltaRequest
{
    [Required]
    public string NewPrompt { get; set; } = string.Empty;
    public Guid? CachedSnippetId { get; set; }
}
