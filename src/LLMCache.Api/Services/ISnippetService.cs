using LLMCache.Api.DTOs;

namespace LLMCache.Api.Services;

public interface ISnippetService
{
    Task<SnippetResponse> CreateSnippetAsync(CreateSnippetRequest request, Guid userId, CancellationToken ct = default);
    Task<SnippetResponse?> GetSnippetAsync(Guid id, CancellationToken ct = default);
    Task<List<SnippetResponse>> GetUserSnippetsAsync(Guid userId, int page, int pageSize, CancellationToken ct = default);
    Task<List<SearchResult>> SearchSimilarAsync(string prompt, int topK, double minSimilarity, CancellationToken ct = default);
    Task<bool> DeleteSnippetAsync(Guid id, Guid userId, CancellationToken ct = default);
}
