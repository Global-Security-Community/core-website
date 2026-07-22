const { createHash } = require('crypto');
const {
  getAuthUser,
  hasRole,
  unauthorised,
  forbidden,
  verifyChapterAccess,
  verifyCsrfHeader
} = require('../helpers/auth');
const {
  getEvent,
  getRegistrationsByEvent,
  getBadge,
  getBadgesByEvent,
  storeBadge,
  deleteBadge,
  getPostEventJob,
  upsertPostEventJob,
  createPostEventJob,
  updatePostEventJob,
  getPostEventDeliveries,
  upsertPostEventDelivery,
  createPostEventDelivery,
  updatePostEventDelivery
} = require('../helpers/tableStorage');
const { stripHtml } = require('../helpers/sanitise');
const { generateSharedEventBadgePng } = require('../helpers/badgeGenerator');
const { downloadGeneratedImage } = require('../helpers/imageGenerator');
const { sendPostEventEmail } = require('../helpers/emailService');
const { logAudit } = require('../helpers/auditLog');
const { checkRateLimit, getClientIP } = require('../helpers/rateLimiter');
const {
  ROLES,
  getDefaultTemplates,
  normaliseRole,
  badgeTypeForRole,
  validateTemplates,
  renderTemplate,
  checkedInRegistrations,
  summariseRecipients
} = require('../helpers/postEventCommunication');

const BATCH_SIZE = 20;
const DELIVERY_LEASE_MS = 2 * 60 * 1000;

/**
 * GET/POST /api/postEventCommunication
 * Guided, resumable post-event thank-you communications for checked-in registrations.
 */
module.exports = async function postEventCommunication(request, context) {
  try {
    const user = getAuthUser(request);
    if (!user) return unauthorised();
    if (!hasRole(user, 'admin')) return forbidden('Only event organisers can manage post-event communications');

    const isPost = request.method === 'POST';
    if (isPost) {
      const csrfError = verifyCsrfHeader(request);
      if (csrfError) return csrfError;
      if (!checkRateLimit(getClientIP(request), 'postEventCommunication', 30)) {
        return { status: 429, jsonBody: { error: 'Too many communication requests. Please try again shortly.' } };
      }
    }

    const url = new URL(request.url);
    let body = {};
    if (isPost) {
      try {
        body = await request.json();
      } catch {
        return { status: 400, jsonBody: { error: 'Invalid JSON' } };
      }
    }
    const eventId = String(isPost ? body.eventId || '' : url.searchParams.get('eventId') || '').trim();
    const chapterSlug = String(isPost ? body.chapterSlug || '' : url.searchParams.get('chapterSlug') || '').trim();
    if (!eventId || !chapterSlug) {
      return { status: 400, jsonBody: { error: 'Event and chapter are required' } };
    }

    const event = await getEvent(chapterSlug, eventId);
    if (!event) return { status: 400, jsonBody: { error: 'Event not found' } };
    if (!await verifyChapterAccess(user, chapterSlug, context)) {
      return forbidden('You do not have permission to manage this event');
    }

    if (!isPost) return await getCommunicationState(event, eventId);

    const action = String(body.action || '').trim();
    if (action === 'saveDraft') {
      return await saveDraft(eventId, body.templates);
    }
    if (action === 'start') {
      return await startJob(event, eventId, body.templates, user, context);
    }
    if (action === 'processBatch') {
      return await processBatch(event, eventId, user, context);
    }
    if (action === 'retryFailed') {
      return await retryFailed(eventId, user, context);
    }
    return { status: 400, jsonBody: { error: 'Unsupported communication action' } };
  } catch (error) {
    context.log(`postEventCommunication error: ${error.message}`);
    return { status: 500, jsonBody: { error: 'Post-event communication failed. Please try again.' } };
  }
};

