using Pgvector;

namespace LLMCache.Api.Models;

public class SnippetEmbedding
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid SnippetId { get; set; }
    public Snippet? Snippet { get; set; }

    public Vector EmbeddingVector { get; set; } = null!;
    public string ModelName { get; set; } = string.Empty;
    public int Dimensions { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
