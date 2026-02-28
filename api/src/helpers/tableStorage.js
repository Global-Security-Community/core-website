const { TableClient, AzureNamedKeyCredential } = require('@azure/data-tables');

const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING || '';

function getTableClient(tableName) {
  if (!connectionString) {
    throw new Error('AZURE_STORAGE_CONNECTION_STRING environment variable is not configured');
  }
  return TableClient.fromConnectionString(connectionString, tableName);
}

// ─── Chapter Applications ───

async function storeApplication(application) {
  const client = getTableClient('ChapterApplications');
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
  const client = getTableClient('ChapterApplications');
  return await client.getEntity('applications', applicationId);
}

async function updateApplicationStatus(applicationId, status) {
  const client = getTableClient('ChapterApplications');
  const entity = await client.getEntity('applications', applicationId);
  entity.status = status;
  entity.updatedAt = new Date().toISOString();
  await client.updateEntity(entity, 'Merge');
  return entity;
}

// ─── Events ───

async function storeEvent(event) {
  const client = getTableClient('Events');
  const entity = {
    partitionKey: event.chapterSlug,
    rowKey: event.id,
    title: event.title,
    slug: event.slug,
    chapterSlug: event.chapterSlug,
    date: event.date,
    endDate: event.endDate || '',
    location: event.location,
    description: event.description,
    sessionizeApiId: event.sessionizeApiId || '',
    registrationCap: event.registrationCap || 0,
    status: event.status || 'published',
    createdBy: event.createdBy,
    createdAt: new Date().toISOString()
  };
  await client.createEntity(entity);
  return entity;
}

async function getEvent(chapterSlug, eventId) {
  const client = getTableClient('Events');
  return await client.getEntity(chapterSlug, eventId);
}

async function getEventById(eventId) {
  const client = getTableClient('Events');
  const entities = client.listEntities({
    queryOptions: { filter: `RowKey eq '${eventId.replace(/'/g, "''")}'` }
  });
  for await (const entity of entities) {
    return entity;
  }
  return null;
}

async function getEventBySlug(slug) {
  const client = getTableClient('Events');
  const entities = client.listEntities({
    queryOptions: { filter: `slug eq '${slug.replace(/'/g, "''")}'` }
  });
  for await (const entity of entities) {
    return entity;
  }
  return null;
}

async function listEvents(chapterSlug) {
  const client = getTableClient('Events');
  const filter = chapterSlug
    ? `PartitionKey eq '${chapterSlug.replace(/'/g, "''")}'`
    : undefined;
  const entities = client.listEntities(filter ? { queryOptions: { filter } } : {});
  const results = [];
  for await (const entity of entities) {
    results.push(entity);
  }
  return results;
}

async function updateEvent(chapterSlug, eventId, updates) {
  const client = getTableClient('Events');
  const entity = await client.getEntity(chapterSlug, eventId);
  Object.assign(entity, updates);
  entity.updatedAt = new Date().toISOString();
  await client.updateEntity(entity, 'Merge');
  return entity;
}

// ─── Registrations ───

async function storeRegistration(registration) {
  const client = getTableClient('EventRegistrations');
  const entity = {
    partitionKey: registration.eventId,
    rowKey: registration.id,
    userId: registration.userId,
    fullName: registration.fullName,
    email: registration.email,
    company: registration.company || '',
    ticketCode: registration.ticketCode,
    checkedIn: false,
    checkedInAt: '',
    registeredAt: new Date().toISOString()
  };
  await client.createEntity(entity);
  return entity;
}

async function getRegistrationByTicketCode(eventId, ticketCode) {
  const client = getTableClient('EventRegistrations');
  const entities = client.listEntities({
    queryOptions: { filter: `PartitionKey eq '${eventId.replace(/'/g, "''")}' and ticketCode eq '${ticketCode.replace(/'/g, "''")}'` }
  });
  for await (const entity of entities) {
    return entity;
  }
  return null;
}

async function getRegistrationsByUser(userId) {
  const client = getTableClient('EventRegistrations');
  const entities = client.listEntities({
    queryOptions: { filter: `userId eq '${userId.replace(/'/g, "''")}'` }
  });
  const results = [];
  for await (const entity of entities) {
    results.push(entity);
  }
  return results;
}