async function getCommunicationState(event, eventId) {
  const [registrations, job, deliveries] = await Promise.all([
    getRegistrationsByEvent(eventId),
    getPostEventJob(eventId),
    getPostEventDeliveries(eventId)
  ]);
  const templates = parseTemplates(job && job.templatesJson) || getDefaultTemplates();
  return {
    status: 200,
    jsonBody: {
      eventStatus: event.status || 'published',
      hasBadgeArtwork: Boolean(event.badgeImageUrl),
      recipients: job && job.startedAt
        ? summariseFrozenRecipients(deliveries)
        : summariseRecipients(registrations),
      templates,
      defaultTemplates: getDefaultTemplates(),
      placeholders: ['{firstName}', '{eventTitle}', '{eventDate}', '{chapterName}'],
      job: job ? {
        status: job.status || 'draft',
        startedAt: job.startedAt || '',
        completedAt: job.completedAt || '',
        progress: deliveryProgress(deliveries)
      } : {
        status: 'draft',
        startedAt: '',
        completedAt: '',
        progress: deliveryProgress([])
      }
    }
  };
}

async function saveDraft(eventId, templates) {
  const validated = validateTemplates(sanitiseTemplates(templates));
  if (!validated.valid) return { status: 400, jsonBody: { error: validated.error } };
  const saved = await writeDraftConditionally(eventId, validated.templates);
  if (!saved) {
    return { status: 409, jsonBody: { error: 'Messages cannot be edited after sending has started' } };
  }
  return { status: 200, jsonBody: { success: true, templates: validated.templates } };
}

async function startJob(event, eventId, templates, user, context) {
  if (event.status !== 'completed') {
    return { status: 400, jsonBody: { error: 'Mark the event complete before sending post-event communications' } };
  }
  const validated = validateTemplates(sanitiseTemplates(templates));
  if (!validated.valid) return { status: 400, jsonBody: { error: validated.error } };
  const frozen = await freezeJobConditionally(eventId, validated.templates, user.userDetails || '');
  if (!frozen) {
    return { status: 409, jsonBody: { error: 'Messages are being prepared by another request. Please try again.' } };
  }
  if (frozen.resumed && isTrue(frozen.job.snapshotComplete)) {
    const deliveries = await getPostEventDeliveries(eventId);
    return { status: 200, jsonBody: { success: true, resumed: true, progress: deliveryProgress(deliveries) } };
  }

  const [registrations, badges, existingDeliveries] = await Promise.all([
    getRegistrationsByEvent(eventId),
    getBadgesByEvent(eventId),
    getPostEventDeliveries(eventId)
  ]);
  const recipients = checkedInRegistrations(registrations);
  const issuedEmails = new Set(badges.map(badge => String(badge.recipientEmail || '').trim().toLowerCase()));
  const existingRows = new Set(existingDeliveries.map(delivery => delivery.rowKey));
  for (const registration of recipients) {
    const email = String(registration.email || '').trim().toLowerCase();
    const recipientKey = recipientRowKey(email);
    if (existingRows.has(recipientKey)) continue;
    const alreadySent = issuedEmails.has(email);
    try {
      await createPostEventDelivery(eventId, recipientKey, {
        email,
        fullName: registration.fullName || '',
        userId: registration.userId || '',
        role: normaliseRole(registration.role),
        status: alreadySent ? 'sent' : 'pending',
        attempts: alreadySent ? 1 : 0,
        sentAt: alreadySent ? new Date().toISOString() : '',
        lastError: '',
        operationId: '',
        leaseUntil: ''
      });
    } catch (error) {
      if (!isConflict(error)) throw error;
    }
  }

  const now = new Date().toISOString();
  await upsertPostEventJob(eventId, {
    status: recipients.length === 0 ? 'completed' : 'processing',
    snapshotComplete: true,
    completedAt: recipients.length === 0 ? now : '',
  });
  if (!frozen.resumed) {
    logAudit('event', eventId, 'post_event_communications_started', user.userDetails, {
      recipients: recipients.length,
      roleCounts: summariseRecipients(recipients).roles
    }, context);
  }
  return {
    status: 200,
    jsonBody: {
      success: true,
      resumed: frozen.resumed,
      progress: deliveryProgress(await getPostEventDeliveries(eventId))
    }
  };
}

