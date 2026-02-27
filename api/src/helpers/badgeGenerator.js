/**
 * Generates branded SVG badges for GSC events.
 * Three types: Attendee, Speaker, Organiser
 */

const BADGE_COLOURS = {
  Attendee:  { primary: '#20b2aa', secondary: '#001f3f', icon: '🎓' },
  Speaker:   { primary: '#ffa500', secondary: '#001f3f', icon: '🎤' },
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
 * @param {object} opts
 * @param {string} opts.recipientName
 * @param {string} opts.eventTitle
 * @param {string} opts.eventDate
 * @param {string} opts.eventLocation
 * @param {string} opts.badgeType - 'Attendee' | 'Speaker' | 'Organiser'
 * @returns {string} SVG markup
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

  <!-- Background -->
  <rect width="500" height="300" rx="16" fill="url(#bg)"/>

  <!-- Accent bar -->
  <rect y="0" width="500" height="6" rx="3" fill="${colours.primary}"/>

  <!-- GSC branding -->
  <text x="30" y="42" font-family="system-ui, -apple-system, sans-serif" font-size="13" fill="#999" letter-spacing="2">GLOBAL SECURITY COMMUNITY</text>

  <!-- Badge type -->
  <rect x="30" y="56" width="${type.length * 11 + 24}" height="28" rx="14" fill="${colours.primary}" opacity="0.9"/>
  <text x="42" y="75" font-family="system-ui, -apple-system, sans-serif" font-size="13" fill="white" font-weight="bold">${type.toUpperCase()}</text>

  <!-- Recipient name -->
  <text x="30" y="120" font-family="system-ui, -apple-system, sans-serif" font-size="28" fill="white" font-weight="bold">${name}</text>

  <!-- Divider -->
  <line x1="30" y1="140" x2="470" y2="140" stroke="${colours.primary}" stroke-width="1" opacity="0.4"/>

  <!-- Event details -->
  <text x="30" y="172" font-family="system-ui, -apple-system, sans-serif" font-size="16" fill="${colours.primary}" font-weight="600">${title}</text>
  <text x="30" y="200" font-family="system-ui, -apple-system, sans-serif" font-size="13" fill="#ccc">📅 ${date}</text>
  <text x="30" y="222" font-family="system-ui, -apple-system, sans-serif" font-size="13" fill="#ccc">📍 ${location}</text>

  <!-- Verification -->
  <text x="30" y="272" font-family="system-ui, -apple-system, sans-serif" font-size="10" fill="#666">Verified by Global Security Community • globalsecurity.community</text>

  <!-- Decorative corner -->
  <circle cx="460" cy="260" r="25" fill="${colours.primary}" opacity="0.15"/>
  <circle cx="470" cy="40" r="15" fill="${colours.primary}" opacity="0.1"/>
</svg>`;
}

module.exports = { generateBadge };
