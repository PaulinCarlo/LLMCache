using Microsoft.AspNetCore.Identity;

namespace LLMCache.Api.Models;

/// <summary>
/// Extended Identity user. Add custom profile fields here as needed.
/// Uses Guid as primary key to match existing schema.
/// </summary>
public class ApplicationUser : IdentityUser<Guid>
{
    /// <summary>Display name shown in the UI.</summary>
    public string DisplayName { get; set; } = string.Empty;

    /// <summary>URL of the user's avatar (populated from social logins).</summary>
    public string? ProfilePictureUrl { get; set; }

    /// <summary>Optional organisation identifier for future multi-tenancy support.</summary>
    public string? OrganizationId { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public List<Snippet> Snippets { get; set; } = [];
}
