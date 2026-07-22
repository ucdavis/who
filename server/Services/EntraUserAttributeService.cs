using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Security.Claims;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Authentication.OpenIdConnect;
using Microsoft.Identity.Web;

namespace Server.Services;

public interface IEntraUserAttributeService
{
    Task<EntraUserAttributes?> GetAttributesAsync(
        string userId,
        ClaimsPrincipal principal,
        CancellationToken cancellationToken = default);
}

public record EntraUserAttributes(string? IamId);

public class EntraUserAttributeService : IEntraUserAttributeService
{
    internal static readonly string[] RequiredScopes = ["User.Read"];

    private readonly HttpClient _graphClient;
    private readonly ITokenAcquisition _tokenAcquisition;
    private readonly ILogger<EntraUserAttributeService> _logger;

    public EntraUserAttributeService(
        HttpClient graphClient,
        ITokenAcquisition tokenAcquisition,
        ILogger<EntraUserAttributeService> logger)
    {
        _graphClient = graphClient;
        _tokenAcquisition = tokenAcquisition;
        _logger = logger;
    }

    public async Task<EntraUserAttributes?> GetAttributesAsync(
        string userId,
        ClaimsPrincipal principal,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(userId))
        {
            _logger.LogWarning("Skipping attribute lookup because the user ID was empty.");
            return null;
        }

        try
        {
            var tokenOptions = new TokenAcquisitionOptions
            {
                CancellationToken = cancellationToken
            };

            var accessToken = await _tokenAcquisition.GetAccessTokenForUserAsync(
                RequiredScopes,
                authenticationScheme: OpenIdConnectDefaults.AuthenticationScheme,
                user: principal,
                tokenAcquisitionOptions: tokenOptions);

            using var request = new HttpRequestMessage(
                HttpMethod.Get,
                "me?$select=onPremisesExtensionAttributes");
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);

            using var response = await _graphClient.SendAsync(request, cancellationToken);
            response.EnsureSuccessStatusCode();

            var user = await response.Content.ReadFromJsonAsync<GraphUserResponse>(
                cancellationToken);
            var iamId = user?.OnPremisesExtensionAttributes?.ExtensionAttribute7;

            if (string.IsNullOrWhiteSpace(iamId))
            {
                _logger.LogInformation(
                    "No IAM extension attribute returned for the signed-in user");
                return null;
            }

            return new EntraUserAttributes(iamId);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(
                ex,
                "Failed to retrieve extension attributes for the signed-in user");
            return null;
        }
    }

    private sealed class GraphUserResponse
    {
        [JsonPropertyName("onPremisesExtensionAttributes")]
        public OnPremisesExtensionAttributes? OnPremisesExtensionAttributes { get; init; }
    }

    private sealed class OnPremisesExtensionAttributes
    {
        [JsonPropertyName("extensionAttribute7")]
        public string? ExtensionAttribute7 { get; init; }
    }
}
