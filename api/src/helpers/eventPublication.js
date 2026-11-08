const { Octokit } = require('@octokit/rest');
const { createAppAuth } = require('@octokit/auth-app');
const { claimEventPublication, updateEventPublication, getSubscriptionsByChapter, updateEvent } = require('./tableStorage');
const { generateApprovalToken } = require('./tokenHelper');
const { dispatchWithRetry } = require('./githubDispatch');
const { stripHtml } = require('./sanitise');
const { sendEventNotificationEmail } = require('./emailService');
const { logAudit } = require('./auditLog');

function publicationTokenId(eventId, chapterSlug, publicationId) {
  return `${eventId}:${chapterSlug}:${publicationId}`;
}

function eventPublicationResponse(event) {
  const owner = process.env.GITHUB_REPO_OWNER;
  const repo = process.env.GITHUB_REPO_NAME;
  const updatedAt = Date.parse(event.publicationUpdatedAt || '');
  const ageMs = Number.isFinite(updatedAt) ? Date.now() - updatedAt : Infinity;
  const stalled =
    (event.publicationStatus === 'dispatching' && ageMs >= 15 * 60 * 1000) ||
    (['queued', 'generated'].includes(event.publicationStatus) && ageMs >= 2 * 60 * 60 * 1000);
  return {
    id: event.rowKey,
    slug: event.slug,
    title: event.title,
    chapterSlug: event.chapterSlug || event.partitionKey,
    status: event.status,
    publication: {
      status: stalled ? 'stalled' : event.publicationStatus || 'untracked',
      error: stalled ? 'Publication has stopped reporting progress. Check the workflow and retry publication.' : event.publicationError || '',
      generatedAt: event.publicationGeneratedAt || '',
      updatedAt: event.publicationUpdatedAt || '',
      runUrl: event.publicationRunId && owner && repo
        ? `https://github.com/${owner}/${repo}/actions/runs/${event.publicationRunId}`
        : '',
      notificationStatus: event.publicationNotificationStatus || 'not-required',
      notificationError: event.publicationNotificationError || ''
    }
  };
}

async function queueEventPublication(chapterSlug, eventId, actor, context) {
  const claim = await claimEventPublication(chapterSlug, eventId);
  if (!claim.claimed) {
    return {
      queued: false,
      event: claim.event,
      ...(['pending', 'failed'].includes(claim.event.publicationStatus)
        ? { error: claim.event.publicationError || 'Publication state changed. Please retry.' }
        : {})
    };
  }
  const event = claim.event;

  try {
    if (!/^[a-zA-Z0-9-]{1,128}$/.test(eventId) ||
        !/^[a-z0-9][a-z0-9-]{0,60}[a-z0-9]$/.test(chapterSlug) ||
        !/^[a-z0-9](?:[a-z0-9-]{0,78}[a-z0-9])?$/.test(event.slug || '')) {
      throw new Error('The saved event has invalid publication identifiers');
    }
    const appId = process.env.GITHUB_APP_ID;
    const privateKey = (process.env.GITHUB_APP_PRIVATE_KEY || '').replace(/\\n/g, '\n');
    const installationId = process.env.GITHUB_APP_INSTALLATION_ID;
    const owner = process.env.GITHUB_REPO_OWNER;
    const repo = process.env.GITHUB_REPO_NAME;
    if (!appId || !privateKey || !installationId || !owner || !repo) {
      throw new Error('GitHub App configuration is incomplete');
    }

    const token = generateApprovalToken(
      publicationTokenId(eventId, chapterSlug, event.publicationId),
      'event-publication'
    );
    const octokit = new Octokit({
      authStrategy: createAppAuth,
      auth: { appId, privateKey, installationId }
    });
    await dispatchWithRetry(octokit, {
      owner,
      repo,
      event_type: 'event-created',
      client_payload: {
        event_id: eventId,
        event_title: event.title,
        event_slug: event.slug,
        event_date: event.date,
        event_location: event.location,
        event_description: stripHtml(event.description),
        event_sessionize_id: event.sessionizeApiId || '',
        event_registration_cap: String(event.registrationCap || 0),
        chapter_slug: chapterSlug,
        publication: {
          id: event.publicationId,
          token
        }
      }
    });
    const result = await updateEventPublication(chapterSlug, eventId, event.publicationId, 'queued', {
      publicationDispatchedAt: new Date().toISOString()
    });
    logAudit('event', eventId, 'event_publication_queued', actor, {
      chapterSlug, attempt: event.publicationAttempts
    }, context);
    return { queued: true, event: result.event };
  } catch (error) {
    const message = stripHtml(String(error.message || 'Unknown publication dispatch error')).slice(0, 500);
    context.log(`Event publication dispatch failed for ${eventId}: ${message}`);
    const result = await updateEventPublication(chapterSlug, eventId, event.publicationId, 'failed', {
      publicationError: message
    });
    logAudit('event', eventId, 'event_publication_failed', actor, {
      chapterSlug, error: message, attempt: event.publicationAttempts
    }, context);
    return { queued: false, event: result.event, error: message };
  }
}

async function verifyEventPage(event) {
  if (!/^[a-z0-9](?:[a-z0-9-]{0,78}[a-z0-9])?$/.test(event.slug || '')) {
    throw new Error('Invalid stored event slug');
  }
  const response = await fetch(
    `https://globalsecurity.community/events/${event.slug}/?publication=${encodeURIComponent(event.publicationId)}`,
    {
      headers: { 'Cache-Control': 'no-cache', 'User-Agent': 'GSC-EventPublication/1.0' },
      signal: AbortSignal.timeout(30000)
    }
  );
  if (!response.ok) throw new Error(`Event page verification returned HTTP ${response.status}`);
  if (!(response.headers.get('content-type') || '').includes('text/html')) return false;
  const html = await response.text();
  const marker = new RegExp(
    `<div\\b(?=[^>]*\\bclass="[^"]*\\bevent-detail\\b[^"]*")(?=[^>]*\\bdata-event-slug="${event.slug}")[^>]*>`
  );
  return marker.test(html);
}

async function notifyEventSubscribers(event, context) {
  const chapterSlug = event.chapterSlug || event.partitionKey;
  let errorMessage = '';
  try {
    const subscribers = await getSubscriptionsByChapter(chapterSlug);
    let failed = 0;
    for (const subscriber of subscribers) {
      try {
        const sent = await sendEventNotificationEmail(subscriber.email, event, context);
        if (!sent) throw new Error('Email delivery failed');
      } catch (error) {
        failed += 1;
        context.log(`Event publication notification failed for ${event.rowKey}: ${error.message}`);
      }
    }
    if (failed) errorMessage = `${failed} of ${subscribers.length} subscriber notifications failed`;
  } catch (error) {
    errorMessage = 'Could not load chapter subscribers';
    context.log(`Event publication notifications failed for ${event.rowKey}: ${error.message}`);
  }
  await updateEvent(chapterSlug, event.rowKey, {
    publicationNotificationStatus: errorMessage ? 'failed' : 'sent',
    publicationNotificationError: errorMessage
  });
}

module.exports = {
  publicationTokenId,
  eventPublicationResponse,
  queueEventPublication,
  verifyEventPage,
  notifyEventSubscribers
};
