using System.Security.Claims;
using FluentAssertions;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Server.Helpers;
using Server.Services;

namespace Server.Tests.Helpers;

public class AuthenticationHelperTests
{
    [Fact]
    public void ValidateGraphClientCredential_throws_when_credential_is_missing()
    {
        var configuration = new ConfigurationBuilder().Build();

        var act = () => AuthenticationHelper.ValidateGraphClientCredential(configuration);

        act.Should()
            .Throw<InvalidOperationException>()
            .WithMessage("*Auth__ClientSecret*");
    }

    [Fact]
    public void ValidateGraphClientCredential_accepts_client_secret()
    {
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Auth:ClientSecret"] = "test-secret"
            })
            .Build();

        var act = () => AuthenticationHelper.ValidateGraphClientCredential(configuration);

        act.Should().NotThrow();
    }

    [Fact]
    public void ValidateGraphClientCredential_accepts_client_credentials_collection()
    {
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Auth:ClientCredentials:0:SourceType"] = "ClientSecret"
            })
            .Build();

        var act = () => AuthenticationHelper.ValidateGraphClientCredential(configuration);

        act.Should().NotThrow();
    }

    [Fact]
    public async Task AddLoginClaimsAsync_adds_iam_id_from_entra_attributes()
    {
        const string userId = "2b6da3fe-fd20-47a3-8d76-9f89c8a667bf";
        const string iamId = "1234567890";

        var services = new ServiceCollection();
        services.AddSingleton<IUserService>(new FakeUserService());
        services.AddSingleton<IEntraUserAttributeService>(
            new FakeEntraUserAttributeService(new EntraUserAttributes(iamId)));

        await using var provider = services.BuildServiceProvider();
        var identity = new ClaimsIdentity(
            [new Claim(ClaimTypes.NameIdentifier, userId)],
            "TestAuth");
        var principal = new ClaimsPrincipal(identity);

        await AuthenticationHelper.AddLoginClaimsAsync(
            provider,
            principal,
            CancellationToken.None);

        principal.FindFirst(AuthenticationHelper.IamIdClaimType)?.Value
            .Should().Be(iamId);
    }

    [Fact]
    public async Task AddLoginClaimsAsync_does_not_add_iam_claim_when_attribute_is_missing()
    {
        var services = new ServiceCollection();
        services.AddSingleton<IUserService>(new FakeUserService());
        services.AddSingleton<IEntraUserAttributeService>(
            new FakeEntraUserAttributeService(new EntraUserAttributes(null)));

        await using var provider = services.BuildServiceProvider();
        var identity = new ClaimsIdentity(
            [new Claim(ClaimTypes.NameIdentifier, "user-id")],
            "TestAuth");
        var principal = new ClaimsPrincipal(identity);

        await AuthenticationHelper.AddLoginClaimsAsync(
            provider,
            principal,
            CancellationToken.None);

        principal.HasClaim(claim => claim.Type == AuthenticationHelper.IamIdClaimType)
            .Should().BeFalse();
    }

    private sealed class FakeUserService : IUserService
    {
        public Task<List<string>> GetRolesForUser(string userId)
        {
            return Task.FromResult(new List<string>());
        }

        public Task<ClaimsPrincipal?> UpdateUserPrincipalIfNeeded(ClaimsPrincipal principal)
        {
            return Task.FromResult<ClaimsPrincipal?>(null);
        }
    }

    private sealed class FakeEntraUserAttributeService : IEntraUserAttributeService
    {
        private readonly EntraUserAttributes? _attributes;

        public FakeEntraUserAttributeService(EntraUserAttributes? attributes)
        {
            _attributes = attributes;
        }

        public Task<EntraUserAttributes?> GetAttributesAsync(
            string userId,
            ClaimsPrincipal principal,
            CancellationToken cancellationToken = default)
        {
            return Task.FromResult(_attributes);
        }
    }
}
