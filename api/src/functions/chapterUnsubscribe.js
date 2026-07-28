const { removeSubscription } = require('../helpers/tableStorage');
const { verifyUnsubscribeToken } = require('../helpers/unsubscribeToken');

function htmlResponse(status, title, message, token) {
  const form = token && status === 200
    ? `<form method="post">
        <input type="hidden" name="List-Unsubscribe" value="One-Click">
        <button type="submit">Unsubscribe</button>
      </form>`
    : '';

  return {
    status,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'private, no-store'
    },
    body: `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${title}</title></head>
<body>
  <main>
    <h1>${title}</h1>
    <p>${message}</p>
    ${form}
  </main>
</body>
</html>`
  };
}

/**
 * GET/POST /api/chapterUnsubscribe
 * Confirms or completes a signed RFC 8058 one-click unsubscribe request.
 */
module.exports = async function (request, context) {
  let subscription;
  try {
    const token = new URL(request.url).searchParams.get('token');
    subscription = verifyUnsubscribeToken(token);
    if (!subscription) {
      return htmlResponse(400, 'Invalid unsubscribe link', 'This unsubscribe link is invalid or has been changed.');
    }

    if (request.method === 'GET') {
      return htmlResponse(
        200,
        'Unsubscribe from chapter updates',
        'Confirm that you no longer want to receive new event announcements for this chapter.',
        token
      );
    }

    const body = new URLSearchParams(await request.text());
    if (body.get('List-Unsubscribe') !== 'One-Click') {
      return htmlResponse(400, 'Invalid unsubscribe request', 'The unsubscribe request was not in the expected format.');
    }

    await removeSubscription(subscription.chapterSlug, subscription.email);
    context.log(`One-click unsubscribe completed for chapter ${subscription.chapterSlug}`);
    return htmlResponse(200, 'You have been unsubscribed', 'You will no longer receive new event announcements for this chapter.');
  } catch (error) {
    context.log(`chapterUnsubscribe error: ${error.message}`);
    return htmlResponse(500, 'Unable to unsubscribe', 'We could not update your subscription. Please try again later.');
  }
};