async function getRegistrationsByEvent(eventId) {
  const client = getTableClient('EventRegistrations');
  const entities = client.listEntities({
    queryOptions: { filter: `PartitionKey eq '${eventId.replace(/'/g, "''")}'` }
  });
  const results = [];
  for await (const entity of entities) {
    results.push(entity);
  }
  return results;
}

async function countRegistrations(eventId) {
  const regs = await getRegistrationsByEvent(eventId);
  return regs.length;
}

async function updateRegistration(eventId, registrationId, updates) {
  const client = getTableClient('EventRegistrations');
  const entity = await client.getEntity(eventId, registrationId);
  Object.assign(entity, updates);
  await client.updateEntity(entity, 'Merge');
  return entity;
}

// ─── Demographics ───

async function storeDemographics(demographics) {
  const client = getTableClient('EventDemographics');
  const entity = {
    partitionKey: demographics.eventId,
    rowKey: demographics.registrationId,
    employmentStatus: demographics.employmentStatus || '',
    industry: demographics.industry || '',
    jobTitle: demographics.jobTitle || '',
    companySize: demographics.companySize || '',
    experienceLevel: demographics.experienceLevel || ''
  };
  await client.createEntity(entity);
  return entity;
}

// ─── Badges ───

async function storeBadge(badge) {
  const client = getTableClient('EventBadges');
  const entity = {
    partitionKey: badge.eventId,
    rowKey: badge.id,
    recipientEmail: badge.recipientEmail,
    recipientName: badge.recipientName,
    badgeType: badge.badgeType,
    userId: badge.userId || '',
    issuedAt: new Date().toISOString()
  };
  await client.createEntity(entity);
  return entity;
}

async function getBadge(eventId, badgeId) {
  const client = getTableClient('EventBadges');
  return await client.getEntity(eventId, badgeId);
}

async function getBadgesByEvent(eventId) {
  const client = getTableClient('EventBadges');
  const entities = client.listEntities({
    queryOptions: { filter: `PartitionKey eq '${eventId.replace(/'/g, "''")}'` }
  });
  const results = [];
  for await (const entity of entities) {
    results.push(entity);
  }
  return results;
}

// ─── Volunteers ───

async function storeVolunteer(volunteer) {
  const client = getTableClient('EventVolunteers');
  const entity = {
    partitionKey: volunteer.eventId,
    rowKey: volunteer.id,
    email: volunteer.email.toLowerCase().trim(),
    name: volunteer.name || '',
    addedBy: volunteer.addedBy || '',
    addedAt: new Date().toISOString()
  };
  await client.createEntity(entity);
  return entity;
}

async function getVolunteersByEvent(eventId) {
  const client = getTableClient('EventVolunteers');
  const entities = client.listEntities({
    queryOptions: { filter: `PartitionKey eq '${eventId.replace(/'/g, "''")}'` }
  });
  const results = [];
  for await (const entity of entities) {
    results.push(entity);
  }
  return results;
}

async function removeVolunteer(eventId, volunteerId) {
  const client = getTableClient('EventVolunteers');
  await client.deleteEntity(eventId, volunteerId);
}

async function isVolunteerForAnyEvent(email) {
  const client = getTableClient('EventVolunteers');
  const normalised = email.trim().toLowerCase();
  const entities = client.listEntities({
    queryOptions: { filter: `email eq '${normalised.replace(/'/g, "''")}'` }
  });
  for await (const entity of entities) {
    return entity;
  }
  return null;
}

// ─── Chapter Leads (for role assignment) ───

async function getApprovedApplicationByEmail(email) {
  const client = getTableClient('ChapterApplications');
  const normalised = email.trim().toLowerCase();
  const entities = client.listEntities({
    queryOptions: { filter: `status eq 'approved'` }
  });
  for await (const entity of entities) {
    if (entity.email && entity.email.toLowerCase() === normalised) return entity;
    if (entity.secondLeadEmail && entity.secondLeadEmail.toLowerCase() === normalised) return entity;
  }
  return null;
}

module.exports = {
  storeApplication, getApplication, updateApplicationStatus,
  storeEvent, getEvent, getEventById, getEventBySlug, listEvents, updateEvent,
  storeRegistration, getRegistrationByTicketCode, getRegistrationsByUser,
  getRegistrationsByEvent, countRegistrations, updateRegistration,
  storeDemographics,
  storeBadge, getBadge, getBadgesByEvent,
  storeVolunteer, getVolunteersByEvent, removeVolunteer, isVolunteerForAnyEvent,
  getApprovedApplicationByEmail
};
