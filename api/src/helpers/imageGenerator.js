const { BlobServiceClient } = require('@azure/storage-blob');
const sharp = require('sharp');

const AI_ENDPOINT = process.env.AZURE_AI_ENDPOINT || '';
const AI_KEY = process.env.AZURE_AI_KEY || '';
const AI_DEPLOYMENT = process.env.AZURE_AI_DEPLOYMENT || 'flux-pro';
const AI_GPT_DEPLOYMENT = process.env.AZURE_AI_GPT_DEPLOYMENT || 'gpt-nano';
const STORAGE_CONN = process.env.AZURE_STORAGE_CONNECTION_STRING || '';
const CONTAINER_NAME = 'generated-images';

let containerReady = false;

async function ensureContainer() {
  if (containerReady || !STORAGE_CONN) return;
  try {
    const blobService = BlobServiceClient.fromConnectionString(STORAGE_CONN);
    const container = blobService.getContainerClient(CONTAINER_NAME);
    await container.createIfNotExists({ access: 'blob' });
    containerReady = true;
  } catch (e) { containerReady = true; }
}

// ─── Landmark Lookup via GPT ───

async function lookupLandmarks(city, country, context) {
  if (!AI_ENDPOINT || !AI_KEY) return '';

  const url = `${AI_ENDPOINT}openai/deployments/${AI_GPT_DEPLOYMENT}/chat/completions?api-version=2024-06-01`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'api-key': AI_KEY },
      body: JSON.stringify({
        messages: [
          { role: 'system', content: 'You are a geography expert. Return only a comma-separated list of landmarks, nothing else.' },
          { role: 'user', content: `List 4 famous, visually recognisable landmarks or iconic locations of ${city}, ${country}. Include buildings, bridges, natural features, or monuments that are distinctive to this city. Return only the names, comma-separated.` }
        ],
        max_tokens: 100,
        temperature: 0.3
      })
    });

    if (!response.ok) {
      if (context) context.log(`GPT landmark lookup failed: ${response.status}`);
      return '';
    }

    const result = await response.json();
    const landmarks = result.choices && result.choices[0] && result.choices[0].message && result.choices[0].message.content;
    if (context) context.log(`Landmarks for ${city}: ${landmarks}`);
    return (landmarks || '').trim();
  } catch (err) {
    if (context) context.log(`Landmark lookup error: ${err.message}`);
    return '';
  }
}

// ─── FLUX Image Generation ───

async function callFluxApi(prompt, size, context) {
  if (!AI_ENDPOINT || !AI_KEY) {
    throw new Error('Azure AI Foundry credentials not configured');
  }

  const url = `${AI_ENDPOINT}openai/deployments/${AI_DEPLOYMENT}/images/generations?api-version=2024-06-01`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'api-key': AI_KEY },
    body: JSON.stringify({
      prompt,
      n: 1,
      size: size || '1024x1024',
      response_format: 'b64_json'
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    if (context) context.log(`FLUX API error: ${response.status} ${errText}`);
    throw new Error(`Image generation failed: ${response.status}`);
  }

  const result = await response.json();
  const b64 = result.data && result.data[0] && result.data[0].b64_json;
  if (!b64) throw new Error('No image data in response');

  return Buffer.from(b64, 'base64');
}

// ─── Blob Storage ───

async function uploadToBlob(buffer, blobPath, context) {
  if (!STORAGE_CONN) throw new Error('Storage connection string not configured');
  await ensureContainer();

  const blobService = BlobServiceClient.fromConnectionString(STORAGE_CONN);
  const container = blobService.getContainerClient(CONTAINER_NAME);
  const blob = container.getBlockBlobClient(blobPath);

  await blob.uploadData(buffer, {
    blobHTTPHeaders: { blobContentType: 'image/png' },
    overwrite: true
  });

  if (context) context.log(`Uploaded image to ${blobPath}`);
  return blob.url;
}

// ─── Shield Mask ───

const SHIELD_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <path d="M512 20 C512 20 960 100 960 100 L960 520 
    C960 800 512 1004 512 1004 C512 1004 64 800 64 520 
    L64 100 C64 100 512 20 512 20Z" fill="white"/>
