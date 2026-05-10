using LLMCache.Api.Models;

namespace LLMCache.Api.Services;

public interface IUserInfoProfovider
{
    UserInformation GetUserInformation();
}
