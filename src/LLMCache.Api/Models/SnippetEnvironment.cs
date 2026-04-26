namespace LLMCache.Api.Models;

public class SnippetEnvironment
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
