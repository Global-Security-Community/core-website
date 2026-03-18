const { BlobServiceClient } = require('@azure/storage-blob');

const AI_ENDPOINT = process.env.AZURE_AI_ENDPOINT || '';
const AI_KEY = process.env.AZURE_AI_KEY || '';
const AI_DEPLOYMENT = process.env.AZURE_AI_DEPLOYMENT || 'flux-pro';
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
  } catch (e) { /* may already exist */ containerReady = true; }
}

/**
 * Calls FLUX image generation API via Azure AI Foundry.
 * Returns a PNG buffer.
 */
async function callFluxApi(prompt, context) {
  if (!AI_ENDPOINT || !AI_KEY) {
    throw new Error('Azure AI Foundry credentials not configured');
  }

  const url = `${AI_ENDPOINT}openai/deployments/${AI_DEPLOYMENT}/images/generations?api-version=2024-06-01`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': AI_KEY
    },
    body: JSON.stringify({
      prompt,
      n: 1,
      size: '1024x1024',
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

/**
 * Uploads a PNG buffer to Azure Blob Storage and returns the public URL.
 */
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

/**
 * Generates a chapter banner image (landscape 1024x1024) and uploads to blob storage.
 */
async function generateChapterBanner(city, country, context) {
  const prompt = `A modern, artistic banner image for a cybersecurity community chapter in ${city}, ${country}. ` +
    `Incorporate recognisable landmarks and cultural elements of ${city}. ` +
    `Dark navy blue and teal colour scheme with subtle digital/cyber elements like circuit patterns or shield motifs. ` +
    `Professional, clean, community-focused. No text, no words, no letters.`;

  if (context) context.log(`Generating chapter banner for ${city}...`);
  const buffer = await callFluxApi(prompt, context);
  const blobPath = `chapters/${city.toLowerCase().replace(/[^a-z0-9]/g, '-')}.png`;
  return await uploadToBlob(buffer, blobPath, context);
}

/**
 * Generates an event badge background image and uploads to blob storage.
 */
async function generateEventBadgeBackground(eventTitle, city, slug, context) {
  const prompt = `An artistic digital badge background for a cybersecurity conference called "${eventTitle}" in ${city}. ` +
    `Incorporate recognisable landmarks of ${city} with a modern technology and cybersecurity theme. ` +
    `Dark navy blue and teal colour scheme with subtle digital elements. ` +
    `Square format, designed as a shareable achievement badge background. ` +
    `Professional, community-focused. No text, no words, no letters.`;

  if (context) context.log(`Generating event badge background for ${eventTitle}...`);
  const buffer = await callFluxApi(prompt, context);
  const blobPath = `events/${slug || 'event'}.png`;
  return await uploadToBlob(buffer, blobPath, context);
}

module.exports = {
  generateChapterBanner,
  generateEventBadgeBackground,
  callFluxApi,
  uploadToBlob
};
