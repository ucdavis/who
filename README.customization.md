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

- `AZURE_CLIENT_ID` (the deployment managed identity's `clientId`, not `AUTH_CLIENT_ID`)
- `AZURE_TENANT_ID`
- `AZURE_SUBSCRIPTION_ID`
- `RESOURCE_GROUP`

They also need these application configuration values:

- Auth variables: `AUTH_CLIENT_ID`, `AUTH_TENANT_ID`, `AUTH_DOMAIN`
- People lookup variable: `PEOPLELOOKUP_SENSITIVEINFOUSERS`
- People lookup secret: `PEOPLELOOKUP_IAMKEY`

Optional environment variables:

- App identity and location: `APP_NAME`, `AZURE_LOCATION`
- Existing infrastructure deploys: `WEB_APP_NAME`
- Auth overrides: `AUTH_INSTANCE`, `AUTH_CALLBACK_PATH`
- Rosetta client: `USEROSETTALOOKUP`, `ROSETTACLIENT__BASEURL`, `ROSETTACLIENT__CLIENTID`, `ROSETTACLIENT__SCOPE`, `ROSETTACLIENT__TOKENURL`
- Rosetta client secret: `ROSETTACLIENT__CLIENTSECRET`
- Observability: `OTEL_EXPORTER_OTLP_ENDPOINT`, `OTEL_EXPORTER_OTLP_PROTOCOL`, `OTEL_SERVICE_NAME`, `OTEL_RESOURCE_ATTRIBUTES`
- Observability secret: `OTEL_EXPORTER_OTLP_HEADERS`
- Existing App Service plan overrides: `WEB_PLAN_NAME`, `WEB_PLAN_RESOURCE_GROUP`

### One-time OIDC bootstrap

Run `infrastructure/azure/github-oidc.bicep` once per environment before the first GitHub deployment. Run it again after repository, organization, GitHub Environment, resource group, subscription, shared App Service plan, or identity changes, or if the managed identity is deleted.

The bootstrap creates a user-assigned managed identity in the application resource group and a federated credential for `repo:<repository>:environment:<env>`. It trusts issuer `https://token.actions.githubusercontent.com` and audience `api://AzureADTokenExchange`. GitHub Actions uses short-lived tokens without an Azure client secret. This is separate from the user sign-in app registration: do not use the deployment identity's `clientId` for `AUTH_CLIENT_ID` or `Auth:ClientId`.

By default, the identity receives Contributor on the application resource group and Website Contributor on the exact shared App Service plan. Because the identity lives in that resource group, it can manage its own identity resource and federated credentials; Contributor does not grant permission to manage Azure RBAC assignments.

The default identity names are `id-who-test-deploy` and `id-who-prod-deploy`. Override them with the `deploymentIdentityName` parameter if needed. This parameter and the output of the same name replace the previous `applicationName` parameter/output; update any external bootstrap callers accordingly.

The operator needs permission to create the application resource group, managed identity, and federated credential. With the default `assignRbac=true`, the operator also needs permission to create role assignments at the application resource group and shared App Service plan scopes. Owner at subscription scope is sufficient; narrower permissions can combine resource-group and managed-identity creation rights with User Access Administrator or Role Based Access Control Administrator at the required role-assignment scopes. With `assignRbac=false`, the identity and federated credential are still created, but an authorized operator must grant Contributor and Website Contributor to the emitted `principalId` before GitHub deployment can work.

Use the actual subscription, repository, resource group, location, and shared plan values for the target environment. The following examples use this app's test defaults. Validate the bootstrap before applying it:

```bash
az deployment sub validate \
  --subscription <test-subscription-id> \
  --location westus2 \
  --template-file infrastructure/azure/github-oidc.bicep \
  --parameters \
    appName=who \
    repository=ucdavis/who \
    env=test \
    expectedSubscriptionId=<test-subscription-id> \
    resourceGroupName=rg-who-test \
    webPlanName=DefaultPlan2 \
    webPlanResourceGroup=Default-Web-WestUS
```

Preview the changes with the same parameters:

```bash
az deployment sub what-if \
  --subscription <test-subscription-id> \
  --location westus2 \
  --template-file infrastructure/azure/github-oidc.bicep \
  --parameters \
    appName=who \
    repository=ucdavis/who \
    env=test \
    expectedSubscriptionId=<test-subscription-id> \
    resourceGroupName=rg-who-test \
    webPlanName=DefaultPlan2 \
    webPlanResourceGroup=Default-Web-WestUS
```

Apply the bootstrap once validation and the preview succeed:

```bash
az deployment sub create \
  --name github-oidc-who-test \
  --subscription <test-subscription-id> \
  --location westus2 \
  --template-file infrastructure/azure/github-oidc.bicep \
  --query properties.outputs \
  --parameters \
    appName=who \
    repository=ucdavis/who \
    env=test \
    expectedSubscriptionId=<test-subscription-id> \
    resourceGroupName=rg-who-test \
    webPlanName=DefaultPlan2 \
    webPlanResourceGroup=Default-Web-WestUS
```

Require `deploymentGuardPassed=true` and populated `deploymentIdentityName`, `clientId`, `principalId`, `tenantId`, `subscriptionId`, `resourceGroupName`, and `federatedCredentialSubject` outputs. With `assignRbac=true`, also require `roleAssignmentId` and `webPlanRoleAssignmentId`. A false guard creates no resources and emits empty identity outputs; a successful CLI exit alone is not sufficient. Check the subscription, repository, and environment resource-group suffix before continuing.

Use `env=prod`, the production subscription ID, deployment name `github-oidc-who-prod`, `resourceGroupName=rg-who-prod`, `webPlanName=Nibbler`, and `webPlanResourceGroup=service-plans-linux` for production, unless the actual environment uses overrides.

### Managed identity cutover

For an existing installation that uses a deployment app registration, perform this rollout separately from the repository update:

1. Record the current `AZURE_CLIENT_ID` from the **test** GitHub Environment for rollback. Confirm its actual subscription, tenant, resource group, repository, location, and shared App Service plan values.
2. Validate, preview, and apply the bootstrap for `test` using the commands above. Require the guard and outputs described above, with subject `repo:<actual-repository>:environment:test`. This adds the managed identity and parallel RBAC assignments; it does not delete or modify the old app registration, service principal, federated credentials, or role assignments.
3. Set the **test** GitHub Environment variable `AZURE_CLIENT_ID` to the new `clientId` output. Verify `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID`, and `RESOURCE_GROUP` against the corresponding outputs. Leave `AUTH_CLIENT_ID` and the user sign-in configuration unchanged. No new secrets or repository/organization-level variables are needed.
4. In GitHub Actions, manually run **CI/CD** (`ci-cd.yml`) from the branch containing the port, choosing `environment=test` and `deploy_infra=true`. Verify the Azure login, infrastructure deployment, and package deployment steps succeed. Check the deployed app's `/health` endpoint, user sign-in, and people lookup.
5. After test verification succeeds, repeat steps 1–4 for **prod**, recording its old client ID, using production values and subject, updating the **prod** GitHub Environment's `AZURE_CLIENT_ID`, and manually selecting `environment=prod`.
6. If cutover fails, restore the affected GitHub Environment's previous `AZURE_CLIENT_ID` and rerun its manual deployment. Leave both identities and their role assignments in place; cleanup is outside this rollout.

Pushes to `main` already trigger test deployment followed by production deployment, subject to environment protection rules. Coordinate cutover with those runs and use environment-specific manual runs to verify each new identity. Merging this port alone does not switch the workflow identity; the environment's `AZURE_CLIENT_ID` selects it.

### Local deployment

```bash
export APP_NAME="<app-name>"
export AZURE_SUBSCRIPTION_ID="<subscription-id>"
export PEOPLELOOKUP_IAMKEY="<iamws-api-key>"
infrastructure/azure/deploy_test.sh
```

Use `infrastructure/azure/deploy_prod.sh` for production. For existing infrastructure, run:

```bash
PEOPLELOOKUP_IAMKEY="<iamws-api-key>" DEPLOY_INFRA=false WEB_APP_NAME="<app-service-name>" infrastructure/azure/deploy.sh test
```

## Final Verification

- `npm start` launches backend and frontend.
- `cd client && npm run build` succeeds.
- `cd client && npm test -- --run` succeeds.
- `dotnet build app.sln` succeeds.
- `dotnet test app.sln` succeeds.
- `az bicep build --file infrastructure/azure/github-oidc.bicep --stdout > /tmp/who-github-oidc.json` succeeds when Azure CLI/Bicep is available.
- `az bicep build --file infrastructure/azure/main.bicep --stdout > /tmp/who-main.json` succeeds when Azure CLI/Bicep is available.
- Sign-in works locally and in hosted environments.
- IAM lookup works with the configured key.
