using LLMCache.Api.DTOs;
using LLMCache.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace LLMCache.Api.Controllers;

[ApiController]
[Authorize]
[Route("[controller]")]
[Produces("application/json")]
public class SnippetsController(ISnippetService snippetService, ILogger<SnippetsController> logger) : ControllerBase
{
    /// <summary>Creates a new cached snippet.</summary>
    [HttpPost]
    [ProducesResponseType(typeof(SnippetResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> CreateSnippet(
        [FromBody] CreateSnippetRequest request,
        CancellationToken ct)
    {
        logger.LogInformation("CreateSnippet request received. ");

        if (!ModelState.IsValid)
            return BadRequest(ModelState);

        var lineCount = request.Code.Split('\n', StringSplitOptions.None).Length;
        if (lineCount < 1 || lineCount > 1000)
        {
            ModelState.AddModelError("Code", $"Code must be between 1 and 1000 lines (got {lineCount}).");
            return BadRequest(ModelState);
        }



        var result = await snippetService.CreateSnippetAsync(request, ct);

        logger.LogInformation("Snippet created. SnippetId={SnippetId}", result.Id);

        return CreatedAtAction(nameof(GetSnippet), new { id = result.Id }, result);
    }

    /// <summary>Gets a snippet by ID.</summary>
    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(SnippetResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetSnippet(Guid id, CancellationToken ct)
    {
        logger.LogInformation("GetSnippet request received. SnippetId={SnippetId}", id);
        var result = await snippetService.GetSnippetAsync(id, ct);
        if (result is null)
        {
            logger.LogWarning("Snippet not found. SnippetId={SnippetId}", id);
            return NotFound();
        }
        return Ok(result);
    }

    /// <summary>Lists snippets for the current user.</summary>
    [HttpGet]
    [ProducesResponseType(typeof(List<SnippetResponse>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetSnippets(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken ct = default)
    {
        pageSize = Math.Clamp(pageSize, 1, 100);
        logger.LogInformation("GetSnippets request received. Page={Page} PageSize={PageSize}", page, pageSize);
        var results = await snippetService.GetUserSnippetsAsync(page, pageSize, ct);
        logger.LogInformation("GetSnippets returned {Count} snippets", results.Count);
        return Ok(results);
    }

    /// <summary>Searches for semantically similar snippets.</summary>
    [HttpGet("search")]
    [ProducesResponseType(typeof(List<SearchResult>), StatusCodes.Status200OK)]
    public async Task<IActionResult> SearchSnippets(
        [FromQuery] string prompt,
        [FromQuery] int topK = 5,
        [FromQuery] double minSimilarity = 0.7,
        CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(prompt))
            return BadRequest("Prompt is required");

        topK = Math.Clamp(topK, 1, 20);
        minSimilarity = Math.Clamp(minSimilarity, 0.0, 1.0);

        logger.LogInformation(
            "SearchSnippets request received. PromptLength={PromptLength} TopK={TopK} MinSimilarity={MinSimilarity}",
            prompt.Length,
            topK,
            minSimilarity);

        var results = await snippetService.SearchSimilarAsync(prompt, topK, minSimilarity, ct);

        logger.LogInformation("SearchSnippets returned {Count} results", results.Count);

        return Ok(results);
    }

    /// <summary>Deletes a snippet.</summary>
    [HttpDelete("{id:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DeleteSnippet(Guid id, CancellationToken ct)
    {
        logger.LogInformation("DeleteSnippet request received. SnippetId={SnippetId}", id);
        var deleted = await snippetService.DeleteSnippetAsync(id, ct);
        if (!deleted)
        {
            logger.LogWarning("DeleteSnippet — snippet not found or not owned by user. SnippetId={SnippetId}", id);
            return NotFound();
        }
        logger.LogInformation("Snippet deleted. SnippetId={SnippetId}", id);
        return NoContent();
    }

    /// <summary>Strips newline characters to prevent log-injection attacks.</summary>
    private static string SanitizeForLog(string? value) =>
        (value ?? string.Empty).Replace("\r", "").Replace("\n", "");
}
