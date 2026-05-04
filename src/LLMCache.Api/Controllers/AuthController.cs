using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using LLMCache.Api.DTOs;
using LLMCache.Api.Models;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.IdentityModel.Tokens;

namespace LLMCache.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Produces("application/json")]
public class AuthController(
    UserManager<ApplicationUser> userManager,
    SignInManager<ApplicationUser> signInManager,
    IConfiguration configuration,
    ILogger<AuthController> logger) : ControllerBase
{
    // ──────────────────────────────────────────────────────────
    // Email / Password
    // ──────────────────────────────────────────────────────────

    /// <summary>Registers a new user with email and password.</summary>
    [HttpPost("register")]
    [ProducesResponseType(typeof(TokenResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Register([FromBody] RegisterRequest request)
    {
        if (!ModelState.IsValid)
            return BadRequest(ModelState);

        var user = new ApplicationUser
        {
            UserName = request.Email,
            Email = request.Email,
            DisplayName = request.DisplayName,
            EmailConfirmed = true  // set to false and send confirmation email when email is enabled
        };

        var result = await userManager.CreateAsync(user, request.Password);
        if (!result.Succeeded)
        {
            foreach (var error in result.Errors)
                ModelState.AddModelError(error.Code, error.Description);
            return BadRequest(ModelState);
        }

        // Add default claims
        await userManager.AddClaimAsync(user, new Claim("permission", "snippets:read"));
        await userManager.AddClaimAsync(user, new Claim("permission", "snippets:write"));

        // ──────────────────────────────────────────────────────
        // EMAIL CONFIRMATION — uncomment when ready for production
        // ──────────────────────────────────────────────────────
        // var token = await userManager.GenerateEmailConfirmationTokenAsync(user);
        // var confirmUrl = Url.Action("ConfirmEmail", "Auth",
        //     new { userId = user.Id, token }, Request.Scheme);
        // await emailSender.SendEmailAsync(user.Email, "Confirm your account", $"<a href='{confirmUrl}'>Click here to confirm</a>");
        // return Ok(new { message = "Registration successful. Please confirm your email." });
        // ──────────────────────────────────────────────────────

        logger.LogInformation("New user registered: {Email}", SanitizeForLog(user.Email));
        var tokenResponse = await BuildTokenAsync(user);
        return CreatedAtAction(nameof(Register), tokenResponse);
    }

    /// <summary>Authenticates a user with email and password, returning a JWT.</summary>
    [HttpPost("login")]
    [ProducesResponseType(typeof(TokenResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> Login([FromBody] LoginRequest request)
    {
        if (!ModelState.IsValid)
            return BadRequest(ModelState);

        var user = await userManager.FindByEmailAsync(request.Email);
        if (user is null)
            return Unauthorized(new { message = "Invalid credentials." });

        // ──────────────────────────────────────────────────────
        // EMAIL CONFIRMATION CHECK — uncomment when ready for production
        // ──────────────────────────────────────────────────────
        // if (!user.EmailConfirmed)
        //     return Unauthorized(new { message = "Please confirm your email before logging in." });
        // ──────────────────────────────────────────────────────

        var result = await signInManager.CheckPasswordSignInAsync(user, request.Password, lockoutOnFailure: true);
        if (!result.Succeeded)
        {
            if (result.IsLockedOut)
                return Unauthorized(new { message = "Account locked. Try again later." });
            return Unauthorized(new { message = "Invalid credentials." });
        }

        logger.LogInformation("User logged in: {Email}", SanitizeForLog(user.Email));
        return Ok(await BuildTokenAsync(user));
    }

    // ──────────────────────────────────────────────────────────
    // Social / OAuth logins
    // ──────────────────────────────────────────────────────────

    /// <summary>Initiates an OAuth redirect to the specified social provider.</summary>
    /// <param name="provider">One of: google, github, apple</param>
    /// <param name="returnUrl">Frontend URL to redirect to after login.</param>
    [HttpGet("external-login")]
    [ProducesResponseType(StatusCodes.Status302Found)]
    public IActionResult ExternalLogin([FromQuery] string provider, [FromQuery] string? returnUrl = null)
    {
        var redirectUrl = Url.Action(nameof(ExternalLoginCallback), "Auth", new { returnUrl });
        var properties = signInManager.ConfigureExternalAuthenticationProperties(provider, redirectUrl);
        return Challenge(properties, provider);
    }

    /// <summary>OAuth callback — exchanges the code for a JWT and redirects to the frontend.</summary>
    [HttpGet("external-callback")]
    public async Task<IActionResult> ExternalLoginCallback([FromQuery] string? returnUrl = null)
    {
        var info = await signInManager.GetExternalLoginInfoAsync();
        if (info is null)
        {
            logger.LogWarning("External login info not available.");
            return Redirect(BuildFrontendUrl(returnUrl, error: "external_login_failed"));
        }

        // Try to sign in with existing external login
        var result = await signInManager.ExternalLoginSignInAsync(
            info.LoginProvider, info.ProviderKey, isPersistent: false, bypassTwoFactor: true);

        ApplicationUser user;
        if (result.Succeeded)
        {
            user = (await userManager.FindByLoginAsync(info.LoginProvider, info.ProviderKey))!;
        }
        else
        {
            // Create a new account linked to this external provider
            var email = info.Principal.FindFirstValue(ClaimTypes.Email);
            if (string.IsNullOrEmpty(email))
                return Redirect(BuildFrontendUrl(returnUrl, error: "no_email_from_provider"));

            user = await userManager.FindByEmailAsync(email) ?? new ApplicationUser
            {
                UserName = email,
                Email = email,
                EmailConfirmed = true,
                DisplayName = info.Principal.FindFirstValue(ClaimTypes.Name) ?? email,
                ProfilePictureUrl = info.Principal.FindFirstValue("picture")
                                 ?? info.Principal.FindFirstValue("avatar_url")
            };

            if (user.Id == Guid.Empty)
            {
                var createResult = await userManager.CreateAsync(user);
                if (!createResult.Succeeded)
                    return Redirect(BuildFrontendUrl(returnUrl, error: "create_user_failed"));

                await userManager.AddClaimAsync(user, new Claim("permission", "snippets:read"));
                await userManager.AddClaimAsync(user, new Claim("permission", "snippets:write"));
            }

            await userManager.AddLoginAsync(user, info);
        }

        logger.LogInformation("User logged in via {Provider}: {Email}", info.LoginProvider, SanitizeForLog(user.Email));
        var token = await BuildTokenAsync(user);
        var redirectTarget = BuildFrontendUrl(returnUrl, accessToken: token.AccessToken);
        return Redirect(redirectTarget);
    }

    // ──────────────────────────────────────────────────────────
    // Helpers
    // ──────────────────────────────────────────────────────────

    private async Task<TokenResponse> BuildTokenAsync(ApplicationUser user)
    {
        var jwtSettings = configuration.GetSection("Jwt");
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSettings["Key"]!));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
        var expiresIn = int.Parse(jwtSettings["ExpiresInSeconds"] ?? "3600");

        var userClaims = await userManager.GetClaimsAsync(user);

        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
            new(JwtRegisteredClaimNames.Email, user.Email!),
            new(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()),
            new("display_name", user.DisplayName)
        };
        claims.AddRange(userClaims);

        var tokenDescriptor = new JwtSecurityToken(
            issuer: jwtSettings["Issuer"],
            audience: jwtSettings["Audience"],
            claims: claims,
            expires: DateTime.UtcNow.AddSeconds(expiresIn),
            signingCredentials: creds);

        var accessToken = new JwtSecurityTokenHandler().WriteToken(tokenDescriptor);

        return new TokenResponse(
            AccessToken: accessToken,
            TokenType: "Bearer",
            ExpiresIn: expiresIn,
            UserId: user.Id.ToString(),
            Email: user.Email!,
            DisplayName: user.DisplayName);
    }

    /// <summary>
    /// Validates that <paramref name="returnUrl"/> belongs to a configured allowed origin.
    /// Returns the frontend base URL if validation fails.
    /// Wildcard origins (e.g. chrome-extension://*) are excluded from redirect validation.
    /// </summary>
    private string ValidateReturnUrl(string? returnUrl)
    {
        var frontendBase = configuration["FrontendUrl"] ?? "http://localhost:3000";

        if (string.IsNullOrEmpty(returnUrl))
            return $"{frontendBase}/login.html";

        if (!Uri.TryCreate(returnUrl, UriKind.Absolute, out var uri))
            return $"{frontendBase}/login.html";

        var returnOrigin = $"{uri.Scheme}://{uri.Authority}";

        // Exclude wildcard patterns (e.g. "chrome-extension://*") — they are valid for CORS
        // headers but cannot be used for safe redirect matching.
        var allowedOrigins = (configuration.GetSection("AllowedOrigins").Get<string[]>()
                              ?? ["http://localhost:3000", "http://localhost:5173"])
            .Where(o => !o.Contains('*'))
            .ToArray();

        if (allowedOrigins.Any(o => o.Equals(returnOrigin, StringComparison.OrdinalIgnoreCase)))
            return returnUrl;

        logger.LogWarning("Rejected unrecognised returnUrl origin: {Origin}", returnOrigin);
        return $"{frontendBase}/login.html";
    }

    private string BuildFrontendUrl(string? returnUrl, string? accessToken = null, string? error = null)
    {
        var target = ValidateReturnUrl(returnUrl);

        if (!string.IsNullOrEmpty(accessToken))
            target += $"?access_token={Uri.EscapeDataString(accessToken)}";
        else if (!string.IsNullOrEmpty(error))
            target += $"?error={Uri.EscapeDataString(error)}";

        return target;
    }

    /// <summary>Strips newline characters to prevent log-injection attacks.</summary>
    private static string SanitizeForLog(string? value) =>
        (value ?? string.Empty).Replace("\r", "").Replace("\n", "");
}
