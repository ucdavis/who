using System.Security.Claims;
using Microsoft.Extensions.Options;
using Server.Models.PeopleLookup;

namespace Server.Services;

public interface IPeopleLookupPermissionService
{
    bool CanSeeSensitiveInfo(ClaimsPrincipal user);
}

public class PeopleLookupPermissionService : IPeopleLookupPermissionService
{
    private readonly PeopleLookupOptions _options;

    public PeopleLookupPermissionService(IOptions<PeopleLookupOptions> options)
    {
        _options = options.Value;
    }

    public bool CanSeeSensitiveInfo(ClaimsPrincipal user)
    {
        var iamId = user.FindFirst("ucdPersonIAMID")?.Value;
        if (string.IsNullOrWhiteSpace(iamId))
        {
            return false;
        }

        var allowedUsers = _options.SensitiveInfoUsers
            .Split([',', ';', '\n', '\r'], StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        return allowedUsers.Contains(iamId);
    }
}
