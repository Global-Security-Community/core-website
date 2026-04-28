const { TableClient } = require('@azure/data-tables');

const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING || '';

function getTableClient() {
  if (!connectionString) {
    throw new Error('AZURE_STORAGE_CONNECTION_STRING environment variable is not configured');
  }
  return TableClient.fromConnectionString(connectionString, 'AuditLog');
}

// Reverse timestamp for newest-first ordering in Table Storage
function reverseTimestamp() {
  const maxTs = 9999999999999;
  return String(maxTs - Date.now()).padStart(13, '0');
}

/**
 * Log an admin action to the AuditLog table.
 * Fire-and-forget — never throws, never blocks the caller.
 *
 * @param {string} entityType - 'event', 'chapter', 'registration', 'partner'
 * @param {string} entityId - Event ID, chapter slug, etc.
 * @param {string} action - e.g. 'event_created', 'chapter_approved'
 * @param {string} adminEmail - Email of the admin performing the action
 * @param {object} details - Additional context (serialised as JSON)
 * @param {object} context - Azure Functions context for error logging
 */
async function logAudit(entityType, entityId, action, adminEmail, details, context) {
  try {
    const client = getTableClient();
    const entity = {
      partitionKey: `${entityType}_${entityId}`,
      rowKey: `${reverseTimestamp()}_${Math.random().toString(36).slice(2, 8)}`,
      action,
      adminEmail: adminEmail || 'unknown',
      details: JSON.stringify(details || {}),
      timestamp: new Date().toISOString()
    };
    await client.createEntity(entity);
  } catch (err) {
    if (context) {
      context.log(`Audit log write failed (non-critical): ${err.message}`);
    }
  }
}

/**
 * Retrieve audit log entries for a specific entity.
 * Returns newest-first (due to reverse timestamp RowKey).
 *
 * @param {string} entityType - 'event', 'chapter', etc.
 * @param {string} entityId - The entity identifier
 * @param {number} limit - Max entries to return (default 50)
 * @returns {Array<{action, adminEmail, details, timestamp}>}
 */
async function getAuditLog(entityType, entityId, limit = 50) {
  const client = getTableClient();
  const partitionKey = `${entityType}_${entityId}`.replace(/'/g, "''");
  const entities = client.listEntities({
    queryOptions: { filter: `PartitionKey eq '${partitionKey}'` }
  });
  const results = [];
  for await (const entity of entities) {
    results.push({
      action: entity.action,
      adminEmail: entity.adminEmail,
      details: entity.details ? JSON.parse(entity.details) : {},
      timestamp: entity.timestamp
    });
    if (results.length >= limit) break;
  }
  return results;
}

module.exports = { logAudit, getAuditLog, reverseTimestamp };
