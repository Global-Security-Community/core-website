const { EmailClient } = require('@azure/communication-email');

const connectionString = process.env.AZURE_COMMUNICATION_CONNECTION_STRING || '';
const SENDER_ADDRESS = process.env.ACS_SENDER_ADDRESS || 'DoNotReply@globalsecurity.community';
const LOGO_URL = 'https://globalsecurity.community/assets/GSC-Shield-Transparent.png';
const SITE_URL = 'https://globalsecurity.community';

function getEmailClient() {
  if (!connectionString) {
    throw new Error('AZURE_COMMUNICATION_CONNECTION_STRING is not configured');
  }
  return new EmailClient(connectionString);
}

/**
 * Wraps email body content in a consistent branded layout.
 */
function emailLayout(bodyHtml) {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#e9ecef;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;">
    <!-- Header -->
    <div style="background:#001f3f;padding:24px;text-align:center;">
      <img src="${LOGO_URL}" alt="GSC" width="48" height="48" style="display:inline-block;vertical-align:middle;margin-right:12px;">
      <span style="color:#20b2aa;font-size:1.4rem;font-weight:700;vertical-align:middle;">Global Security Community</span>
    </div>
    <!-- Teal accent bar -->
    <div style="height:4px;background:linear-gradient(90deg,#20b2aa,#178a84);"></div>
    <!-- Body -->
    <div style="padding:32px 28px;">
      ${bodyHtml}
    </div>
    <!-- Footer -->
    <div style="background:#001f3f;padding:20px 28px;text-align:center;">
      <p style="color:#8899aa;margin:0 0 8px 0;font-size:0.8em;">
        <a href="${SITE_URL}" style="color:#20b2aa;text-decoration:none;">globalsecurity.community</a>
      </p>
      <p style="color:#556677;margin:0;font-size:0.75em;">&copy; ${new Date().getFullYear()} Global Security Community. All rights reserved.</p>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Renders an event detail block used across email templates.
 */
function eventDetailsBlock(event) {
  const locationHtml = event.location ? escapeHtml(event.location).replace(/\n/g, '<br>') : '';
  return `
    <table style="width:100%;border-collapse:collapse;margin:16px 0;">
      <tr>
        <td style="padding:8px 12px;border-left:3px solid #20b2aa;background:#f8f9fa;">
          <p style="margin:0 0 4px 0;font-weight:600;color:#001f3f;">${escapeHtml(event.title)}</p>
          <p style="margin:0;font-size:0.9em;color:#555;">📅 ${escapeHtml(event.date)}${event.endDate ? ' – ' + escapeHtml(event.endDate) : ''}</p>
          ${locationHtml ? '<p style="margin:4px 0 0 0;font-size:0.9em;color:#555;">📍 ' + locationHtml + '</p>' : ''}
        </td>
      </tr>
    </table>`;
}

/**
 * Sends a ticket confirmation email with QR code as inline attachment.
 */
async function sendTicketEmail(registration, event, qrDataUrl, context, partners) {
  const client = getEmailClient();

  const qrBase64 = qrDataUrl ? qrDataUrl.replace(/^data:image\/png;base64,/, '') : '';
  const qrHtml = qrBase64
    ? '<img src="cid:qrcode" alt="Ticket QR Code" style="width:180px;height:180px;">'
    : '<p style="color:#999;">[QR code unavailable — use your ticket code at check-in]</p>';

  const eventPageUrl = event.slug ? `${SITE_URL}/events/${escapeHtml(event.slug)}/` : '';
  const chapterName = event.chapterSlug
    ? event.chapterSlug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
    : '';
  const discordInvite = 'https://discord.gg/mDRWDkCNPq';

  const bodyHtml = `
    <h2 style="color:#001f3f;margin:0 0 8px 0;">You're registered! 🎉</h2>
    <p style="color:#555;margin:0 0 20px 0;">Hi ${escapeHtml(registration.fullName)}, your ticket is confirmed.</p>
    ${eventDetailsBlock(event)}
    <div style="text-align:center;margin:28px 0;padding:24px;background:#f8f9fa;border-radius:8px;">
      <p style="color:#666;margin:0 0 12px 0;font-size:0.9em;">Present this QR code at check-in:</p>
      ${qrHtml}
      <p style="margin:12px 0 0 0;font-family:'Courier New',monospace;font-size:1.3em;font-weight:700;color:#001f3f;letter-spacing:0.1em;">${escapeHtml(registration.ticketCode)}</p>
    </div>
    <div style="text-align:center;margin:0 0 24px 0;">
      ${eventPageUrl ? '<a href="' + eventPageUrl + '" style="display:inline-block;padding:10px 24px;background:#20b2aa;color:#fff;border-radius:6px;text-decoration:none;font-weight:600;margin:4px;">View Event</a>' : ''}
      <a href="${SITE_URL}/my-tickets/" style="display:inline-block;padding:10px 24px;background:#20b2aa;color:#fff;border-radius:6px;text-decoration:none;font-weight:600;margin:4px;">My Tickets</a>
    </div>
    <div style="margin:24px 0 0 0;padding:20px;background:#f0faf9;border-radius:8px;border-left:3px solid #20b2aa;">
      <p style="margin:0 0 8px 0;font-weight:600;color:#001f3f;">💬 Join us on Discord</p>
      <p style="margin:0 0 12px 0;color:#555;font-size:0.9em;">Connect with ${chapterName ? 'the <strong>' + escapeHtml(chapterName) + '</strong> chapter and ' : ''}the wider GSC community — chat about the event, ask questions, and meet fellow attendees.</p>
      <a href="${discordInvite}" style="display:inline-block;padding:8px 20px;background:#5865F2;color:#fff;border-radius:6px;text-decoration:none;font-weight:600;font-size:0.9em;">Join Discord</a>
    </div>${buildPartnerEmailHtml(partners)}`;

  const message = {
    senderAddress: SENDER_ADDRESS,
    content: {
      subject: `Your Ticket: ${event.title}`,
      html: emailLayout(bodyHtml)
    },
    recipients: {
      to: [{ address: registration.email, displayName: registration.fullName }]
    }
  };

  if (qrBase64) {
    message.attachments = [
      {
        name: 'qrcode.png',
        contentType: 'image/png',
        contentInBase64: qrBase64,
        contentId: 'qrcode'
      }
    ];
  }

  try {
    const poller = await client.beginSend(message);
    const result = await poller.pollUntilDone();
    if (context) context.log(`Ticket email sent to ${registration.email}, status: ${result.status}`);
    return result;
  } catch (err) {
    if (context) context.log(`Ticket email failed: ${err.message}`);
    throw err;
  }
}

/**
 * Sends a digital badge email with SVG attachment.
 */
async function sendBadgeEmail(recipient, badgeSvg, event, badgeType, context) {
  const client = getEmailClient();
  const badgeBuffer = Buffer.from(badgeSvg, 'utf-8');

  const roleMessages = {
    'Speaker': { roleText: 'speaking at', gratitude: 'Your knowledge sharing inspires the community.' },
    'Organiser': { roleText: 'organising', gratitude: 'Your leadership drives the community forward.' },
    'Volunteer': { roleText: 'volunteering at', gratitude: 'Your contribution made this event possible.' },
    'Sponsor': { roleText: 'sponsoring', gratitude: 'Your support helps us build the security community.' },
    'Attendee': { roleText: 'attending', gratitude: '' }
  };
  const msg = roleMessages[badgeType] || roleMessages['Attendee'];
  const bodyHtml = `
    <h2 style="color:#001f3f;margin:0 0 8px 0;">Thank you for ${msg.roleText} ${escapeHtml(event.title)}! 🏅</h2>
    <p style="color:#555;margin:0 0 20px 0;">Your digital <strong>${escapeHtml(badgeType)}</strong> badge is attached to this email.${msg.gratitude ? ' ' + msg.gratitude : ''}</p>
    ${eventDetailsBlock(event)}
    <p style="text-align:center;margin-top:24px;">
      <a href="${SITE_URL}/my-tickets/" style="display:inline-block;padding:10px 24px;background:#20b2aa;color:#fff;border-radius:6px;text-decoration:none;font-weight:600;">View My Account</a>
    </p>`;

  const message = {
    senderAddress: SENDER_ADDRESS,
    content: {
      subject: `Your ${badgeType} Badge: ${event.title}`,
      html: emailLayout(bodyHtml)
    },
    recipients: {
      to: [{ address: recipient.email, displayName: recipient.name }]
    },
    attachments: [
      {
        name: `gsc-badge-${badgeType.toLowerCase()}.svg`,
        contentType: 'image/svg+xml',
        contentInBase64: badgeBuffer.toString('base64')
      }
    ]
  };

  try {
    const poller = await client.beginSend(message);
    const result = await poller.pollUntilDone();
    if (context) context.log(`Badge email sent to ${recipient.email}, status: ${result.status}`);
    return result;
  } catch (err) {
    if (context) context.log(`Badge email failed: ${err.message}`);
    throw err;
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function buildPartnerEmailHtml(partners) {
  if (!partners || partners.length === 0) return '';
  // Group by tier
  const tiers = {};
  partners.forEach(p => {
    const tier = p.tier || 'Community Partners';
    if (!tiers[tier]) tiers[tier] = [];
    tiers[tier].push(p);
  });
  let html = '<div style="margin:24px 0 0 0;padding:20px;background:#f8f9fa;border-radius:8px;text-align:center;">';
  html += '<p style="font-weight:600;color:#001f3f;margin:0 0 12px 0;">🤝 Community Partners</p>';
  for (const [tierName, items] of Object.entries(tiers)) {
    if (Object.keys(tiers).length > 1) {
      html += `<p style="font-size:0.8em;color:#888;margin:8px 0 4px 0;">${escapeHtml(tierName)}</p>`;
    }
    items.forEach(p => {
      const logoSrc = p.logoBase64 ? `data:${p.logoContentType || 'image/png'};base64,${p.logoBase64}` : '';
      if (logoSrc) {
        html += `<img src="${logoSrc}" alt="${escapeHtml(p.name)}" style="max-width:120px;max-height:60px;margin:4px 8px;vertical-align:middle;">`;
      } else {
        html += `<span style="display:inline-block;margin:4px 8px;font-size:0.9em;color:#555;">${escapeHtml(p.name)}</span>`;
      }
    });
  }
  html += '</div>';
  return html;
}

/**
 * Sends a cancellation confirmation email.
 */
async function sendCancellationEmail(registration, event, context) {
  const client = getEmailClient();

  const bodyHtml = `
    <h2 style="color:#001f3f;margin:0 0 8px 0;">Registration Cancelled</h2>
    <p style="color:#555;margin:0 0 20px 0;">Hi ${escapeHtml(registration.fullName)}, your registration has been cancelled for:</p>
    ${eventDetailsBlock(event)}
    <p style="color:#666;font-size:0.9em;margin-top:20px;">If this was a mistake, you can register again from the event page.</p>
    <p style="text-align:center;margin-top:24px;">
      <a href="${SITE_URL}/events/${escapeHtml(event.slug)}/" style="display:inline-block;padding:10px 24px;background:#20b2aa;color:#fff;border-radius:6px;text-decoration:none;font-weight:600;">View Event</a>
    </p>`;

  const message = {
    senderAddress: SENDER_ADDRESS,
    content: {
      subject: `Registration Cancelled: ${event.title}`,
      html: emailLayout(bodyHtml)
    },
    recipients: {
      to: [{ address: registration.email, displayName: registration.fullName }]
    }
  };

  try {
    const poller = await client.beginSend(message);
    const result = await poller.pollUntilDone();
    if (context) context.log(`Cancellation email sent to ${registration.email}, status: ${result.status}`);
    return result;
  } catch (err) {
    if (context) context.log(`Cancellation email failed: ${err.message}`);
    throw err;
  }
}

/**
 * Sends a new event notification email to chapter subscribers.
 */
async function sendEventNotificationEmail(subscriberEmail, event, context) {
  const client = getEmailClient();
  const chapterName = event.chapterSlug
    ? event.chapterSlug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
    : 'your chapter';

  const eventPageUrl = event.slug ? `${SITE_URL}/events/${escapeHtml(event.slug)}/` : SITE_URL;
  const registerUrl = event.slug ? `${SITE_URL}/register/?event=${escapeHtml(event.slug)}` : SITE_URL;

  const bodyHtml = `
    <h2 style="color:#001f3f;margin:0 0 8px 0;">New Event: ${escapeHtml(event.title)} 🎉</h2>
    <p style="color:#555;margin:0 0 20px 0;">A new event has been announced for the <strong>${escapeHtml(chapterName)}</strong> chapter!</p>
    ${eventDetailsBlock(event)}
    <div style="text-align:center;margin:24px 0;">
      <a href="${registerUrl}" style="display:inline-block;padding:12px 28px;background:#20b2aa;color:#fff;border-radius:6px;text-decoration:none;font-weight:600;font-size:1.1em;">Register Now</a>
    </div>
    <p style="text-align:center;margin-top:16px;">
      <a href="${eventPageUrl}" style="color:#20b2aa;text-decoration:none;font-size:0.9em;">View event details →</a>
    </p>
    <p style="color:#999;font-size:0.8em;text-align:center;margin-top:24px;">
      You received this because you subscribed to ${escapeHtml(chapterName)} chapter updates.
      <a href="${SITE_URL}/chapters/${escapeHtml(event.chapterSlug)}/" style="color:#20b2aa;">Manage preferences</a>
    </p>`;

  const message = {
    senderAddress: SENDER_ADDRESS,
    content: {
      subject: `New Event: ${event.title}`,
      html: emailLayout(bodyHtml)
    },
    recipients: {
      to: [{ address: subscriberEmail }]
    }
  };

  try {
    const poller = await client.beginSend(message);
    const result = await poller.pollUntilDone();
    if (context) context.log(`Event notification sent to ${subscriberEmail}, status: ${result.status}`);
    return result;
  } catch (err) {
    if (context) context.log(`Event notification email failed for ${subscriberEmail}: ${err.message}`);
  }
}

module.exports = { sendTicketEmail, sendBadgeEmail, sendCancellationEmail, sendEventNotificationEmail };
