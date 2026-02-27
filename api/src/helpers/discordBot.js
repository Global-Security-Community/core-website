const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN || '';
const DISCORD_GUILD_ID = process.env.DISCORD_GUILD_ID || '';
const DISCORD_CHAPTERS_CATEGORY_ID = process.env.DISCORD_CHAPTERS_CATEGORY_ID || '';

const DISCORD_API = 'https://discord.com/api/v10';

function botHeaders() {
  return {
    'Authorization': `Bot ${DISCORD_BOT_TOKEN}`,
    'Content-Type': 'application/json'
  };
}

/**
 * Sends a message (with embeds) to a specific Discord channel via the bot.
 */
async function sendMessage(channelId, message, context) {
  if (!DISCORD_BOT_TOKEN) {
    context.log('Discord bot token not configured — skipping message');
    return false;
  }

  const response = await fetch(`${DISCORD_API}/channels/${channelId}/messages`, {
    method: 'POST',
    headers: botHeaders(),
    body: JSON.stringify(message)
  });

  if (!response.ok) {
    const error = await response.text();
    context.log(`Discord message send failed: ${response.status} ${error}`);
    return false;
  }
  return true;
}

/**
 * Creates a text channel under the Chapters category in Discord.
 * Returns { channelId, channelName } or null if config is missing.
 */
async function createChapterChannel(cityName, context) {
  if (!DISCORD_BOT_TOKEN || !DISCORD_GUILD_ID) {
    context.log('Discord bot config missing — skipping channel creation');
    return null;
  }

  const channelName = `${cityName.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-')}`;

  const body = {
    name: channelName,
    type: 0, // GUILD_TEXT
    topic: `Global Security Community — ${cityName} chapter`,
    ...(DISCORD_CHAPTERS_CATEGORY_ID ? { parent_id: DISCORD_CHAPTERS_CATEGORY_ID } : {})
  };

  const response = await fetch(`${DISCORD_API}/guilds/${DISCORD_GUILD_ID}/channels`, {
    method: 'POST',
    headers: botHeaders(),
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const error = await response.text();
    context.log(`Discord channel creation failed: ${response.status} ${error}`);
    return null;
  }

  const channel = await response.json();
  context.log(`Created Discord channel #${channel.name} (${channel.id})`);

  // Post a welcome message
  await sendMessage(channel.id, {
    embeds: [{
      title: `🌍 Welcome to Global Security ${cityName}!`,
      description: `This is the official channel for the **${cityName}** chapter of the Global Security Community.\n\nUse this channel to connect with other members, discuss local events, and share security knowledge.`,
      color: 0x20b2aa
    }]
  }, context);

  return { channelId: channel.id, channelName: channel.name };
}

module.exports = { sendMessage, createChapterChannel };
