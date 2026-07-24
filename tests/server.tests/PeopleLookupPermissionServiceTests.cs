using System.Security.Claims;
using FluentAssertions;
using Microsoft.Extensions.Options;
using Server.Models.PeopleLookup;
using Server.Services;

namespace Server.Tests;

public class PeopleLookupPermissionServiceTests
{
    [Fact]
    public void CanSeeSensitiveInfo_WhenIamIdIsConfigured_ReturnsTrue()
    {
        var service = CreateService("1234567890");
        var user = CreateUser(new Claim("ucdPersonIAMID", "1234567890"));

        var result = service.CanSeeSensitiveInfo(user);

        result.Should().BeTrue();
    }

    [Fact]
    public void CanSeeSensitiveInfo_WhenIamIdClaimIsMissing_ReturnsFalse()
    {
        var service = CreateService("1234567890");
        var user = CreateUser(new Claim(ClaimTypes.Email, "user@ucdavis.edu"));

        var result = service.CanSeeSensitiveInfo(user);

        result.Should().BeFalse();
    }

    [Fact]
    public void CanSeeSensitiveInfo_WhenIamIdClaimIsEmpty_ReturnsFalse()
    {
        var service = CreateService("1234567890");
        var user = CreateUser(new Claim("ucdPersonIAMID", string.Empty));

        var result = service.CanSeeSensitiveInfo(user);

        result.Should().BeFalse();
    }

    [Fact]
    public void CanSeeSensitiveInfo_WhenIamIdIsNotConfigured_ReturnsFalse()
    {
        var service = CreateService("9876543210");
        var user = CreateUser(new Claim("ucdPersonIAMID", "1234567890"));

        var result = service.CanSeeSensitiveInfo(user);

        result.Should().BeFalse();
    }

    private static PeopleLookupPermissionService CreateService(string sensitiveInfoUsers)
    {
        return new PeopleLookupPermissionService(Options.Create(new PeopleLookupOptions
        {
            SensitiveInfoUsers = sensitiveInfoUsers,
        }));
    }

    private static ClaimsPrincipal CreateUser(params Claim[] claims)
    {
        return new ClaimsPrincipal(new ClaimsIdentity(claims, "TestAuth"));
    }
}
