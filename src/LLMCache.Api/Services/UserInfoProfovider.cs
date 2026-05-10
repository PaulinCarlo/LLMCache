using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using LLMCache.Api.Models;

namespace LLMCache.Api.Services;

public class UserInfoProfovider(IHttpContextAccessor httpContextAccessor) : IUserInfoProfovider
{
    public UserInformation GetUserInformation()
    {
        var user = httpContextAccessor.HttpContext?.User;
        if (user?.Identity?.IsAuthenticated != true)
        {
            throw new UnauthorizedAccessException("No authenticated user was found.");
        }

        var userIdValue =
            user.FindFirstValue(JwtRegisteredClaimNames.Sub) ??
            user.FindFirstValue(ClaimTypes.NameIdentifier);

        if (string.IsNullOrWhiteSpace(userIdValue) || !Guid.TryParse(userIdValue, out var userId))
        {
            throw new UnauthorizedAccessException("No valid user id was found in the bearer token.");
        }

        return new UserInformation
        {
            UserId = userId
        };
    }
}
