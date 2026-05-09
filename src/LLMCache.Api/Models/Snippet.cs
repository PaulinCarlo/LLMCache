using System.ComponentModel.DataAnnotations;

namespace LLMCache.Api.Models;

public class Snippet
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid UserId { get; set; }
    public ApplicationUser? User { get; set; }

    [Required]
    [MaxLength(2000)]
    public string Prompt { get; set; } = string.Empty;

    [Required]
    public string Code { get; set; } = string.Empty;

    public int LineCount { get; set; }

    [MaxLength(1000)]
    public string Intent { get; set; } = string.Empty;

    [MaxLength(2000)]
    public string Constraints { get; set; } = string.Empty;

    public Guid EnvironmentId { get; set; }
    public SnippetEnvironment Environment { get; set; } = null!;

    public List<string> Tags { get; set; } = [];

    public bool IsPublic { get; set; } = false;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public SnippetEmbedding? Embedding { get; set; }
}
