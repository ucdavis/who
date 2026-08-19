using Ietws;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.Mvc;
using Microsoft.OpenApi.Any;
using Microsoft.OpenApi.Models;
using Server.Helpers;
using Server.Models.PeopleLookup;
using Server.Services;
using Server.Swagger;
using UCD.Rosetta.Client.Core.Extensions;

WebApplication? app = null;

try
{
    var builder = WebApplication.CreateBuilder(args);

    // setup configuration sources (last one wins)
    builder.Configuration
        .AddJsonFile("appsettings.json", optional: false, reloadOnChange: true)
        .AddJsonFile($"appsettings.{builder.Environment.EnvironmentName}.json", optional: true, reloadOnChange: true)
        .AddEnvFile(".env", optional: true) // secrets stored here
        .AddEnvFile($".env.{builder.Environment.EnvironmentName}", optional: true) // env-specific secrets
        .AddEnvironmentVariables(); // OS env vars override everything

    // setup logging and telemetry
    TelemetryHelper.ConfigureLogging(builder.Logging);
    TelemetryHelper.ConfigureOpenTelemetry(builder.Services);

    // handy for getting true client IP
    builder.Services.Configure<ForwardedHeadersOptions>(o =>
    {
        o.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
    });

    // Add auth config (entra)
    builder.Services.AddAuthenticationServices(builder.Configuration);

    builder.Services.AddControllers();
    builder.Services.Configure<PeopleLookupOptions>(builder.Configuration.GetSection(PeopleLookupOptions.SectionName));
    builder.Services.AddHttpClient("identity", client =>
        {
            client.Timeout = TimeSpan.FromSeconds(30);
        })
        .ConfigurePrimaryHttpMessageHandler(() => new SocketsHttpHandler
        {
            PooledConnectionLifetime = TimeSpan.FromMinutes(2),
            PooledConnectionIdleTimeout = TimeSpan.FromMinutes(1),
            MaxConnectionsPerServer = 10
        });

    // Add response caching for pages that opt-in
    // https://learn.microsoft.com/en-us/aspnet/core/performance/caching/middleware?view=aspnetcore-9.0
    builder.Services.AddResponseCaching();

    // add scoped services here
    builder.Services.AddScoped<IUserService, UserService>();
    var useRosettaLookup = builder.Configuration.GetValue<bool>("UseRosettaLookup");
    if (useRosettaLookup)
    {
        builder.Services.AddRosettaClientWithFactory(options =>
            builder.Configuration.GetSection("RosettaClient").Bind(options));
        builder.Services.AddScoped<IIdentityLookupService, RosettaIdentityLookupService>();
    }
    else
    {
        builder.Services.AddScoped<IIdentityLookupService, IdentityLookupService>();
    }
    builder.Services.AddScoped<IPeopleLookupPermissionService, PeopleLookupPermissionService>();
    // add auth policies here

    builder.Services.AddHealthChecks();

    // Learn more about configuring Swagger/OpenAPI at https://aka.ms/aspnetcore/swashbuckle
    builder.Services.AddEndpointsApiExplorer();
    builder.Services.AddSwaggerGen(c =>
    {
        c.SwaggerDoc("v1", new OpenApiInfo
        {
            Title = "People Lookup API",
            Version = "v1"
        });
        c.SwaggerDoc("rosetta", new OpenApiInfo
        {
            Title = "Rosetta API",
            Version = "v1"
        });
        c.MapType<PPSAssociationsSearchField>(() => new OpenApiSchema
        {
            Type = "string",
            Enum = Enum.GetNames<PPSAssociationsSearchField>()
                .Select(name => new OpenApiString(name))
                .Cast<IOpenApiAny>()
                .ToList(),
            Example = new OpenApiString("bouOrgOId")
        });
        c.OperationFilter<IamwsSwaggerOperationFilter>();
        c.DocInclusionPredicate((documentName, apiDescription) =>
        {
            if (!apiDescription.ActionDescriptor.RouteValues.TryGetValue("controller", out var controllerName))
            {
                return false;
            }

            return documentName switch
            {
                "v1" => string.Equals(controllerName, "Iamws", StringComparison.OrdinalIgnoreCase),
                "rosetta" => string.Equals(controllerName, "Rosetta", StringComparison.OrdinalIgnoreCase),
                _ => false
            };
        });
    });

    // Configure data protection for auth cookies and related framework secrets.
    // This local key ring assumes one effective app instance. Before scaling out
    // or sharing cookies across deployment slots, move keys to shared storage such
    // as Azure Blob Storage or another ASP.NET Core Data Protection provider.
    var keysPath = Path.Combine(builder.Environment.ContentRootPath, "..", ".aspnet", "DataProtection-Keys");
    Directory.CreateDirectory(keysPath);

    builder.Services.AddDataProtection()
        .PersistKeysToFileSystem(new DirectoryInfo(keysPath));

    app = builder.Build();

    app.Logger.LogInformation("Starting up {AppName} in {Environment} environment", app.Environment.ApplicationName, app.Environment.EnvironmentName);

    app.UseForwardedHeaders();

    app.Use(async (context, next) =>
    {
        context.Response.OnStarting(() =>
        {
            if (context.Response.StatusCode == StatusCodes.Status404NotFound &&
                IsAssetRequest(context.Request.Path))
            {
                ApplyNoStoreHeaders(context);
            }

            return Task.CompletedTask;
        });

        await next();
    });

    var staticFileOptions = new StaticFileOptions
    {
        OnPrepareResponse = context =>
        {
            if (string.Equals(context.File.Name, "index.html", StringComparison.OrdinalIgnoreCase))
            {
                ApplyNoStoreHeaders(context.Context);
                return;
            }

            if (IsAssetRequest(context.Context.Request.Path))
            {
                context.Context.Response.Headers.CacheControl = "public,max-age=31536000,immutable";
            }
        }
    };

    app.UseDefaultFiles();
    app.UseStaticFiles(staticFileOptions);

    app.UseResponseCaching();

    app.UseSwagger();
    app.UseSwagger(c =>
    {
        c.RouteTemplate = "Swagger/{documentName}/swagger.json";
    });
    app.UseSwaggerUI(c =>
    {
        c.SwaggerEndpoint("/swagger/v1/swagger.json", "People Lookup API V1");
        c.SwaggerEndpoint("/swagger/rosetta/swagger.json", "Rosetta API V1");
    });
    app.UseSwaggerUI(c =>
    {
        c.RoutePrefix = "Swagger";
        c.SwaggerEndpoint("/Swagger/v1/swagger.json", "People Lookup API V1");
        c.SwaggerEndpoint("/Swagger/rosetta/swagger.json", "Rosetta API V1");
    });

    // Configure the HTTP request pipeline.
    if (!app.Environment.IsDevelopment())
    {
        // only use HTTPS redirection in non-development environments
        app.UseHttpsRedirection();
    }


    app.UseAuthentication();
    app.UseAuthorization();

    // enrich every log with request context
    app.UseRequestContextLogging();

    // app.UseHttpLogging(); // if you want extra logging. It's a little overkill though with the current logging setup

    app.MapControllers();

    app.MapGet("/api/app-info", () => new
        {
            Provider = useRosettaLookup ? "Rosetta" : "IAM",
            IsTest = app.Environment.IsEnvironment("test")
        })
        .AllowAnonymous();

    var healthEndpoint = app.MapHealthChecks("/health");

    // Cache the health check response for 10 seconds to protect rapid polling.
    healthEndpoint.WithMetadata(new ResponseCacheAttribute
    {
        Duration = 10,
        Location = ResponseCacheLocation.Any,
        NoStore = false,
    });

    // The default SPA fallback excludes paths whose final segment contains a dot.
    // Detail identifiers can be email addresses, so map that route explicitly.
    app.MapFallbackToFile("/detail/{*id}", "/index.html", staticFileOptions);
    app.MapFallbackToFile("/index.html", staticFileOptions);

    app.Logger.LogInformation("Startup complete. Listening on {Urls}", string.Join(", ", app.Urls));
    app.Run();
    app.Logger.LogInformation("Shutting down {AppName} in {Environment} environment", app.Environment.ApplicationName, app.Environment.EnvironmentName);
}
catch (Exception ex)
{
    StartupLoggingHelper.LogStartupFailure(app, ex);
    throw;
}

static bool IsAssetRequest(PathString path)
{
    var value = path.Value;
    return value is not null &&
           (string.Equals(value, "/assets", StringComparison.OrdinalIgnoreCase) ||
            value.StartsWith("/assets/", StringComparison.OrdinalIgnoreCase));
}

static void ApplyNoStoreHeaders(HttpContext context)
{
    context.Response.Headers.CacheControl = "no-store,max-age=0";
    context.Response.Headers.Pragma = "no-cache";
    context.Response.Headers.Expires = "0";
}