async function processBatch(event, eventId, user, context) {
  const job = await getPostEventJob(eventId);
  if (!job || !job.startedAt) {
    return { status: 409, jsonBody: { error: 'Start the communication job before processing messages' } };
  }
  if (!isTrue(job.snapshotComplete)) {
    return { status: 409, jsonBody: { error: 'Recipient preparation is still in progress. Please try again shortly.' } };
  }
  const templates = parseTemplates(job.templatesJson);
  const validated = validateTemplates(templates);
  if (!validated.valid) return { status: 500, jsonBody: { error: 'Saved message templates are invalid' } };

  const deliveries = await getPostEventDeliveries(eventId);
  const candidates = deliveries.filter(isDeliveryAvailable).slice(0, BATCH_SIZE);
  const batch = [];
  for (const delivery of candidates) {
    const claimed = await claimDelivery(eventId, delivery);
    if (claimed) batch.push(claimed);
  }
  if (batch.length === 0) {
    const hasLeasedDeliveries = deliveries.some(delivery => delivery.status === 'sending');
    return await finishOrReportJob(
      eventId,
      job,
      deliveries,
      user,
      context,
      hasLeasedDeliveries ? 2000 : 0
    );
  }

  const badgeBuffers = await loadBadgeBuffers(event, context);
  const issuedBadges = await getBadgesByEvent(eventId);
  const issuedByEmail = new Map(issuedBadges.map(badge => [
    String(badge.recipientEmail || '').trim().toLowerCase(),
    badge
  ]));

  for (const delivery of batch) {
    const role = normaliseRole(delivery.role);
    const badgeType = badgeTypeForRole(role);
    const badgeBuffer = badgeBuffers[badgeType];
    const badgeId = createHash('sha256')
      .update(`${eventId}\0${delivery.email}`)
      .digest('hex')
      .slice(0, 32);
    const attempts = Number(delivery.attempts || 0);
    const existingBadge = issuedByEmail.get(delivery.email);
    if (existingBadge && existingBadge.postEventOperationId !== delivery.operationId) {
      await upsertPostEventDelivery(eventId, delivery.rowKey, {
        status: 'sent',
        attempts,
        sentAt: delivery.sentAt || new Date().toISOString(),
        lastError: '',
        leaseUntil: ''
      });
      continue;
    }

    try {
      if (!existingBadge) {
        try {
          await storeBadge({
            id: badgeId,
            eventId,
            recipientEmail: delivery.email,
            recipientName: delivery.fullName,
            badgeType,
            userId: delivery.userId || '',
            postEventOperationId: delivery.operationId
          });
        } catch (error) {
          if (!isConflict(error)) throw error;
          const reservation = await getBadge(eventId, badgeId);
          if (reservation.postEventOperationId !== delivery.operationId) {
            await upsertPostEventDelivery(eventId, delivery.rowKey, {
              status: 'sent',
              attempts,
              sentAt: new Date().toISOString(),
              lastError: '',
              leaseUntil: ''
            });
            continue;
          }
        }
      }
      const template = validated.templates[role];
      const recipient = { fullName: delivery.fullName, name: delivery.fullName, email: delivery.email };
      const subject = renderTemplate(template.subject, recipient, event);
      const message = renderTemplate(template.message, recipient, event);
      try {
        await sendPostEventEmail(
          { name: delivery.fullName, email: delivery.email },
          badgeBuffer.toString('base64'),
          event,
          badgeType,
          subject,
          message,
          context,
          'image/png',
          `gsc-${badgeType.toLowerCase()}-badge.png`,
          delivery.operationId
        );
      } catch (emailError) {
        if (emailError.deliveryDefinitive) {
          await deleteBadgeReservation(eventId, badgeId);
        }
        throw emailError;
      }
      await upsertPostEventDelivery(eventId, delivery.rowKey, {
        status: 'sent',
        attempts,
        sentAt: new Date().toISOString(),
        lastError: '',
        leaseUntil: ''
      });
    } catch (error) {
      context.log(`Post-event email failed for ${delivery.email}: ${error.message}`);
      await upsertPostEventDelivery(eventId, delivery.rowKey, {
        status: 'failed',
        attempts,
        lastError: error.deliveryDefinitive
          ? 'Email delivery failed'
          : 'Email delivery status could not be confirmed',
        operationId: error.deliveryDefinitive ? '' : delivery.operationId,
        leaseUntil: ''
      });
    }
  }

  return await finishOrReportJob(
    eventId,
    job,
    await getPostEventDeliveries(eventId),
    user,
    context
  );
}

