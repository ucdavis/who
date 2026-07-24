# Project Customization Guide

This app is now a focused IAM people lookup tool. It has a React/Vite frontend, an ASP.NET Core backend, Microsoft Entra sign-in, and Azure App Service deployment scaffolding.

## Project Identity

Update names in these files when renaming the app or repository:

- `package.json`
- `client/package.json`
- `app.sln`
- `server/server.csproj`
- `.github/workflows/`
- `infrastructure/azure/`

## Authentication

The app uses Microsoft Identity Web for Entra sign-in. Configure the user-facing app registration with redirect URIs for local and hosted environments:

- `http://localhost:5173/signin-oidc`
- `http://localhost:5165/signin-oidc`
- `https://<app-service-hostname>/signin-oidc`

Then update the `Auth` section in `server/appsettings.json` or environment-specific app settings:

```jsonc
"Auth": {
  "Instance": "https://login.microsoftonline.com/",
  "Domain": "<your-domain>",
  "TenantId": "<tenant-guid>",
  "ClientId": "<client-guid>",
  "CallbackPath": "/signin-oidc"
}
```

## People Lookup

The IAM lookup requires configuration from environment variables or `server/.env`:

- `PeopleLookup__IamKey`
- `PeopleLookup__SensitiveInfoUsers`

`PeopleLookup__SensitiveInfoUsers` accepts comma, semicolon, or newline separated IAM IDs. A user's `ucdPersonIAMID` claim must match a configured IAM ID to see sensitive identifier fields and use sensitive searches.

## Telemetry

Optional OpenTelemetry settings are documented in `server/.env.example`:

- `OTEL_EXPORTER_OTLP_ENDPOINT`
- `OTEL_EXPORTER_OTLP_HEADERS`
- `OTEL_SERVICE_NAME`
- `OTEL_RESOURCE_ATTRIBUTES`

## Azure Deployment

The deployment scaffold creates Linux App Service, Log Analytics, and workspace-based Application Insights. It does not create database or email-delivery resources.

GitHub Environments named `test` and `prod` need these variables from the OIDC bootstrap output or your Azure subscription:

- `AZURE_CLIENT_ID`
- `AZURE_TENANT_ID`
- `AZURE_SUBSCRIPTION_ID`
- `RESOURCE_GROUP`

Optional environment variables:

- App identity and location: `APP_NAME`, `AZURE_LOCATION`
- Existing infrastructure deploys: `WEB_APP_NAME`
- Auth: `AUTH_CLIENT_ID`, `AUTH_TENANT_ID`, `AUTH_DOMAIN`, `AUTH_INSTANCE`, `AUTH_CALLBACK_PATH`
- Observability: `OTEL_EXPORTER_OTLP_ENDPOINT`, `OTEL_EXPORTER_OTLP_PROTOCOL`, `OTEL_SERVICE_NAME`, `OTEL_RESOURCE_ATTRIBUTES`
- Observability secret: `OTEL_EXPORTER_OTLP_HEADERS`
- App Service SKU: `WEB_SKU_NAME`, `WEB_SKU_TIER`

Run `infrastructure/azure/github-oidc.bicep` once per environment before the first GitHub deployment. The bootstrap is only for GitHub-to-Azure deployment authentication; it is separate from the user sign-in app registration.

Local deployment:

```bash
export APP_NAME="<app-name>"
export AZURE_SUBSCRIPTION_ID="<subscription-id>"
infrastructure/azure/deploy_test.sh
```

Use `infrastructure/azure/deploy_prod.sh` for production. For existing infrastructure, run:

```bash
DEPLOY_INFRA=false WEB_APP_NAME="<app-service-name>" infrastructure/azure/deploy.sh test
```

## Final Verification

- `npm start` launches backend and frontend.
- `cd client && npm run build` succeeds.
- `cd client && npm test -- --run` succeeds.
- `dotnet build app.sln` succeeds.
- `dotnet test app.sln` succeeds.
- `az bicep build --file infrastructure/azure/main.bicep` succeeds when Azure CLI/Bicep is available.
- Sign-in works locally and in hosted environments.
- IAM lookup works with the configured key.