</svg>`;

async function applyShieldMask(imageBuffer, context) {
  // Resize image to 1024x1024 and apply shield clip mask
  const resized = await sharp(imageBuffer)
    .resize(1024, 1024, { fit: 'cover' })
    .png()
    .toBuffer();

  const maskBuffer = Buffer.from(SHIELD_SVG);
  const mask = await sharp(maskBuffer)
    .resize(1024, 1024)
    .greyscale()
    .png()
    .toBuffer();

  // Composite: use mask as alpha channel
  const shielded = await sharp(resized)
    .composite([{ input: mask, blend: 'dest-in' }])
    .png()
    .toBuffer();

  if (context) context.log('Applied shield mask');
  return shielded;
}

// ─── Chapter Shield Badge ───

async function generateChapterShield(city, country, context) {
  const landmarks = await lookupLandmarks(city, country, context);
  const landmarkStr = landmarks || `famous landmarks and skyline of ${city}`;

  const prompt = `A shield-shaped heraldic emblem for a cybersecurity community in ${city}, ${country}. ` +
    `Inside the shield shape, illustrate ${landmarkStr} in a stylised modern digital art style. ` +
    `Colour palette: deep navy blue (#001f3f) background with teal (#20b2aa) and cyan accent highlights. ` +
    `Subtle cybersecurity elements woven in: faint circuit board traces, small shield motifs, digital particles. ` +
    `The overall composition should fit within a heraldic shield/crest shape. ` +
    `Clean, professional, polished illustration. Absolutely no text, no words, no letters, no watermarks.`;

  if (context) context.log(`Generating shield for ${city}...`);
  const buffer = await callFluxApi(prompt, '1024x1024', context);
  const shielded = await applyShieldMask(buffer, context);
  const slug = city.toLowerCase().replace(/[^a-z0-9]/g, '-');
  const blobPath = `chapters/${slug}-shield.png`;
  return await uploadToBlob(shielded, blobPath, context);
}

// ─── Chapter Banner ───

async function generateChapterBanner(city, country, context) {
  const landmarks = await lookupLandmarks(city, country, context);
  const landmarkStr = landmarks || `famous landmarks and skyline of ${city}`;

  const prompt = `A stunning wide panoramic digital illustration of ${city}, ${country}. ` +
    `Feature ${landmarkStr} prominently in the composition. ` +
    `Modern, stylised digital art with a colour palette of deep navy blue (#001f3f), teal (#20b2aa), and cyan accents. ` +
    `Subtle cybersecurity elements: faint circuit patterns in the sky, digital particles, glowing nodes. ` +
    `Clean, professional, polished illustration style similar to tech conference branding. ` +
    `Wide panoramic composition with the city skyline as the focal point. ` +
    `Absolutely no text, no words, no letters, no watermarks.`;

  if (context) context.log(`Generating banner for ${city}...`);
  const buffer = await callFluxApi(prompt, '1440x1024', context);
  const slug = city.toLowerCase().replace(/[^a-z0-9]/g, '-');
  const blobPath = `chapters/${slug}-banner.png`;
  return await uploadToBlob(buffer, blobPath, context);
}

// ─── Event Badge Background (uses chapter shield) ───

async function generateEventBadgeBackground(eventTitle, city, slug, context) {
  const landmarks = await lookupLandmarks(city, '', context);
  const landmarkStr = landmarks || `famous landmarks of ${city}`;

  const prompt = `A square digital illustration for a cybersecurity conference badge in ${city}. ` +
    `Feature ${landmarkStr} in a modern, stylised digital art style. ` +
    `Deep navy blue (#001f3f) and teal (#20b2aa) colour palette with subtle cyan glowing accents. ` +
    `Cybersecurity visual elements: shield icons, circuit patterns, digital particles. ` +
    `The bottom third should have a darker gradient area suitable for text overlay. ` +
    `Clean, professional — designed as a shareable LinkedIn achievement badge. ` +
    `Absolutely no text, no words, no letters, no watermarks.`;

  if (context) context.log(`Generating event badge for ${eventTitle}...`);
  const buffer = await callFluxApi(prompt, '1024x1024', context);
  const blobPath = `events/${slug || 'event'}.png`;
  return await uploadToBlob(buffer, blobPath, context);
}

module.exports = {
  lookupLandmarks,
  generateChapterShield,
  generateChapterBanner,
  generateEventBadgeBackground,
  applyShieldMask,
  callFluxApi,
  uploadToBlob
};
