using System.ComponentModel.DataAnnotations;

namespace LLMCache.Api.Models;

public class SnippetEnvironment
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid? CodeTypeId { get; set; }
    public CodeType? CodeType { get; set; }

    [MaxLength(100)]
    public string? LanguageVersion { get; set; }

    [MaxLength(100)]
    public string? Framework { get; set; }

    [MaxLength(100)]
    public string? FrameworkVersion { get; set; }

    [MaxLength(100)]
    public string? RuntimeVersion { get; set; }

    public bool? StrictMode { get; set; }

    [MaxLength(100)]
    public string? PackageManager { get; set; }

    public List<string> KeyDependencies { get; set; } = [];

    [MaxLength(100)]
    public string? TargetPlatform { get; set; }

    [MaxLength(100)]
    public string? OperatingSystem { get; set; }

    [MaxLength(100)]
    public string? BuildTool { get; set; }

    public Dictionary<string, string> CustomMetadata { get; set; } = [];

    public List<Snippet> Snippets { get; set; } = [];
}
