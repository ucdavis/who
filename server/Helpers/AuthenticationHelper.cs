using System.Security.Claims;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authentication.OpenIdConnect;
using Microsoft.Identity.Web;
using Server.Services;

namespace Server.Helpers;

public static class AuthenticationHelper
{
    internal const string IamIdClaimType = "ucdPersonIAMID";

    /// <summary>
    /// Configures Microsoft Identity Web authentication with Azure AD/Entra ID
    /// </summary>
    public static IServiceCollection AddAuthenticationServices(this IServiceCollection services, IConfiguration configuration)
    {
        ValidateGraphClientCredential(configuration);

        var authBuilder = services
            .AddAuthentication(options =>
            {
                options.DefaultScheme = CookieAuthenticationDefaults.AuthenticationScheme;
                options.DefaultChallengeScheme = OpenIdConnectDefaults.AuthenticationScheme;
            })
            .AddMicrosoftIdentityWebApp(options =>
            {
                configuration.Bind("Auth", options);

                options.Scope.Add("User.Read");

                options.TokenValidationParameters = new()
                {
                    NameClaimType = "name",
                    RoleClaimType = ClaimTypes.Role
                };

                options.Events ??= new OpenIdConnectEvents();
                options.Events.OnRedirectToIdentityProvider = OnRedirectToIdentityProvider;
                options.Events.OnTokenValidated = OnTokenValidated;
            });

        authBuilder
            .EnableTokenAcquisitionToCallDownstreamApi(initialScopes: EntraUserAttributeService.RequiredScopes)
            .AddInMemoryTokenCaches();

        services.PostConfigure<CookieAuthenticationOptions>(CookieAuthenticationDefaults.AuthenticationScheme, options =>
        {
            options.Events = new CookieAuthenticationEvents
            {
                OnValidatePrincipal = OnValidatePrincipal,
                OnRedirectToAccessDenied = ctx =>
                {
                    // If the request is for an API endpoint, don't redirect to the access denied page
                    if (ctx.Request.Path.StartsWithSegments("/api"))
                    {
                        ctx.Response.StatusCode = StatusCodes.Status403Forbidden;
                    }
                    return Task.CompletedTask;
                }
            };
        });

        return services;
    }

    internal static void ValidateGraphClientCredential(IConfiguration configuration)
    {
        var authSection = configuration.GetSection("Auth");
        var hasClientSecret = !string.IsNullOrWhiteSpace(authSection["ClientSecret"]);
        var hasClientCredentials = authSection
            .GetSection("ClientCredentials")
            .GetChildren()
            .Any();
        var hasClientCertificates = authSection
            .GetSection("ClientCertificates")
            .GetChildren()
            .Any();

        if (!hasClientSecret && !hasClientCredentials && !hasClientCertificates)
        {
            throw new InvalidOperationException(
                "Microsoft Graph login enrichment requires an Entra client credential. " +
                "Set Auth__ClientSecret for local development, or configure Auth:ClientCredentials for production.");
        }
    }

    /// <summary>
    /// Handles redirect to identity provider - prevents API endpoints from redirecting to login page
    /// </summary>
    private static Task OnRedirectToIdentityProvider(Microsoft.AspNetCore.Authentication.OpenIdConnect.RedirectContext ctx)
    {
        // If the request is for an API endpoint, don't redirect to the login page
        if (ctx.Request.Path.StartsWithSegments("/api"))
        {
            ctx.Response.StatusCode = 401;
            ctx.HandleResponse();
            return Task.CompletedTask;
        }

        // Set domain hint for UC Davis
        ctx.ProtocolMessage.DomainHint = "ucdavis.edu";

        return Task.CompletedTask;
    }

    /// <summary>
    /// Handles token validation - loads user roles on first login
    /// </summary>
    private static async Task OnTokenValidated(Microsoft.AspNetCore.Authentication.OpenIdConnect.TokenValidatedContext ctx)
    {
        var principal = ctx.Principal;
        if (principal == null)
        {
            return;
        }

        await AddLoginClaimsAsync(
            ctx.HttpContext.RequestServices,
            principal,
            ctx.HttpContext.RequestAborted);
    }

    internal static async Task AddLoginClaimsAsync(
        IServiceProvider services,
        ClaimsPrincipal principal,
        CancellationToken cancellationToken)
    {
        var userId = principal.FindFirst(ClaimTypes.NameIdentifier)?.Value;

        if (string.IsNullOrEmpty(userId))
        {
            return;
        }

        var userService = services.GetRequiredService<IUserService>();
        var roles = await userService.GetRolesForUser(userId);

        var identity = (ClaimsIdentity)principal.Identity!;
        foreach (var role in roles)
        {
            identity.AddClaim(new Claim(ClaimTypes.Role, role));
        }

        var attributeService = services.GetRequiredService<IEntraUserAttributeService>();
        var attributes = await attributeService.GetAttributesAsync(
            userId,
            principal,
            cancellationToken);

        if (!string.IsNullOrWhiteSpace(attributes?.IamId) &&
            !identity.HasClaim(claim => claim.Type == IamIdClaimType))
        {
            identity.AddClaim(new Claim(IamIdClaimType, attributes.IamId));
        }
    }

    /// <summary>
    /// Validates cookie principal on every request - updates user roles/claims if needed
    /// </summary>
    private static async Task OnValidatePrincipal(Microsoft.AspNetCore.Authentication.Cookies.CookieValidatePrincipalContext ctx)
    {
        // On every request with a cookie, check if the user's roles/claims need updating
        // We could use a cache here or roleVersion or timestamp or something, but for simplicity we'll just hit the DB every time
        var userService = ctx.HttpContext.RequestServices.GetRequiredService<IUserService>();
        var updated = await userService.UpdateUserPrincipalIfNeeded(ctx.Principal!);

        if (updated != null)
        {
            ctx.ReplacePrincipal(updated);
            ctx.ShouldRenew = true; // Renew the cookie with the new principal
        }
    }
}
