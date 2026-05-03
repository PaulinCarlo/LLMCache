using System.ComponentModel.DataAnnotations;

namespace LLMCache.Api.DTOs;

public record RegisterRequest(
    [Required, EmailAddress, MaxLength(254)] string Email,
    [Required, MinLength(8), MaxLength(128)] string Password,
    [Required, MaxLength(100)] string DisplayName
);

public record LoginRequest(
    [Required, EmailAddress] string Email,
    [Required] string Password
);

public record TokenResponse(
    string AccessToken,
    string TokenType,
    int ExpiresIn,
    string UserId,
    string Email,
    string DisplayName
);

public record ExternalLoginRequest(
    [Required] string Provider   // "google" | "github" | "apple"
);
