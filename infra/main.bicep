targetScope = 'resourceGroup'

@description('Location for all resources')
param location string = resourceGroup().location

@description('Principal ID of the SWA system-assigned managed identity. Enable with: az staticwebapp identity assign --name gsc-corewebsite-swa --resource-group gsc-corewebsite-rg')
param swaPrincipalId string = ''

var storageAccountName = 'gsccoresa'
var keyVaultName = 'gsc-core-kv'
var logAnalyticsName = 'gsc-core-law'
var appInsightsName = 'gsc-core-ai'
var communicationServiceName = 'gsc-core-acs'
var swaName = 'gsc-corewebsite-swa'

// Storage Account for Table Storage (chapter applications, events, registrations)
resource storageAccount 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: storageAccountName
  location: location
  sku: {
    name: 'Standard_LRS'
  }
  kind: 'StorageV2'
  properties: {
    minimumTlsVersion: 'TLS1_2'
    supportsHttpsTrafficOnly: true
    allowBlobPublicAccess: false
    networkAcls: {
      defaultAction: 'Deny'
      bypass: 'AzureServices'
    }
  }
}

// Table Service
resource tableService 'Microsoft.Storage/storageAccounts/tableServices@2023-05-01' = {
  parent: storageAccount
  name: 'default'
}

// Chapter Applications Table
resource chapterApplicationsTable 'Microsoft.Storage/storageAccounts/tableServices/tables@2023-05-01' = {
  parent: tableService
  name: 'ChapterApplications'
}

// Events Table
resource eventsTable 'Microsoft.Storage/storageAccounts/tableServices/tables@2023-05-01' = {
  parent: tableService
  name: 'Events'
}

// Event Registrations Table
resource eventRegistrationsTable 'Microsoft.Storage/storageAccounts/tableServices/tables@2023-05-01' = {
  parent: tableService
  name: 'EventRegistrations'
}

// Event Demographics Table (separated from PII for privacy)
resource eventDemographicsTable 'Microsoft.Storage/storageAccounts/tableServices/tables@2023-05-01' = {
  parent: tableService
  name: 'EventDemographics'
}

// Event Badges Table
resource eventBadgesTable 'Microsoft.Storage/storageAccounts/tableServices/tables@2023-05-01' = {
  parent: tableService
  name: 'EventBadges'
}

// Event Volunteers Table
resource eventVolunteersTable 'Microsoft.Storage/storageAccounts/tableServices/tables@2023-05-01' = {
  parent: tableService
  name: 'EventVolunteers'
}

// Contact Submissions Table
resource contactSubmissionsTable 'Microsoft.Storage/storageAccounts/tableServices/tables@2023-05-01' = {
  parent: tableService
  name: 'ContactSubmissions'
}

// Sessionize Cache Table
resource sessionizeCacheTable 'Microsoft.Storage/storageAccounts/tableServices/tables@2023-05-01' = {
  parent: tableService
  name: 'SessionizeCache'
}

// Chapter Subscriptions Table
resource chapterSubscriptionsTable 'Microsoft.Storage/storageAccounts/tableServices/tables@2023-05-01' = {
  parent: tableService
  name: 'ChapterSubscriptions'
}

// Community Partners Table
resource communityPartnersTable 'Microsoft.Storage/storageAccounts/tableServices/tables@2023-05-01' = {
  parent: tableService
  name: 'CommunityPartners'
}

// Key Vault for GSC secrets
// Network ACLs set to Allow — RBAC authorization is the primary access control.
// SWA managed identity is granted Key Vault Secrets User below.
resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: keyVaultName
  location: location
  properties: {
    sku: {
      family: 'A'
      name: 'standard'
    }
    tenantId: subscription().tenantId
    enableRbacAuthorization: true
    enableSoftDelete: true
    enablePurgeProtection: true
    softDeleteRetentionInDays: 7
    networkAcls: {
      defaultAction: 'Allow'
      bypass: 'AzureServices'
    }
  }
}

// Grant SWA managed identity 'Key Vault Secrets User' role on the vault
// This allows SWA to resolve @Microsoft.KeyVault(...) references in app settings.
// Role ID: 4633458b-17de-408a-b874-0445c86b69e6 = Key Vault Secrets User
resource swaKeyVaultAccess 'Microsoft.Authorization/roleAssignments@2022-04-01' = if (!empty(swaPrincipalId)) {
  name: guid(keyVault.id, swaName, '4633458b-17de-408a-b874-0445c86b69e6')
  scope: keyVault
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '4633458b-17de-408a-b874-0445c86b69e6')
    principalId: swaPrincipalId
    principalType: 'ServicePrincipal'
  }
}

// Log Analytics Workspace (required by Application Insights)
resource logAnalytics 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: logAnalyticsName
  location: location
  properties: {
    sku: {
      name: 'PerGB2018'
    }
    retentionInDays: 30
  }
}

// Application Insights (free tier: 5GB/month ingestion)
resource appInsights 'Microsoft.Insights/components@2020-02-02' = {
  name: appInsightsName
  location: location
  kind: 'web'
  properties: {
    Application_Type: 'web'
    WorkspaceResourceId: logAnalytics.id
    RetentionInDays: 30
  }
}

// Azure Communication Services (email for tickets and badges)
resource communicationService 'Microsoft.Communication/communicationServices@2023-04-01' = {
  name: communicationServiceName
  location: 'global'
  properties: {
    dataLocation: 'Australia'
  }
}

// Outputs
output storageAccountName string = storageAccount.name
output storageAccountId string = storageAccount.id
output keyVaultName string = keyVault.name
output keyVaultUri string = keyVault.properties.vaultUri
output appInsightsConnectionString string = appInsights.properties.ConnectionString
output appInsightsInstrumentationKey string = appInsights.properties.InstrumentationKey
output communicationServiceName string = communicationService.name

// Azure Monitor Alert: 5xx error spike (free tier)
resource serverErrorAlert 'Microsoft.Insights/metricAlerts@2018-03-01' = {
  name: 'gsc-core-5xx-alert'
  location: 'global'
  properties: {
    severity: 2
    enabled: true
    scopes: [appInsights.id]
    evaluationFrequency: 'PT5M'
    windowSize: 'PT15M'
    criteria: {
      'odata.type': 'Microsoft.Azure.Monitor.SingleResourceMultipleMetricCriteria'
      allOf: [
        {
          name: 'ServerErrors'
          metricName: 'requests/failed'
          metricNamespace: 'microsoft.insights/components'
          operator: 'GreaterThan'
          threshold: 10
          timeAggregation: 'Count'
          criterionType: 'StaticThresholdCriterion'
        }
      ]
    }
    description: 'Alert when more than 10 failed requests in 15 minutes'
  }
}

// Azure Monitor Alert: high response time
resource latencyAlert 'Microsoft.Insights/metricAlerts@2018-03-01' = {
  name: 'gsc-core-latency-alert'
  location: 'global'
  properties: {
    severity: 3
    enabled: true
    scopes: [appInsights.id]
    evaluationFrequency: 'PT5M'
    windowSize: 'PT15M'
    criteria: {
      'odata.type': 'Microsoft.Azure.Monitor.SingleResourceMultipleMetricCriteria'
      allOf: [
        {
          name: 'HighLatency'
          metricName: 'requests/duration'
          metricNamespace: 'microsoft.insights/components'
          operator: 'GreaterThan'
          threshold: 5000
          timeAggregation: 'Average'
          criterionType: 'StaticThresholdCriterion'
        }
      ]
    }
    description: 'Alert when average response time exceeds 5 seconds'
  }
}
