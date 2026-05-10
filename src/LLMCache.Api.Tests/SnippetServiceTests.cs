using LLMCache.Api.Data;
using LLMCache.Api.DTOs;
using LLMCache.Api.Models;
using LLMCache.Api.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Moq;

namespace LLMCache.Api.Tests;

public class SnippetServiceTests
{
    private readonly AppDbContext _db;
    private readonly Mock<IEmbeddingService> _embeddingMock;
    private readonly Mock<IUserInfoProfovider> _userInfoProviderMock;
    private readonly SnippetService _service;
    private static readonly Guid TestUserId = Guid.NewGuid();

    public SnippetServiceTests()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        _db = new AppDbContext(options);
        _embeddingMock = new Mock<IEmbeddingService>();
        _embeddingMock.Setup(e => e.GenerateEmbeddingAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
                      .ReturnsAsync(new float[1536]);
        _userInfoProviderMock = new Mock<IUserInfoProfovider>();
        _userInfoProviderMock.Setup(p => p.GetUserInformation())
            .Returns(new UserInformation { UserId = TestUserId });
        var configMock = new Mock<IConfiguration>();
        configMock.Setup(c => c["Embeddings:Model"]).Returns("text-embedding-3-small");
        var logger = Mock.Of<ILogger<SnippetService>>();
        _service = new SnippetService(_db, _embeddingMock.Object, configMock.Object, logger, _userInfoProviderMock.Object);
    }

    [Fact]
    public async Task CreateSnippet_ValidRequest_ReturnsSnippetWithCorrectData()
    {
        var request = new CreateSnippetRequest
        {
            Prompt = "Create a centered flexbox div in CSS",
            Code = ".container {\n  display: flex;\n  justify-content: center;\n  align-items: center;\n}",
            Intent = "Center content using flexbox",
            Constraints = "Pure CSS, no frameworks",
            Environment = new SnippetEnvironmentDto
            {
                Language = "CSS",
                Framework = "none",
                TargetPlatform = "browser"
            },
            Tags = ["css", "flexbox", "centering"]
        };

        var result = await _service.CreateSnippetAsync(request);

        Assert.NotNull(result);
        Assert.Equal(request.Prompt, result.Prompt);
        Assert.Equal(request.Code, result.Code);
        Assert.Equal(5, result.LineCount);
        Assert.Equal(string.Empty, result.Intent);
        Assert.Equal("CSS", result.Environment.Language);
        Assert.Contains("css", result.Tags);
    }

    [Fact]
    public async Task CreateSnippet_SetsLineCount_Correctly()
    {
        var code = string.Join("\n", Enumerable.Range(1, 50).Select(i => $"line {i}"));
        var request = new CreateSnippetRequest
        {
            Prompt = "Test snippet with 50 lines of code",
            Code = code
        };

        var result = await _service.CreateSnippetAsync(request);

        Assert.Equal(50, result.LineCount);
    }

    [Fact]
    public async Task GetSnippet_ExistingId_ReturnsSnippet()
    {
        var request = new CreateSnippetRequest
        {
            Prompt = "Create a simple React button component",
            Code = "const Button = () => <button>Click me</button>;"
        };
        var created = await _service.CreateSnippetAsync(request);

        var retrieved = await _service.GetSnippetAsync(created.Id);

        Assert.NotNull(retrieved);
        Assert.Equal(created.Id, retrieved.Id);
        Assert.Equal(created.Prompt, retrieved.Prompt);
    }

    [Fact]
    public async Task GetSnippet_NonExistentId_ReturnsNull()
    {
        var result = await _service.GetSnippetAsync(Guid.NewGuid());
        Assert.Null(result);
    }

    [Fact]
    public async Task GetUserSnippets_ReturnsOnlyUserSnippets()
    {
        var otherUserId = Guid.NewGuid();
        var req1 = new CreateSnippetRequest { Prompt = "First snippet prompt text", Code = "code1" };
        var req2 = new CreateSnippetRequest { Prompt = "Second snippet prompt text", Code = "code2" };
        var req3 = new CreateSnippetRequest { Prompt = "Third snippet prompt text for other", Code = "code3" };

        _userInfoProviderMock.Setup(p => p.GetUserInformation()).Returns(new UserInformation { UserId = TestUserId });
        await _service.CreateSnippetAsync(req1);
        await _service.CreateSnippetAsync(req2);
        _userInfoProviderMock.Setup(p => p.GetUserInformation()).Returns(new UserInformation { UserId = otherUserId });
        await _service.CreateSnippetAsync(req3);

        _userInfoProviderMock.Setup(p => p.GetUserInformation()).Returns(new UserInformation { UserId = TestUserId });
        var userSnippets = await _service.GetUserSnippetsAsync(1, 20);
        _userInfoProviderMock.Setup(p => p.GetUserInformation()).Returns(new UserInformation { UserId = otherUserId });
        var otherSnippets = await _service.GetUserSnippetsAsync(1, 20);

        Assert.Equal(2, userSnippets.Count);
        Assert.Single(otherSnippets);
    }

