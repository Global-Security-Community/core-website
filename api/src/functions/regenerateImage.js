const { getAuthUser, hasRole, unauthorised, forbidden } = require('../helpers/auth');
const { getEventBySlug, updateEvent, getApprovedApplicationBySlug, updateApplicationStatus } = require('../helpers/tableStorage');
const { generateChapterBanner, generateChapterShield, generateEventBadgeBackground } = require('../helpers/imageGenerator');

/**
 * POST /api/regenerateImage
 * Admin-only: regenerate an AI-generated image for a chapter or event.
 * Body: { type: 'chapter' | 'event', slug: string }
 */
module.exports = async function (request, context) {
  context.log('Regenerate image request received');

  try {
    const user = getAuthUser(request);
    if (!user) return unauthorised();
    if (!hasRole(user, 'admin')) return forbidden('Only admins can regenerate images');

    let body;
    try { body = await request.json(); } catch {
      return { status: 400, headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify({ error: 'Invalid JSON' }) };
    }

    const { type, slug, chapterSlug } = body;

    if (!type || !slug) {
      return { status: 400, headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify({ error: 'Missing type or slug' }) };
    }

    let imageUrl;

    if (type === 'chapter-shield' || type === 'chapter') {
      const app = await getApprovedApplicationBySlug(slug);
      if (!app) {
        return { status: 400, headers: { 'Content-Type': 'application/json' },
                 body: JSON.stringify({ error: 'Chapter not found' }) };
      }
      const { TableClient } = require('@azure/data-tables');
      const connStr = process.env.AZURE_STORAGE_CONNECTION_STRING;
      const client = TableClient.fromConnectionString(connStr, 'ChapterApplications');

      if (type === 'chapter-shield' || type === 'chapter') {
        imageUrl = await generateChapterShield(app.city, app.country, context);
        await client.updateEntity({ partitionKey: app.partitionKey, rowKey: app.rowKey, shieldImageUrl: imageUrl }, 'Merge');
      }

    } else if (type === 'chapter-banner') {
      const app = await getApprovedApplicationBySlug(slug);
      if (!app) {
        return { status: 400, headers: { 'Content-Type': 'application/json' },
                 body: JSON.stringify({ error: 'Chapter not found' }) };
      }
      imageUrl = await generateChapterBanner(app.city, app.country, context);
      const { TableClient } = require('@azure/data-tables');
      const connStr = process.env.AZURE_STORAGE_CONNECTION_STRING;
      const client = TableClient.fromConnectionString(connStr, 'ChapterApplications');
      await client.updateEntity({ partitionKey: app.partitionKey, rowKey: app.rowKey, bannerImageUrl: imageUrl }, 'Merge');

    } else if (type === 'event') {
      const event = await getEventBySlug(slug);
      if (!event) {
        return { status: 400, headers: { 'Content-Type': 'application/json' },
                 body: JSON.stringify({ error: 'Event not found' }) };
      }
      const city = event.locationCity || event.location || '';
      imageUrl = await generateEventBadgeBackground(event.title, city, slug, context);
      await updateEvent(event.chapterSlug || event.partitionKey, event.rowKey, { badgeImageUrl: imageUrl });

    } else {
      return { status: 400, headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify({ error: 'Type must be chapter or event' }) };
    }

    return {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true, imageUrl })
    };
  } catch (error) {
    context.log(`regenerateImage error: ${error.message}`);
    return { status: 500, headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify({ error: 'Image generation failed. Please try again.' }) };
  }
};
