const { getSessionizeCache } = require('../helpers/tableStorage');

/**
 * GET /api/getSessionizeData?sessionizeId={id}&type=speakers|agenda
 * Public endpoint returning cached Sessionize data.
 */
module.exports = async function (request, context) {
  try {
    const url = new URL(request.url);
    const sessionizeId = url.searchParams.get('sessionizeId');
    const type = url.searchParams.get('type') || 'speakers';

    if (!sessionizeId) {
      return { status: 400, headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify({ error: 'Missing sessionizeId parameter' }) };
    }

    if (type !== 'speakers' && type !== 'agenda') {
      return { status: 400, headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify({ error: 'Type must be speakers or agenda' }) };
    }

    const cached = await getSessionizeCache(sessionizeId, type);
    if (!cached) {
      return { status: 404, headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify({ error: 'No cached data found. Use the dashboard to refresh.' }) };
    }

    return {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=300' },
      body: JSON.stringify({
        data: cached.data,
        lastRefreshed: cached.lastRefreshed
      })
    };
  } catch (error) {
    context.log(`getSessionizeData error: ${error.message}`);
    return { status: 500, headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify({ error: 'Internal server error' }) };
  }
};
