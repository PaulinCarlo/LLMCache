using System.ComponentModel.DataAnnotations;

namespace LLMCache.Api.Models;

public class CodeType
{
    public Guid Id { get; set; } = Guid.NewGuid();

    [Required]
    [MaxLength(100)]
    public string Name { get; set; } = string.Empty;

    public List<SnippetEnvironment> SnippetEnvironments { get; set; } = [];
}
