using LLMCache.Api.DTOs;
using LLMCache.Api.Services;
using Microsoft.AspNetCore.Mvc;

namespace LLMCache.Api.Controllers;

[ApiController]
[Route("[controller]")]
[Produces("application/json")]
public class DeltaController(IDeltaService deltaService, ILogger<DeltaController> logger) : ControllerBase
{
    /// <summary>
    /// Computes the delta between a new prompt and the best cached snippet.
    /// Returns confidence score, diff summary, and annotated patch.
    /// </summary>
    [HttpPost]
    [ProducesResponseType(typeof(DeltaResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> ComputeDelta(
        [FromBody] DeltaRequest request,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.NewPrompt))
            return BadRequest("NewPrompt is required");

        logger.LogInformation(
            "ComputeDelta request received. HasCachedSnippetId={HasCachedSnippetId} PromptLength={PromptLength}",
            request.CachedSnippetId.HasValue,
            request.NewPrompt.Length);

        var result = await deltaService.ComputeDeltaAsync(request, ct);

        return Ok(result);
    }
}
