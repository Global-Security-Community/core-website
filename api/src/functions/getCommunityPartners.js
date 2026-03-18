const { getPartnersByEvent, getPartnersByChapter } = require('../helpers/tableStorage');

/**
 * GET /api/getCommunityPartners?eventId=x  — partners for a specific event
 * GET /api/getCommunityPartners?chapterSlug=x — all partners across chapter events
 * Public endpoint.
 */
module.exports = async function (request, context) {
  try {
    const url = new URL(request.url);
    const eventId = url.searchParams.get('eventId');
    const chapterSlug = url.searchParams.get('chapterSlug');

    if (!eventId && !chapterSlug) {
      return { status: 400, headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify({ error: 'Missing eventId or chapterSlug parameter' }) };
    }

    let partners;
    if (eventId) {
      partners = await getPartnersByEvent(eventId);
    } else {
      partners = await getPartnersByChapter(chapterSlug);
    }

    // Group by tier
    const tiers = {};
    partners.forEach(function(p) {
      const tier = p.tier || 'Community Partners';
      if (!tiers[tier]) tiers[tier] = [];
      tiers[tier].push({
        id: p.id,
        name: p.name,
        logoDataUrl: p.logoBase64 ? 'data:' + p.logoContentType + ';base64,' + p.logoBase64 : '',
        website: p.website || '',
        eventTitle: p.eventTitle || '',
        eventSlug: p.eventSlug || ''
      });
    });

    return {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=300' },
      body: JSON.stringify({ partners: tiers })
    };
  } catch (error) {
    context.log(`getCommunityPartners error: ${error.message}`);
    return { status: 500, headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify({ error: 'Internal server error' }) };
  }
};
