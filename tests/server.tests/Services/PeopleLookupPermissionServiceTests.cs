using System.Security.Claims;
using FluentAssertions;
using Microsoft.Extensions.Options;
using Server.Helpers;
using Server.Models.PeopleLookup;
using Server.Services;

namespace Server.Tests.Services;

public class PeopleLookupPermissionServiceTests
{
    [Fact]
    public void CanSeeSensitiveInfo_returns_true_for_allowed_iam_id()
    {
        var service = CreateService("1111111111; 2222222222");
        var user = CreatePrincipal(
            new Claim(AuthenticationHelper.IamIdClaimType, " 2222222222 "));

        var result = service.CanSeeSensitiveInfo(user);

        result.Should().BeTrue();
    }

    [Fact]
    public void CanSeeSensitiveInfo_ignores_non_iam_identifiers()
    {
        var service = CreateService("person@ucdavis.edu");
        var user = CreatePrincipal(
            new Claim(ClaimTypes.Email, "person@ucdavis.edu"),
            new Claim(ClaimTypes.NameIdentifier, "person@ucdavis.edu"));

        var result = service.CanSeeSensitiveInfo(user);

        result.Should().BeFalse();
    }

    [Fact]
    public void CanSeeSensitiveInfo_returns_false_for_null_principal()
    {
        var service = CreateService("2222222222");

        var result = service.CanSeeSensitiveInfo(null);

        result.Should().BeFalse();
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData(" ; , ")]
    public void CanSeeSensitiveInfo_returns_false_for_missing_allowlist(string? allowedIamIds)
    {
        var service = CreateService(allowedIamIds);
        var user = CreatePrincipal(
            new Claim(AuthenticationHelper.IamIdClaimType, "2222222222"));

        var result = service.CanSeeSensitiveInfo(user);

        result.Should().BeFalse();
    }

    [Fact]
    public void CanSeeSensitiveInfo_returns_false_for_blank_iam_claim()
    {
        var service = CreateService("2222222222");
        var user = CreatePrincipal(
            new Claim(AuthenticationHelper.IamIdClaimType, " "));

        var result = service.CanSeeSensitiveInfo(user);

        result.Should().BeFalse();
    }

    private static PeopleLookupPermissionService CreateService(string? allowedIamIds)
    {
        var options = Options.Create(new PeopleLookupOptions
        {
            SensitiveInfoUsers = allowedIamIds!
        });

        return new PeopleLookupPermissionService(options);
    }

    private static ClaimsPrincipal CreatePrincipal(params Claim[] claims)
    {
        return new ClaimsPrincipal(new ClaimsIdentity(claims, "TestAuth"));
    }
}
