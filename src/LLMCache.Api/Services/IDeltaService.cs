using LLMCache.Api.DTOs;

namespace LLMCache.Api.Services;

public interface IDeltaService
{
    Task<DeltaResponse> ComputeDeltaAsync(DeltaRequest request, CancellationToken ct = default);
}
