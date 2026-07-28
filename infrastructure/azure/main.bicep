targetScope = 'resourceGroup'

@description('Base name used for generated Azure resource names.')
param appName string = 'who'

@allowed([
  'test'
  'prod'
])
@description('Deployment environment. Only test and prod are supported by this template.')
param env string

@description('Expected Azure subscription ID. Resources are created only when this matches the current subscription and the resource group name ends with the environment suffix.')
param expectedSubscriptionId string

@description('Azure region for all resources.')
param location string = resourceGroup().location

@description('Additional resource tags to apply.')
param tags object = {}

@minValue(30)
@maxValue(730)
@description('Log Analytics and Application Insights retention in days.')
param appInsightsRetentionInDays int = 30

@description('Linux App Service runtime stack.')
param linuxFxVersion string = 'DOTNETCORE|10.0'

@description('App Service plan SKU name.')
param webSkuName string = env == 'prod' ? 'B1' : 'B1'

@description('App Service plan SKU tier.')
param webSkuTier string = env == 'prod' ? 'Basic' : 'Basic'

@description('Entra ID application client ID used by Microsoft Identity Web.')
param authClientId string = ''

@description('Entra ID tenant ID used by Microsoft Identity Web.')
param authTenantId string = ''

@description('Entra ID domain used by Microsoft Identity Web.')
param authDomain string = ''

@description('Entra ID authority instance used by Microsoft Identity Web.')
param authInstance string = environment().authentication.loginEndpoint

@description('OpenID Connect callback path used by Microsoft Identity Web.')
param authCallbackPath string = '/signin-oidc'

@description('Optional OTLP exporter endpoint. Leave empty when no external OTLP collector is configured.')
param otelExporterOtlpEndpoint string = ''

@allowed([
  'grpc'
  'http/protobuf'
])
@description('OTLP exporter protocol used when an OTLP endpoint is configured.')
param otelExporterOtlpProtocol string = 'http/protobuf'

@secure()
@description('Optional OTLP exporter headers. Use for collector authorization headers when required.')
param otelExporterOtlpHeaders string = ''

@description('Optional OpenTelemetry service name.')
param otelServiceName string = ''

@description('Optional OpenTelemetry resource attributes.')
param otelResourceAttributes string = ''

var appNameSafe = toLower(replace(replace(appName, ' ', ''), '_', ''))
var nameToken = substring(uniqueString(resourceGroup().id, appName, env), 0, 6)
var normalizedExpectedSubscriptionId = toLower(expectedSubscriptionId)
var normalizedCurrentSubscriptionId = toLower(subscription().subscriptionId)
var expectedResourceGroupSuffix = '-${env}'
var deploymentGuardPassed = !empty(expectedSubscriptionId) && normalizedCurrentSubscriptionId == normalizedExpectedSubscriptionId && endsWith(toLower(resourceGroup().name), expectedResourceGroupSuffix)

var webPlanName = toLower('asp-${appNameSafe}-${env}-${nameToken}')
var webAppName = toLower('web-${appNameSafe}-${env}-${nameToken}')
var appInsightsName = toLower('appi-${appNameSafe}-${env}-${nameToken}')
var logAnalyticsWorkspaceName = toLower('log-${appNameSafe}-${env}-${nameToken}')

var resourceTags = union(tags, {
  application: appName
  environment: env
})

resource logAnalyticsWorkspace 'Microsoft.OperationalInsights/workspaces@2023-09-01' = if (deploymentGuardPassed) {
  name: logAnalyticsWorkspaceName
  location: location
  tags: resourceTags
  properties: {
    sku: {
      name: 'PerGB2018'
    }
    retentionInDays: appInsightsRetentionInDays
  }
}

resource appInsights 'Microsoft.Insights/components@2020-02-02' = if (deploymentGuardPassed) {
  name: appInsightsName
  location: location
  kind: 'web'
  tags: resourceTags
  properties: {
    Application_Type: 'web'
    WorkspaceResourceId: logAnalyticsWorkspace!.id
  }
}

module compute 'modules/compute.bicep' = if (deploymentGuardPassed) {
  name: 'compute-${env}'
  params: {
    location: location
    tags: resourceTags
    webPlanName: webPlanName
    webAppName: webAppName
    webSkuName: webSkuName
    webSkuTier: webSkuTier
    linuxFxVersion: linuxFxVersion
    environmentName: env
    appInsightsConnectionString: appInsights!.properties.ConnectionString
    appInsightsInstrumentationKey: appInsights!.properties.InstrumentationKey
    authClientId: authClientId
    authTenantId: authTenantId
    authDomain: authDomain
    authInstance: authInstance
    authCallbackPath: authCallbackPath
    otelExporterOtlpEndpoint: otelExporterOtlpEndpoint
    otelExporterOtlpProtocol: otelExporterOtlpProtocol
    otelExporterOtlpHeaders: otelExporterOtlpHeaders
    otelServiceName: otelServiceName
    otelResourceAttributes: otelResourceAttributes
  }
}

output appInsightsConnectionString string = deploymentGuardPassed ? appInsights!.properties.ConnectionString : ''
output appInsightsName string = deploymentGuardPassed ? appInsights!.name : ''
output appServiceDefaultHostName string = deploymentGuardPassed ? compute!.outputs.defaultHostName : ''
output appServicePrincipalId string = deploymentGuardPassed ? compute!.outputs.principalId : ''
output deploymentGuardPassed bool = deploymentGuardPassed
output logAnalyticsWorkspaceName string = deploymentGuardPassed ? logAnalyticsWorkspace!.name : ''
output webAppName string = deploymentGuardPassed ? compute!.outputs.webAppName : ''