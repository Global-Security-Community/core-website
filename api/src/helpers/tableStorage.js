const { TableClient, AzureNamedKeyCredential } = require('@azure/data-tables');

const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING || '';
const TABLE_NAME = 'ChapterApplications';

function getTableClient() {
  if (!connectionString) {
    throw new Error('AZURE_STORAGE_CONNECTION_STRING environment variable is not configured');
  }
  return TableClient.fromConnectionString(connectionString, TABLE_NAME);
}

async function storeApplication(application) {
  const client = getTableClient();
  const entity = {
    partitionKey: 'applications',
    rowKey: application.id,
    fullName: application.fullName,
    email: application.email,
    city: application.city,
    country: application.country,
    linkedIn: application.linkedIn || '',
    aboutYou: application.aboutYou,
    whyLead: application.whyLead,
    existingCommunity: application.existingCommunity || '',
    secondLeadName: application.secondLeadName || '',
    secondLeadEmail: application.secondLeadEmail || '',
    secondLeadLinkedIn: application.secondLeadLinkedIn || '',
    secondLeadAbout: application.secondLeadAbout || '',
    status: 'pending',
    submittedAt: new Date().toISOString()
  };
  await client.createEntity(entity);
  return entity;
}

async function getApplication(applicationId) {
  const client = getTableClient();
  return await client.getEntity('applications', applicationId);
}

async function updateApplicationStatus(applicationId, status) {
  const client = getTableClient();
  const entity = await client.getEntity('applications', applicationId);
  entity.status = status;
  entity.updatedAt = new Date().toISOString();
  await client.updateEntity(entity, 'Merge');
  return entity;
}

module.exports = { storeApplication, getApplication, updateApplicationStatus };
