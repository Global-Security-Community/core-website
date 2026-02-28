const { EmailClient } = require('@azure/communication-email');

const connectionString = process.env.AZURE_COMMUNICATION_CONNECTION_STRING || '';
const SENDER_ADDRESS = process.env.ACS_SENDER_ADDRESS || 'DoNotReply@globalsecurity.community';

function getEmailClient() {
  if (!connectionString) {
    throw new Error('AZURE_COMMUNICATION_CONNECTION_STRING is not configured');
  }
  return new EmailClient(connectionString);
}

/**
 * Sends a ticket confirmation email with QR code as inline attachment.
 * qrDataUrl is a data:image/png;base64,... string from the qrcode library.
 */
async function sendTicketEmail(registration, event, qrDataUrl, context) {
  const client = getEmailClient();

  // Extract base64 content from data URI for inline attachment
  const qrBase64 = qrDataUrl ? qrDataUrl.replace(/^data:image\/png;base64,/, '') : '';
  const qrHtml = qrBase64
    ? '<img src="cid:qrcode" alt="Ticket QR Code" style="width: 200px; height: 200px;">'
    : '<p style="color: #999;">[QR code unavailable — use your ticket code at check-in]</p>';

  const message = {
    senderAddress: SENDER_ADDRESS,
    content: {
      subject: `Your Ticket: ${event.title}`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #001f3f; padding: 24px; text-align: center;">
            <h1 style="color: #20b2aa; margin: 0;">Global Security Community</h1>
          </div>
          <div style="padding: 24px; background: #f5f5f5;">
            <h2 style="color: #001f3f;">You're registered! 🎉</h2>
            <p><strong>Event:</strong> ${escapeHtml(event.title)}</p>
            <p><strong>Date:</strong> ${escapeHtml(event.date)}${event.endDate ? ' – ' + escapeHtml(event.endDate) : ''}</p>
            <p><strong>Location:</strong> ${escapeHtml(event.location)}</p>
            <p><strong>Attendee:</strong> ${escapeHtml(registration.fullName)}</p>
            <p><strong>Ticket Code:</strong> ${escapeHtml(registration.ticketCode)}</p>
            <div style="text-align: center; margin: 24px 0;">
              <p style="color: #666; margin-bottom: 8px;">Present this QR code at check-in:</p>
              ${qrHtml}
            </div>
            <p style="color: #666; font-size: 0.9em;">You can also view your tickets at <a href="https://globalsecurity.community/my-tickets/">My Tickets</a>.</p>
          </div>
          <div style="background: #001f3f; padding: 16px; text-align: center;">
            <p style="color: #aaa; margin: 0; font-size: 0.8em;">&copy; ${new Date().getFullYear()} Global Security Community</p>
          </div>
        </div>`
    },
    recipients: {
      to: [{ address: registration.email, displayName: registration.fullName }]
    }
  };

  // Attach QR code as inline image (CID) so email clients render it
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
  const message = {
    senderAddress: SENDER_ADDRESS,
    content: {
      subject: `Your ${badgeType} Badge: ${event.title}`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #001f3f; padding: 24px; text-align: center;">
            <h1 style="color: #20b2aa; margin: 0;">Global Security Community</h1>
          </div>
          <div style="padding: 24px; background: #f5f5f5;">
            <h2 style="color: #001f3f;">Thank you for ${badgeType === 'Speaker' ? 'speaking at' : badgeType === 'Organiser' ? 'organising' : 'attending'} ${escapeHtml(event.title)}! 🏅</h2>
            <p>Your digital ${escapeHtml(badgeType)} badge is attached to this email.</p>
            <p><strong>Event:</strong> ${escapeHtml(event.title)}</p>
            <p><strong>Date:</strong> ${escapeHtml(event.date)}</p>
            <p><strong>Role:</strong> ${escapeHtml(badgeType)}</p>
            <p style="color: #666; font-size: 0.9em;">You can also download your badge from <a href="https://globalsecurity.community/my-tickets/">your account</a>.</p>
          </div>
          <div style="background: #001f3f; padding: 16px; text-align: center;">
            <p style="color: #aaa; margin: 0; font-size: 0.8em;">&copy; ${new Date().getFullYear()} Global Security Community</p>
          </div>
        </div>`
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

/**
 * Sends a cancellation confirmation email.
 */
async function sendCancellationEmail(registration, event, context) {
  const client = getEmailClient();
  const message = {
    senderAddress: SENDER_ADDRESS,
    content: {
      subject: `Registration Cancelled: ${event.title}`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #001f3f; padding: 24px; text-align: center;">
            <h1 style="color: #20b2aa; margin: 0;">Global Security Community</h1>
          </div>
          <div style="padding: 24px; background: #f5f5f5;">
            <h2 style="color: #001f3f;">Registration Cancelled</h2>
            <p>Hi ${escapeHtml(registration.fullName)},</p>
            <p>Your registration for the following event has been cancelled:</p>
            <p><strong>Event:</strong> ${escapeHtml(event.title)}</p>
            <p><strong>Date:</strong> ${escapeHtml(event.date)}${event.endDate ? ' – ' + escapeHtml(event.endDate) : ''}</p>
            <p><strong>Location:</strong> ${escapeHtml(event.location)}</p>
            <p style="color: #666; font-size: 0.9em;">If this was a mistake, you can register again at <a href="https://globalsecurity.community/events/${escapeHtml(event.slug)}/">the event page</a>.</p>
          </div>
          <div style="background: #001f3f; padding: 16px; text-align: center;">
            <p style="color: #aaa; margin: 0; font-size: 0.8em;">&copy; ${new Date().getFullYear()} Global Security Community</p>
          </div>
        </div>`
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

module.exports = { sendTicketEmail, sendBadgeEmail, sendCancellationEmail };
