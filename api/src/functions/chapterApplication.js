const { randomUUID } = require('crypto');
const { storeApplication } = require('../helpers/tableStorage');
const { generateApprovalToken } = require('../helpers/tokenHelper');
const { sendMessage } = require('../helpers/discordBot');
const { sanitiseFields } = require('../helpers/sanitise');

const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW_MS = parseInt(process.env.RATE_LIMIT_WINDOW_MS || '3600000');
const MAX_REQUESTS_PER_WINDOW = parseInt(process.env.MAX_CHAPTER_REQUESTS_PER_WINDOW || '3');

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
  const timestamps = rateLimitMap.get(clientIP).filter(ts => now - ts < RATE_LIMIT_WINDOW_MS);
  if (timestamps.length >= MAX_REQUESTS_PER_WINDOW) {
    return false;
  }
  timestamps.push(now);
  rateLimitMap.set(clientIP, timestamps);
  return true;
}

module.exports = async function (request, context) {
  context.log('Chapter application received');

  try {
    const clientIP = getClientIP(request);
    if (!checkRateLimit(clientIP)) {
      return {
        status: 429,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Too many requests. Please try again later.' })
      };
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Invalid JSON in request body' })
      };
    }

    const { fullName, email, city, country, linkedIn, aboutYou, whyLead, existingCommunity, website,
            secondLeadName, secondLeadEmail, secondLeadLinkedIn, secondLeadAbout } = body;

    // Honeypot check — 'website' field should be empty (hidden from real users)
    if (website) {
      context.log('Honeypot triggered, rejecting submission');
      return {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: true, message: 'Your application has been received. We will review it shortly!' })
      };
    }

    // Validate required fields
    if (!fullName || !email || !city || !country || !aboutYou || !whyLead) {
      return {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Please fill in all required fields.' })
      };
    }

    // Validate field lengths
    if (fullName.length > 100 || city.length > 100 || country.length > 100 || aboutYou.length > 2000 || whyLead.length > 2000) {
      return {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'One or more fields exceed the maximum allowed length.' })
      };
    }

    // Validate email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Please enter a valid email address.' })
      };
    }

    // Validate LinkedIn URL if provided
    if (linkedIn && !linkedIn.match(/^https?:\/\/(www\.)?linkedin\.com\//i)) {
      return {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Please enter a valid LinkedIn URL.' })
      };
    }

    // Validate second lead fields if partially filled
    if (secondLeadName || secondLeadEmail || secondLeadAbout) {
      if (secondLeadName && secondLeadName.length > 100) {
        return {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'Second lead name exceeds maximum length.' })
        };
      }
      if (secondLeadEmail && !emailRegex.test(secondLeadEmail)) {
        return {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'Please enter a valid email for the second lead.' })
        };
      }
      if (secondLeadLinkedIn && !secondLeadLinkedIn.match(/^https?:\/\/(www\.)?linkedin\.com\//i)) {
        return {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'Please enter a valid LinkedIn URL for the second lead.' })
        };
      }
    }

    const applicationId = randomUUID();
    const sanitised = sanitiseFields(
      { fullName, email, city, country, linkedIn, aboutYou, whyLead, existingCommunity,
        secondLeadName, secondLeadEmail, secondLeadLinkedIn, secondLeadAbout },
      ['fullName', 'city', 'country', 'aboutYou', 'whyLead', 'existingCommunity',
       'secondLeadName', 'secondLeadAbout']
    );
    const application = {
      id: applicationId,
      fullName: sanitised.fullName.trim(),
      email: email.trim(),
      city: sanitised.city.trim(),
      country: sanitised.country.trim(),
      linkedIn: linkedIn ? linkedIn.trim() : '',
      aboutYou: sanitised.aboutYou.trim(),
      whyLead: sanitised.whyLead.trim(),
      existingCommunity: sanitised.existingCommunity ? sanitised.existingCommunity.trim() : '',
      secondLeadName: sanitised.secondLeadName ? sanitised.secondLeadName.trim() : '',
      secondLeadEmail: secondLeadEmail ? secondLeadEmail.trim() : '',
      secondLeadLinkedIn: secondLeadLinkedIn ? secondLeadLinkedIn.trim() : '',
      secondLeadAbout: sanitised.secondLeadAbout ? sanitised.secondLeadAbout.trim() : ''
    };

    // Store in Azure Table Storage
    await storeApplication(application);

    // Send Discord notification via bot
    const discordChannelId = process.env.DISCORD_NOTIFICATIONS_CHANNEL_ID;
    if (discordChannelId) {
      const approveToken = generateApprovalToken(applicationId, 'approve');
      const rejectToken = generateApprovalToken(applicationId, 'reject');
      const baseUrl = process.env.SITE_BASE_URL || 'https://globalsecurity.community';

      const approveUrl = `${baseUrl}/api/chapterApproval?id=${applicationId}&action=approve&token=${approveToken}`;
      const rejectUrl = `${baseUrl}/api/chapterApproval?id=${applicationId}&action=reject&token=${rejectToken}`;

      const discordMessage = {
        embeds: [
          {
            title: '🌍 New Chapter Application',
            color: 0x20b2aa,
            fields: [
              { name: 'City', value: application.city, inline: true },
              { name: 'Country', value: application.country, inline: true },
              { name: 'Applicant', value: application.fullName, inline: true },
              { name: 'About', value: application.aboutYou.substring(0, 500), inline: false },
              { name: 'Why Lead?', value: application.whyLead.substring(0, 500), inline: false },
              ...(application.existingCommunity ? [{ name: 'Existing Community', value: application.existingCommunity.substring(0, 300), inline: false }] : []),
              ...(application.secondLeadName ? [{ name: 'Second Lead', value: application.secondLeadName, inline: true }] : []),
              { name: 'Actions', value: `[✅ Approve](${approveUrl}) | [❌ Reject](${rejectUrl})`, inline: false }
            ],
            footer: { text: `Application ID: ${applicationId}` },
            timestamp: new Date().toISOString()
          }
        ]
      };

      try {
        await sendMessage(discordChannelId, discordMessage, context);
      } catch (discordError) {
        context.log(`Discord notification failed: ${discordError.message}`);
      }
    }

    return {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        message: 'Your application has been received. We will review it and get back to you shortly!'
      })
    };
  } catch (error) {
    context.log(`Error: ${error.message}`);
    return {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'An unexpected error occurred. Please try again later.' })
    };
  }
};
