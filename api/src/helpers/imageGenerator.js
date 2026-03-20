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
          { role: 'system', content: 'You describe city landmarks for an AI image generator that will draw them as line art. Focus on distinctive SHAPES and SILHOUETTES only — no colours, no materials, no surroundings. The image generator needs to know what outline to draw.' },
          { role: 'user', content: `Name the 2-3 most visually distinctive and recognisable man-made landmarks of ${city}, ${country}. For each, describe ONLY its unique silhouette/shape in under 15 words. Format: "Name: shape description". One per line. Pick landmarks with the most distinctive outlines that cannot be confused with generic buildings.` }
        ],
        max_tokens: 250,
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
  const landmarkStr = landmarks || `the iconic skyline of ${city}`;

  const prompt = `Clean line art illustration of the landmarks of ${city}: ${landmarkStr}. ` +
    `The landmarks fill the entire image as the sole subject, drawn as white and teal (#20b2aa) outlines on a solid deep navy (#001f3f) background. ` +
    `Flat colour fills only — white, teal, and navy. No other colours. No green, no gold, no red, no warm tones, no gradients. ` +
    `The landmarks are large, detailed, and recognisable, filling at least 90% of the composition. No sky, no ground, no trees, no water, no clouds, no people, no extra scenery. ` +
    `Minimalist heraldic crest style. No decorative borders, no patterns, no circuit boards, no tech elements, no shields. ` +
    `CRITICAL: Absolutely no text, no words, no letters, no numbers, no writing of any kind. No watermarks.`;

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

  const prompt = `Wide panoramic line art illustration of the skyline of ${city}, ${country}, featuring: ${landmarkStr}. ` +
    `The landmarks form a recognisable city skyline silhouette as the sole subject, drawn as white and teal (#20b2aa) outlines on a solid deep navy (#001f3f) background. ` +
    `Flat colour fills only — white, teal, and navy. No other colours. No green, no gold, no warm tones. ` +
    `Landmarks are large and detailed, filling the width of the panoramic frame. ` +
    `Minimalist, clean, architectural illustration. No circuit boards, no particles, no tech elements, no people, no clouds. ` +
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
