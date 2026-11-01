const { verifyApprovalToken } = require('../helpers/tokenHelper');
const { getEvent, updateEventPublication } = require('../helpers/tableStorage');
const { publicationTokenId, verifyEventPage, notifyEventSubscribers } = require('../helpers/eventPublication');
const { stripHtml } = require('../helpers/sanitise');
const { logAudit } = require('../helpers/auditLog');
const { sendMessage } = require('../helpers/discordBot');

/**
 * POST /api/eventPublicationResult — signed, attempt-scoped generation/deployment callback.
 */
async function eventPublicationResult(request, context) {
  try {
    let body;
    try { body = await request.json(); } catch {
      return { status: 400, jsonBody: { error: 'Invalid JSON' } };
    }
    if (!body || typeof body !== 'object') {
      return { status: 400, jsonBody: { error: 'Invalid publication result' } };
    }
    const { eventId, chapterSlug, publicationId, token, status, runId, productionSha } = body;
    if (typeof eventId !== 'string' || !eventId || eventId.length > 128 ||
        typeof chapterSlug !== 'string' || !/^[a-z0-9][a-z0-9-]{0,60}[a-z0-9]$/.test(chapterSlug) ||
        typeof publicationId !== 'string' || !/^[a-f0-9-]{36}$/.test(publicationId) ||
        typeof token !== 'string' || !/^[0-9]+\.[a-f0-9]{64}$/.test(token) ||
        !['generated', 'published', 'failed'].includes(status) ||
        typeof runId !== 'string' || !/^[0-9]{1,20}$/.test(runId) ||
        (status === 'published' && (typeof productionSha !== 'string' || !/^[a-f0-9]{40}$/.test(productionSha)))) {
      return { status: 400, jsonBody: { error: 'Invalid publication result' } };
    }
    if (!process.env.APPROVAL_TOKEN_SECRET) throw new Error('Publication token configuration is missing');
    if (!verifyApprovalToken(publicationTokenId(eventId, chapterSlug, publicationId), 'event-publication', token)) {
      context.log(`Rejected invalid event publication token for ${eventId}`);
      return { status: 403, jsonBody: { error: 'Invalid or expired publication token' } };
    }

    const event = await getEvent(chapterSlug, eventId);
    if (!event) return { status: 400, jsonBody: { error: 'Event not found' } };
    if (event.publicationId !== publicationId) {
      return { status: 409, jsonBody: { error: 'This publication attempt has been superseded' } };
    }
    if (status === 'published' && event.publicationStatus !== 'published' && !await verifyEventPage(event)) {
      context.log(`Event page verification failed for ${eventId}: missing event content`);
      return { status: 409, jsonBody: { error: 'The deployed URL does not contain this event page' } };
    }

    const result = await updateEventPublication(chapterSlug, eventId, publicationId, status, {
      publicationRunId: runId,
      ...(status === 'published' ? { publicationProductionSha: productionSha } : {}),
      publicationError: status === 'failed'
        ? stripHtml(typeof body.error === 'string' ? body.error : 'Event generation or deployment failed').slice(0, 500)
        : ''
    });
    if (result.event.publicationId !== publicationId) {
      return { status: 409, jsonBody: { error: 'This publication attempt has been superseded' } };
    }
    if (result.changed) {
      const announcePublication = status === 'published' &&
        result.event.publicationNotificationStatus === 'sending';
      logAudit('event', eventId, `event_publication_${status}`, 'github-actions', {
        chapterSlug, runId, productionSha: productionSha || '', error: result.event.publicationError
      }, context);
      if (announcePublication) {
        await notifyEventSubscribers(result.event, context);
      }
      if (announcePublication || status === 'failed') {
        const channel = process.env.DISCORD_NOTIFICATIONS_CHANNEL_ID;
        if (channel) {
          try {
            const sent = await sendMessage(channel, {
              embeds: [{
                title: status === 'published' ? 'Event published' : 'Event publication failed',
                description: status === 'published'
                  ? `${result.event.title} is now live: https://globalsecurity.community/events/${result.event.slug}/`
                  : `${result.event.title} needs attention. Workflow run: ${runId}`,
                color: status === 'published' ? 0x20b2aa : 0xcc3333
              }]
            }, context);
            if (!sent) context.log(`Discord event publication notification was not delivered for ${eventId}`);
          } catch (error) {
            context.log(`Discord event publication notification failed for ${eventId}: ${error.message}`);
          }
        }
      }
    }
    return { status: 200, jsonBody: { success: true, publicationStatus: result.event.publicationStatus } };
  } catch (error) {
    context.log(`eventPublicationResult error: ${error.message}`);
    return {
      status: error.statusCode === 404 ? 400 : 500,
      jsonBody: { error: error.statusCode === 404 ? 'Event not found' : 'Could not verify or record event publication' }
    };
  }
}

module.exports = eventPublicationResult;
