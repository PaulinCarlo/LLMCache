using LLMCache.Api.DTOs;
using LLMCache.Api.Services;
using Microsoft.AspNetCore.Mvc;

namespace LLMCache.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Produces("application/json")]
public class SnippetsController(ISnippetService snippetService, ILogger<SnippetsController> logger) : ControllerBase
{
    private static readonly Guid DefaultUserId = Guid.Parse("00000000-0000-0000-0000-000000000001");

    /// <summary>Creates a new cached snippet.</summary>
    [HttpPost]
    [ProducesResponseType(typeof(SnippetResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> CreateSnippet(
        [FromBody] CreateSnippetRequest request,
        CancellationToken ct)
    {
        if (!ModelState.IsValid)
            return BadRequest(ModelState);

        var lineCount = request.Code.Split('\n').Length;
        if (lineCount < 1 || lineCount > 1000)
        {
            ModelState.AddModelError("Code", $"Code must be between 1 and 1000 lines (got {lineCount}).");
            return BadRequest(ModelState);
        }

        var userId = DefaultUserId;
        var result = await snippetService.CreateSnippetAsync(request, userId, ct);
        return CreatedAtAction(nameof(GetSnippet), new { id = result.Id }, result);
    }

    /// <summary>Gets a snippet by ID.</summary>
    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(SnippetResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetSnippet(Guid id, CancellationToken ct)
    {
        var result = await snippetService.GetSnippetAsync(id, ct);
        return result is null ? NotFound() : Ok(result);
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
        var userId = DefaultUserId;
        var results = await snippetService.GetUserSnippetsAsync(userId, page, pageSize, ct);
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

        var results = await snippetService.SearchSimilarAsync(prompt, topK, minSimilarity, ct);
        return Ok(results);
    }

    /// <summary>Deletes a snippet.</summary>
    [HttpDelete("{id:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DeleteSnippet(Guid id, CancellationToken ct)
    {
        var userId = DefaultUserId;
        var deleted = await snippetService.DeleteSnippetAsync(id, userId, ct);
        return deleted ? NoContent() : NotFound();
    }
}
