/**
 * Generates branded badges for GSC events.
 * Supports PNG output with AI background (via sharp) or SVG fallback.
 */

const BADGE_COLOURS = {
  Attendee:  { primary: '#20b2aa', secondary: '#001f3f', icon: '🎓' },
  Volunteer: { primary: '#ffa500', secondary: '#001f3f', icon: '🤝' },
  Speaker:   { primary: '#ffa500', secondary: '#001f3f', icon: '🎤' },
  Sponsor:   { primary: '#d97706', secondary: '#001f3f', icon: '💎' },
  Organiser: { primary: '#e74c3c', secondary: '#001f3f', icon: '⭐' }
};

function escSvg(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function truncate(str, max) {
  if (!str) return '';
  return str.length > max ? str.substring(0, max - 1) + '…' : str;
}

/**
 * Generates an SVG text overlay (transparent background) for compositing over an image.
 */
function generateTextOverlay({ recipientName, eventTitle, eventDate, eventLocation, badgeType }) {
  const colours = BADGE_COLOURS[badgeType] || BADGE_COLOURS.Attendee;
  const name = escSvg(truncate(recipientName, 30));
  const title = escSvg(truncate(eventTitle, 40));
  const date = escSvg(truncate(eventDate, 30));
  const location = escSvg(truncate(eventLocation, 35));
  const type = escSvg(badgeType);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024">
  <!-- Semi-transparent overlay for text readability -->
  <rect y="680" width="1024" height="344" fill="rgba(0,15,31,0.85)" rx="0"/>
  <rect y="676" width="1024" height="4" fill="${colours.primary}"/>

  <!-- GSC branding -->
  <text x="60" y="730" font-family="system-ui, -apple-system, sans-serif" font-size="18" fill="#888" letter-spacing="3" font-weight="600">GLOBAL SECURITY COMMUNITY</text>

  <!-- Badge type pill -->
  <rect x="60" y="745" width="${type.length * 16 + 36}" height="36" rx="18" fill="${colours.primary}" opacity="0.9"/>
  <text x="78" y="770" font-family="system-ui, -apple-system, sans-serif" font-size="18" fill="white" font-weight="bold">${type.toUpperCase()}</text>

  <!-- Recipient name -->
  <text x="60" y="830" font-family="system-ui, -apple-system, sans-serif" font-size="48" fill="white" font-weight="bold">${name}</text>

  <!-- Divider -->
  <line x1="60" y1="850" x2="964" y2="850" stroke="${colours.primary}" stroke-width="2" opacity="0.5"/>

  <!-- Event details -->
  <text x="60" y="890" font-family="system-ui, -apple-system, sans-serif" font-size="24" fill="${colours.primary}" font-weight="600">${title}</text>
  <text x="60" y="930" font-family="system-ui, -apple-system, sans-serif" font-size="20" fill="#ccc">${date}</text>
  <text x="60" y="960" font-family="system-ui, -apple-system, sans-serif" font-size="20" fill="#ccc">${location}</text>

  <!-- Verification -->
  <text x="60" y="1000" font-family="system-ui, -apple-system, sans-serif" font-size="14" fill="#666">Verified by Global Security Community</text>
</svg>`;
}

/**
 * Generates a PNG badge by compositing text over an AI-generated background.
 * Falls back to SVG-only if no background image provided.
 *
 * @param {object} opts - Badge options
 * @param {Buffer} [backgroundBuffer] - PNG buffer of AI-generated background
 * @returns {Promise<Buffer>} PNG buffer of final badge
 */
async function generateBadgePng(opts, backgroundBuffer) {
  const sharp = require('sharp');
  const overlaySvg = generateTextOverlay(opts);
  const overlayBuffer = Buffer.from(overlaySvg);

  if (backgroundBuffer) {
    // Composite text overlay on AI background
    const resized = await sharp(backgroundBuffer)
      .resize(1024, 1024, { fit: 'cover' })
      .png()
      .toBuffer();

    return await sharp(resized)
      .composite([{ input: overlayBuffer, top: 0, left: 0 }])
      .png()
      .toBuffer();
  }

  // Fallback: generate a gradient background
  const fallbackBg = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#001f3f"/>
          <stop offset="100%" style="stop-color:#003366"/>
        </linearGradient>
      </defs>
      <rect width="1024" height="1024" fill="url(#bg)"/>
      <circle cx="900" cy="150" r="200" fill="#20b2aa" opacity="0.08"/>
      <circle cx="100" cy="600" r="150" fill="#20b2aa" opacity="0.05"/>
    </svg>`
  );

  const bg = await sharp(fallbackBg).png().toBuffer();
  return await sharp(bg)
    .composite([{ input: overlayBuffer, top: 0, left: 0 }])
    .png()
    .toBuffer();
}

/**
 * Legacy SVG badge generator (kept for backward compatibility).
 */
function generateBadge({ recipientName, eventTitle, eventDate, eventLocation, badgeType }) {
  const colours = BADGE_COLOURS[badgeType] || BADGE_COLOURS.Attendee;
  const name = escSvg(truncate(recipientName, 40));
  const title = escSvg(truncate(eventTitle, 50));
  const date = escSvg(truncate(eventDate, 30));
  const location = escSvg(truncate(eventLocation, 45));
  const type = escSvg(badgeType);

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 300" width="500" height="300">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:${colours.secondary};stop-opacity:1"/>
      <stop offset="100%" style="stop-color:#003366;stop-opacity:1"/>
    </linearGradient>
  </defs>
  <rect width="500" height="300" rx="16" fill="url(#bg)"/>
  <rect y="0" width="500" height="6" rx="3" fill="${colours.primary}"/>
  <text x="30" y="42" font-family="system-ui, -apple-system, sans-serif" font-size="13" fill="#999" letter-spacing="2">GLOBAL SECURITY COMMUNITY</text>
  <rect x="30" y="56" width="${type.length * 11 + 24}" height="28" rx="14" fill="${colours.primary}" opacity="0.9"/>
  <text x="42" y="75" font-family="system-ui, -apple-system, sans-serif" font-size="13" fill="white" font-weight="bold">${type.toUpperCase()}</text>
  <text x="30" y="120" font-family="system-ui, -apple-system, sans-serif" font-size="28" fill="white" font-weight="bold">${name}</text>
  <line x1="30" y1="140" x2="470" y2="140" stroke="${colours.primary}" stroke-width="1" opacity="0.4"/>
  <text x="30" y="172" font-family="system-ui, -apple-system, sans-serif" font-size="16" fill="${colours.primary}" font-weight="600">${title}</text>
  <text x="30" y="200" font-family="system-ui, -apple-system, sans-serif" font-size="13" fill="#ccc">📅 ${date}</text>
  <text x="30" y="222" font-family="system-ui, -apple-system, sans-serif" font-size="13" fill="#ccc">📍 ${location}</text>
  <text x="30" y="272" font-family="system-ui, -apple-system, sans-serif" font-size="10" fill="#666">Verified by Global Security Community • globalsecurity.community</text>
  <circle cx="460" cy="260" r="25" fill="${colours.primary}" opacity="0.15"/>
  <circle cx="470" cy="40" r="15" fill="${colours.primary}" opacity="0.1"/>
</svg>`;
}

module.exports = { generateBadge, generateBadgePng, generateTextOverlay };
