using System.ComponentModel.DataAnnotations;

namespace LLMCache.Api.DTOs;

public class CreateSnippetRequest
{
    [Required]
    [MinLength(10, ErrorMessage = "Prompt must be at least 10 characters")]
    [MaxLength(2000)]
    public string Prompt { get; set; } = string.Empty;

    [Required]
    [MinLength(1)]
    public string Code { get; set; } = string.Empty;

    [MaxLength(1000)]
    public string Intent { get; set; } = string.Empty;

    [MaxLength(2000)]
    public string Constraints { get; set; } = string.Empty;

    public SnippetEnvironmentDto Environment { get; set; } = new();

    public List<string> Tags { get; set; } = [];

    public bool IsPublic { get; set; } = false;
}

public class SnippetEnvironmentDto
{
    public string? Language { get; set; }
    public string? LanguageVersion { get; set; }
    public string? Framework { get; set; }
    public string? FrameworkVersion { get; set; }
    public string? RuntimeVersion { get; set; }
    public bool? StrictMode { get; set; }
    public string? PackageManager { get; set; }
    public List<string> KeyDependencies { get; set; } = [];
    public string? TargetPlatform { get; set; }
    public string? OperatingSystem { get; set; }
    public string? BuildTool { get; set; }
    public Dictionary<string, string> CustomMetadata { get; set; } = [];
}
