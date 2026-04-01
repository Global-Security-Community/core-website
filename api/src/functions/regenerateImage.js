// AI image generation disabled until reliable workflow is established.
// To re-enable, restore the original implementation from git history:
//   git show HEAD:api/src/functions/regenerateImage.js
//
// Original imports:
// const { getAuthUser, hasRole, unauthorised, forbidden } = require('../helpers/auth');
// const { getEventBySlug, updateEvent, getApprovedApplicationBySlug } = require('../helpers/tableStorage');
// const { generateChapterBanner, generateChapterShield, generateEventBadgeBackground } = require('../helpers/imageGenerator');

/**
 * POST /api/regenerateImage
 * Admin-only: regenerate an AI-generated image for a chapter or event.
 * Currently disabled — returns 503 until image generation workflow is finalised.
 * Body: { type: 'chapter' | 'event', slug: string }
 */
module.exports = async function (request, context) {
  context.log('Regenerate image request received — currently disabled');
  return {
    status: 503,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ error: 'Image generation is temporarily disabled while we improve the workflow.' })
  };
};