async function retryFailed(eventId, user, context) {
  const job = await getPostEventJob(eventId);
  if (!job || !job.startedAt) {
    return { status: 409, jsonBody: { error: 'No communication job is available to retry' } };
  }
  const deliveries = await getPostEventDeliveries(eventId);
  const failed = deliveries.filter(delivery => delivery.status === 'failed');
  for (const delivery of failed) {
    await upsertPostEventDelivery(eventId, delivery.rowKey, {
      status: 'pending',
      lastError: ''
    });
  }
  await upsertPostEventJob(eventId, {
    status: failed.length ? 'processing' : job.status,
    completedAt: failed.length ? '' : job.completedAt || ''
  });
  logAudit('event', eventId, 'post_event_communications_retry', user.userDetails, {
    recipients: failed.length
  }, context);
  return {
    status: 200,
    jsonBody: {
      success: true,
      retried: failed.length,
      progress: deliveryProgress(await getPostEventDeliveries(eventId))
    }
  };
}

async function loadBadgeBuffers(event, context) {
  const buffers = {};
  const storedUrls = {
    Attendee: event.badgeImageUrl,
    Speaker: event.speakerBadgeImageUrl,
    Organiser: event.organiserBadgeImageUrl
  };
  for (const badgeType of ['Attendee', 'Speaker', 'Organiser']) {
    if (storedUrls[badgeType]) {
      try {
        buffers[badgeType] = await downloadGeneratedImage(storedUrls[badgeType]);
      } catch (error) {
        context.log(`Could not load ${badgeType} badge artwork: ${error.message}`);
      }
    }
    if (!buffers[badgeType]) {
      buffers[badgeType] = await generateSharedEventBadgePng({
        eventTitle: event.title,
        eventDate: event.date,
        eventLocation: event.location,
        badgeType
      }, null);
    }
  }
  return buffers;
}

async function finishOrReportJob(eventId, job, deliveries, user, context, retryAfterMs = 0) {
  const progress = deliveryProgress(deliveries);
  let status = 'processing';
  let completedAt = '';
  if (progress.pending === 0) {
    status = progress.failed > 0 ? 'completed_with_errors' : 'completed';
    completedAt = job.completedAt || new Date().toISOString();
    if (!job.completedAt) {
      logAudit('event', eventId, 'post_event_communications_completed', user.userDetails, progress, context);
    }
  }
  await upsertPostEventJob(eventId, { status, completedAt });
  return {
    status: 200,
    jsonBody: {
      success: true,
      jobStatus: status,
      progress,
      retryAfterMs
    }
  };
}

function deliveryProgress(deliveries) {
  const progress = { total: deliveries.length, pending: 0, sent: 0, failed: 0 };
  deliveries.forEach(delivery => {
    if (delivery.status === 'sent') progress.sent++;
    else if (delivery.status === 'failed') progress.failed++;
    else progress.pending++;
  });
  return progress;
}

function recipientRowKey(email) {
  return `recipient-${createHash('sha256').update(email).digest('hex').slice(0, 32)}`;
}

function summariseFrozenRecipients(deliveries) {
  return summariseRecipients(deliveries.map(delivery => ({
    ...delivery,
    checkedIn: true
  })));
}

