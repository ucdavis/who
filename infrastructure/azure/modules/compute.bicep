@description('Azure region for compute resources.')
param location string

@description('Tags to apply to compute resources.')
param tags object

@description('App Service plan name.')
param webPlanName string

@description('Web App name.')
param webAppName string

@description('App Service plan SKU name.')
param webSkuName string

@description('App Service plan SKU tier.')
param webSkuTier string

@description('Linux App Service runtime stack.')
param linuxFxVersion string

@description('Environment name for ASP.NET Core.')
param environmentName string

@description('Application Insights connection string for platform telemetry.')
param appInsightsConnectionString string

@description('Application Insights instrumentation key for platform telemetry.')
param appInsightsInstrumentationKey string

@description('Entra ID application client ID used by Microsoft Identity Web.')
param authClientId string

@description('Entra ID tenant ID used by Microsoft Identity Web.')
param authTenantId string

@description('Entra ID domain used by Microsoft Identity Web.')
param authDomain string

@description('Entra ID authority instance used by Microsoft Identity Web.')
param authInstance string

@description('OpenID Connect callback path used by Microsoft Identity Web.')
param authCallbackPath string

@description('Optional OTLP exporter endpoint.')
param otelExporterOtlpEndpoint string

@description('OTLP exporter protocol.')
param otelExporterOtlpProtocol string

@secure()
@description('Optional OTLP exporter headers.')
param otelExporterOtlpHeaders string

@description('Optional OpenTelemetry service name.')
param otelServiceName string

@description('Optional OpenTelemetry resource attributes.')
param otelResourceAttributes string

var baseAppSettings = [
  {
    name: 'ASPNETCORE_ENVIRONMENT'
    value: environmentName
  }
  {
    name: 'WEBSITE_RUN_FROM_PACKAGE'
    value: '1'
  }
  {
    name: 'APPLICATIONINSIGHTS_CONNECTION_STRING'
    value: appInsightsConnectionString
  }
  {
    name: 'APPINSIGHTS_INSTRUMENTATIONKEY'
    value: appInsightsInstrumentationKey
  }
  {
    name: 'APPLICATIONINSIGHTS_AGENT_EXTENSION_VERSION'
    value: '~3'
  }
  {
    name: 'Auth__ClientId'
    value: authClientId
  }
  {
    name: 'Auth__TenantId'
    value: authTenantId
  }
  {
    name: 'Auth__Domain'
    value: authDomain
  }
  {
    name: 'Auth__Instance'
    value: authInstance
  }
  {
    name: 'Auth__CallbackPath'
    value: authCallbackPath
  }
]

var otlpEndpointAppSettings = empty(otelExporterOtlpEndpoint) ? [] : [
  {
    name: 'OTEL_EXPORTER_OTLP_ENDPOINT'
    value: otelExporterOtlpEndpoint
  }
  {
    name: 'OTEL_EXPORTER_OTLP_PROTOCOL'
    value: otelExporterOtlpProtocol
  }
]

var otlpHeadersAppSettings = empty(otelExporterOtlpHeaders) ? [] : [
  {
    name: 'OTEL_EXPORTER_OTLP_HEADERS'
    value: otelExporterOtlpHeaders
  }
]

var otelServiceNameAppSettings = empty(otelServiceName) ? [] : [
  {
    name: 'OTEL_SERVICE_NAME'
    value: otelServiceName
  }
]

var otelResourceAttributesAppSettings = empty(otelResourceAttributes) ? [] : [
  {
    name: 'OTEL_RESOURCE_ATTRIBUTES'
    value: otelResourceAttributes
  }
]

resource webPlan 'Microsoft.Web/serverfarms@2023-12-01' = {
  name: webPlanName
  location: location
  kind: 'linux'
  sku: {
    name: webSkuName
    tier: webSkuTier
    size: webSkuName
    capacity: 1
  }
  tags: tags
  properties: {
    reserved: true
  }
}

resource webApp 'Microsoft.Web/sites@2023-12-01' = {
  name: webAppName
  location: location
  kind: 'app,linux'
  identity: {
    type: 'SystemAssigned'
  }
  tags: tags
  properties: {
    serverFarmId: webPlan.id
    httpsOnly: true
    siteConfig: {
      alwaysOn: true
      appSettings: concat(baseAppSettings, otlpEndpointAppSettings, otlpHeadersAppSettings, otelServiceNameAppSettings, otelResourceAttributesAppSettings)
      ftpsState: 'FtpsOnly'
      healthCheckPath: '/health'
      http20Enabled: true
      linuxFxVersion: linuxFxVersion
      minTlsVersion: '1.2'
    }
  }
}

output defaultHostName string = webApp.properties.defaultHostName
output principalId string = webApp.identity.principalId
output webAppName string = webApp.name