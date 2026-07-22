using System.Security.Claims;
using Microsoft.Extensions.Options;
using Server.Helpers;
using Server.Models.PeopleLookup;

namespace Server.Services;

public interface IPeopleLookupPermissionService
{
    bool CanSeeSensitiveInfo(ClaimsPrincipal? user);
}

public class PeopleLookupPermissionService : IPeopleLookupPermissionService
{
    private readonly PeopleLookupOptions _options;

    public PeopleLookupPermissionService(IOptions<PeopleLookupOptions> options)
    {
        _options = options.Value;
    }

    public bool CanSeeSensitiveInfo(ClaimsPrincipal? user)
    {
        if (user == null)
        {
            return false;
        }

        var iamId = user.FindFirst(AuthenticationHelper.IamIdClaimType)?.Value?.Trim();
        if (string.IsNullOrWhiteSpace(iamId))
        {
            return false;
        }

        var allowedIamIds = (_options.SensitiveInfoUsers ?? string.Empty)
            .Split([',', ';', '\n', '\r'], StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        return allowedIamIds.Contains(iamId);
    }
}