async function deleteBadgeReservation(eventId, badgeId) {
  try {
    await deleteBadge(eventId, badgeId);
  } catch (error) {
    if (error.statusCode !== 404) throw error;
  }
}

async function writeDraftConditionally(eventId, templates) {
  const updates = {
    status: 'draft',
    templatesJson: JSON.stringify(templates)
  };
  for (let attempt = 0; attempt < 3; attempt++) {
    const existing = await getPostEventJob(eventId);
    if (existing && existing.startedAt) return false;
    try {
      if (existing) {
        if (!existing.etag) throw new Error('Post-event draft is missing its concurrency token');
        await updatePostEventJob(eventId, updates, existing.etag);
      } else {
        await createPostEventJob(eventId, updates);
      }
      return true;
    } catch (error) {
      if (!isConflict(error)) throw error;
    }
  }
  return false;
}

async function freezeJobConditionally(eventId, templates, startedBy) {
  const now = new Date().toISOString();
  const updates = {
    status: 'initialising',
    templatesJson: JSON.stringify(templates),
    startedAt: now,
    completedAt: '',
    startedBy,
    snapshotComplete: false
  };
  for (let attempt = 0; attempt < 3; attempt++) {
    const existing = await getPostEventJob(eventId);
    if (existing && existing.startedAt) return { job: existing, resumed: true };
    try {
      if (existing) {
        if (!existing.etag) throw new Error('Post-event job is missing its concurrency token');
        await updatePostEventJob(eventId, updates, existing.etag);
      } else {
        await createPostEventJob(eventId, updates);
      }
      return { job: { ...(existing || {}), ...updates }, resumed: false };
    } catch (error) {
      if (!isConflict(error)) throw error;
    }
  }
  return null;
}

function isDeliveryAvailable(delivery) {
  if (delivery.status === 'pending') return true;
  if (delivery.status !== 'sending') return false;
  const leaseUntil = Date.parse(delivery.leaseUntil || '');
  return !Number.isFinite(leaseUntil) || leaseUntil <= Date.now();
}

async function claimDelivery(eventId, delivery) {
  if (!delivery.etag) throw new Error('Post-event delivery is missing its concurrency token');
  const attempts = Number(delivery.attempts || 0) + 1;
  const operationId = delivery.operationId || emailOperationId(eventId, delivery.email, attempts);
  const updates = {
    status: 'sending',
    attempts,
    operationId,
    leaseUntil: new Date(Date.now() + DELIVERY_LEASE_MS).toISOString()
  };
  try {
    await updatePostEventDelivery(eventId, delivery.rowKey, updates, delivery.etag);
    return { ...delivery, ...updates };
  } catch (error) {
    if (isConflict(error)) return null;
    throw error;
  }
}

function emailOperationId(eventId, email, attempt) {
  const hex = createHash('sha256')
    .update(`${eventId}\0${email}\0${attempt}`)
    .digest('hex')
    .slice(0, 32)
    .split('');
  hex[12] = '5';
  hex[16] = ((Number.parseInt(hex[16], 16) & 3) | 8).toString(16);
  const value = hex.join('');
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`;
}

function isConflict(error) {
  return error && (error.statusCode === 409 || error.statusCode === 412);
}

function isTrue(value) {
  return value === true || value === 'true';
}

function sanitiseTemplates(templates) {
  if (!templates || typeof templates !== 'object') return templates;
  return Object.fromEntries(ROLES.map(role => {
    const template = templates[role] || {};
    return [role, {
      subject: stripHtml(typeof template.subject === 'string' ? template.subject : ''),
      message: stripHtml(typeof template.message === 'string' ? template.message : '')
    }];
  }));
}

function parseTemplates(value) {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

module.exports.deliveryProgress = deliveryProgress;
module.exports.recipientRowKey = recipientRowKey;
module.exports.emailOperationId = emailOperationId;
