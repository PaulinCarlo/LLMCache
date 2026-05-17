namespace LLMCache.Api.Configuration;

public class EmbeddingsConfig
{
    public string Provider { get; set; } = string.Empty;
    public string Model { get; set; } = string.Empty;
    public string ApiKey { get; set; } = string.Empty;
}   