const { getAuthUser, unauthorised } = require('../helpers/auth');
const { storeSubscription, removeSubscription, isSubscribed } = require('../helpers/tableStorage');
const { stripHtml } = require('../helpers/sanitise');

/**
 * POST /api/chapterSubscribe
 * Authenticated users subscribe or unsubscribe from chapter event notifications.
 * Body: { chapterSlug, action: 'subscribe' | 'unsubscribe' }
 */
module.exports = async function (request, context) {
  context.log('Chapter subscription request received');

  try {
    const user = getAuthUser(request);
    if (!user) return unauthorised();

    let body;
    try { body = await request.json(); } catch {
      return { status: 400, headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify({ error: 'Invalid JSON' }) };
    }

    const { chapterSlug, action } = body;

    if (!chapterSlug || !action) {
      return { status: 400, headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify({ error: 'Missing chapterSlug or action' }) };
    }

    if (action !== 'subscribe' && action !== 'unsubscribe' && action !== 'status') {
      return { status: 400, headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify({ error: 'Action must be subscribe, unsubscribe, or status' }) };
    }

    const email = user.userDetails;
    if (!email) {
      return { status: 400, headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify({ error: 'Could not determine user email' }) };
    }

    const safeSlug = stripHtml(chapterSlug).toLowerCase().trim();

    if (action === 'status') {
      const subscribed = await isSubscribed(safeSlug, email);
      return { status: 200, headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify({ subscribed }) };
    }

    if (action === 'subscribe') {
      await storeSubscription(safeSlug, email);
      context.log(`User ${email} subscribed to ${safeSlug}`);
      return { status: 200, headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify({ success: true, subscribed: true, message: 'You will be notified about new events!' }) };
    }

    // unsubscribe
    await removeSubscription(safeSlug, email);
    context.log(`User ${email} unsubscribed from ${safeSlug}`);
    return { status: 200, headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify({ success: true, subscribed: false, message: 'You have been unsubscribed.' }) };
  } catch (error) {
    context.log(`chapterSubscribe error: ${error.message}`);
    return { status: 500, headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify({ error: 'Internal server error' }) };
  }
};
