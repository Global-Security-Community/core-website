const { app } = require('@azure/functions');
const { sendMessage } = require('../helpers/discordBot');
const { stripHtml } = require('../helpers/sanitise');

// Simple in-memory rate limiting (IP-based)
// In production, consider using Azure Cache for Redis
const rateLimitMap = new Map();

// Get rate limit config from environment variables
const RATE_LIMIT_WINDOW_MS = parseInt(process.env.RATE_LIMIT_WINDOW_MS || '3600000'); // 1 hour in milliseconds
const MAX_REQUESTS_PER_WINDOW = parseInt(process.env.MAX_REQUESTS_PER_WINDOW || '5');

function getClientIP(request) {
  return request.headers.get('x-forwarded-for') || 
         request.headers.get('client-ip') || 
         'unknown';
}

function checkRateLimit(clientIP) {
  const now = Date.now();
  
  if (!rateLimitMap.has(clientIP)) {
    rateLimitMap.set(clientIP, []);
  }
  
  const timestamps = rateLimitMap.get(clientIP);
  
  // Remove old timestamps outside the rate limit window
  const recentTimestamps = timestamps.filter(ts => now - ts < RATE_LIMIT_WINDOW_MS);
  
  if (recentTimestamps.length >= MAX_REQUESTS_PER_WINDOW) {
    return false; // Rate limit exceeded
  }
  
  recentTimestamps.push(now);
  rateLimitMap.set(clientIP, recentTimestamps);
  return true;
}

module.exports = async function (request, context) {
  context.log('Contact form submission received');

  try {
    // Validate request method
    if (request.method !== 'POST') {
      return {
        status: 405,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Method not allowed' })
      };
    }

    // Check rate limit
    const clientIP = getClientIP(request);
    if (!checkRateLimit(clientIP)) {
      context.log(`Rate limit exceeded for IP: ${clientIP}`);
      return {
        status: 429,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Too many requests. Please try again later.' })
      };
    }

    // Extract form data - must parse JSON body in Azure Functions v4
    let body;
    try {
      body = await request.json();
    } catch (parseError) {
      context.log(`JSON parse error: ${parseError.message}`);
      return {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Invalid JSON in request body' })
      };
    }
    const { name, email, subject, message } = body;

    // Validate required fields
    if (!name || !email || !subject || !message) {
      return {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Missing required fields' })
      };
    }

    // Sanitise text fields
    const safeName = stripHtml(name);
    const safeSubject = stripHtml(subject);
    const safeMessage = stripHtml(message);

    // Validate field lengths to prevent abuse
    if (safeName.length > 100 || safeSubject.length > 200 || safeMessage.length > 5000) {
      return {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Field length exceeds maximum allowed' })
      };
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Invalid email format' })
      };
    }

    // Get Discord channel ID from environment
    const discordChannelId = process.env.DISCORD_CONTACT_CHANNEL_ID;
    if (!discordChannelId) {
      context.log('Discord contact channel ID not configured');
      return {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Configuration error' })
      };
    }

    // Format message for Discord
    const discordMessage = {
      embeds: [
        {
          title: '📧 New Contact Form Submission',
          color: 0x20b2aa,
          fields: [
            {
              name: 'Name',
              value: safeName,
              inline: true
            },
            {
              name: 'Email',
              value: email,
              inline: true
            },
            {
              name: 'Subject',
              value: safeSubject,
              inline: false
            },
            {
              name: 'Message',
              value: safeMessage,
              inline: false
            },
            {
              name: 'Submitted',
              value: new Date().toISOString(),
              inline: false
            }
          ],
          footer: {
            text: 'Global Security Community'
          }
        }
      ]
    };

    // Send to Discord via bot
    const sent = await sendMessage(discordChannelId, discordMessage, context);

    if (!sent) {
      context.log('Discord message send failed');
      return {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Failed to send message' })
      };
    }

    context.log('Message sent to Discord successfully');

    return {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        success: true, 
        message: 'Your message has been received. Thank you for contacting us!' 
      })
    };
  } catch (error) {
    context.log(`Error: ${error.message}`);
    return {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
};
