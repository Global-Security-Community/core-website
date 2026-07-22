const {
  getChapterCardArtwork,
  getChapterHeroArtwork,
  ACTIVE_BADGE_THEME_YEAR
} = require('../helpers/imageGenerator');

const FALLBACK_URL = '/assets/GSC-Shield-Transparent.png';

/**
 * GET /api/chapterArtwork?slug={chapterSlug}&year={year}&variant={card|hero-webp}
 * Public, cached chapter artwork generated from the annual theme.
 */
module.exports = async function chapterArtwork(request, context) {
  try {
    const url = new URL(request.url);
    const slug = (url.searchParams.get('slug') || '').trim().toLowerCase();
    const requestedYear = Number.parseInt(url.searchParams.get('year'), 10);
    const year = Number.isInteger(requestedYear) ? requestedYear : ACTIVE_BADGE_THEME_YEAR;
    const requestedVariant = url.searchParams.get('variant');
    const variant = requestedVariant === 'hero' || requestedVariant === 'hero-webp'
      ? 'hero'
      : 'card';

    if (!/^[a-z0-9][a-z0-9-]{0,60}[a-z0-9]$/.test(slug) ||
        year < 2020 || year > 2100) {
      return redirectToFallback();
    }

    const artwork = variant === 'hero'
      ? await getChapterHeroArtwork(year, slug, context)
      : await getChapterCardArtwork(year, slug);
    if (!artwork) return redirectToFallback();

    return {
      status: 200,
      headers: {
        'Content-Type': 'image/webp',
        'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
        'Content-Length': String(artwork.length)
      },
      body: artwork
    };
  } catch (error) {
    context.log(`chapterArtwork error: ${error.message}`);
    return redirectToFallback();
  }
};

function redirectToFallback() {
  return {
    status: 302,
    headers: {
      Location: FALLBACK_URL,
      'Cache-Control': 'public, max-age=300'
    }
  };
}