    [Fact]
    public async Task DeleteSnippet_OwnedByUser_ReturnsTrue()
    {
        var request = new CreateSnippetRequest
        {
            Prompt = "Snippet to be deleted by owner",
            Code = "delete me"
        };
        var created = await _service.CreateSnippetAsync(request);

        var deleted = await _service.DeleteSnippetAsync(created.Id);
        var retrieved = await _service.GetSnippetAsync(created.Id);

        Assert.True(deleted);
        Assert.Null(retrieved);
    }

    [Fact]
    public async Task DeleteSnippet_NotOwnedByUser_ReturnsFalse()
    {
        var request = new CreateSnippetRequest
        {
            Prompt = "Snippet owned by another user",
            Code = "not yours"
        };
        var created = await _service.CreateSnippetAsync(request);

        _userInfoProviderMock.Setup(p => p.GetUserInformation()).Returns(new UserInformation { UserId = Guid.NewGuid() });
        var deleted = await _service.DeleteSnippetAsync(created.Id);

        Assert.False(deleted);
    }

    [Fact]
    public async Task SnippetEnvironment_AllFieldsPreserved_Correctly()
    {
        var request = new CreateSnippetRequest
        {
            Prompt = "TypeScript strict mode utility function",
            Code = "export const add = (a: number, b: number): number => a + b;",
            Environment = new SnippetEnvironmentDto
            {
                Language = "TypeScript",
                LanguageVersion = "5.0",
                Framework = "None",
                RuntimeVersion = "Node 20",
                StrictMode = true,
                PackageManager = "pnpm",
                KeyDependencies = ["typescript@5", "zod@3"],
                TargetPlatform = "node",
                OperatingSystem = "linux",
                BuildTool = "tsc",
                CustomMetadata = new Dictionary<string, string>
                {
                    { "tsconfig", "strict" },
                    { "moduleResolution", "bundler" }
                }
            }
        };

        var result = await _service.CreateSnippetAsync(request);

        Assert.Equal("TypeScript", result.Environment.Language);
        Assert.Equal("5.0", result.Environment.LanguageVersion);
        Assert.True(result.Environment.StrictMode);
        Assert.Equal("pnpm", result.Environment.PackageManager);
        Assert.Contains("typescript@5", result.Environment.KeyDependencies);
        Assert.Equal("node", result.Environment.TargetPlatform);
        Assert.Equal("tsc", result.Environment.BuildTool);
        Assert.Contains("tsconfig:strict", result.Environment.CustomMetadata);
    }

    [Fact]
    public async Task CreateSnippet_ReusesMatchingEnvironment()
    {
        var request = new CreateSnippetRequest
        {
            Prompt = "Create a typed TypeScript helper function",
            Code = "export const identity = <T>(value: T) => value;",
            Environment = new SnippetEnvironmentDto
            {
                Language = "TypeScript",
                LanguageVersion = "5.0",
                Framework = "None",
                StrictMode = true,
                PackageManager = "pnpm"
            }
        };

        await _service.CreateSnippetAsync(request);
        await _service.CreateSnippetAsync(request);

        Assert.Single(_db.SnippetEnvironments);
        Assert.Single(_db.CodeTypes);
    }

    [Fact]
    public void CreateSnippetRequest_RequiredFields_Validation()
    {
        var request = new CreateSnippetRequest
        {
            Prompt = "short",
            Code = "some code"
        };

        var validationContext = new System.ComponentModel.DataAnnotations.ValidationContext(request);
        var validationResults = new List<System.ComponentModel.DataAnnotations.ValidationResult>();
        System.ComponentModel.DataAnnotations.Validator.TryValidateObject(request, validationContext, validationResults, validateAllProperties: true);

        // Prompt "short" is 5 chars, below MinLength of 10 - should fail validation
        Assert.Contains(validationResults, r => r.MemberNames.Contains("Prompt"));
    }
}
