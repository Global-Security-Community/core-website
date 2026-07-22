const { BlobServiceClient } = require('@azure/storage-blob');
const fs = require('fs/promises');
const path = require('path');
const sharp = require('sharp');
const { getProvider, isChatConfigured } = require('./aiProvider');
const { generateSharedEventBadgePng } = require('./badgeGenerator');

const STORAGE_CONN = process.env.AZURE_STORAGE_CONNECTION_STRING || '';
const CONTAINER_NAME = 'generated-images';
const ACTIVE_BADGE_THEME_YEAR = 2026;
const BUNDLED_THEME_PATH = path.join(__dirname, '..', 'assets', 'badge-themes', '2026-master.png');

let containerReady = false;

async function ensureContainer() {
  if (containerReady || !STORAGE_CONN) return;
  try {
    const blobService = BlobServiceClient.fromConnectionString(STORAGE_CONN);
    const container = blobService.getContainerClient(CONTAINER_NAME);
    await container.createIfNotExists();
    containerReady = true;
  } catch (e) { containerReady = true; }
}

// ─── Landmark Lookup via AI Chat ───

async function lookupLandmarks(city, country, context) {
  if (!isChatConfigured()) return '';

  try {
    const provider = getProvider();
    const messages = [
      { role: 'system', content: 'You describe city landmarks for an AI image generator that will draw them as line art. Focus on distinctive SHAPES and SILHOUETTES only — no colours, no materials, no surroundings. The image generator needs to know what outline to draw.' },
      { role: 'user', content: `Name the 2-3 most visually distinctive and recognisable man-made landmarks of ${city}, ${country}. For each, describe ONLY its unique silhouette/shape in under 15 words. Format: "Name: shape description". One per line. Pick landmarks with the most distinctive outlines that cannot be confused with generic buildings.` }
    ];

    const landmarks = await provider.chatCompletion(messages, { maxTokens: 250, temperature: 0.3 });
    if (context) context.log(`Landmarks for ${city}: ${landmarks}`);
    return landmarks || '';
  } catch (err) {
    if (context) context.log(`Landmark lookup error: ${err.message}`);
    return '';
  }
}

// ─── AI Image Generation ───

async function callImageApi(prompt, size, context) {
  const provider = getProvider();
  if (context) context.log(`Generating image via ${provider.name} provider...`);
  return await provider.generateImage(prompt, { size: size || '1024x1024' });
}

async function callImageEditApi(imageBuffer, prompt, size, context) {
  const provider = getProvider();
  if (context) context.log(`Creating chapter variation via ${provider.name} provider...`);
  return await provider.editImage(imageBuffer, prompt, { size: size || '1024x1024' });
}

// ─── Blob Storage ───

async function uploadToBlob(buffer, blobPath, context, contentType = 'image/png') {
  if (!STORAGE_CONN) throw new Error('Storage connection string not configured');
  await ensureContainer();

  const blobService = BlobServiceClient.fromConnectionString(STORAGE_CONN);
  const container = blobService.getContainerClient(CONTAINER_NAME);
  const blob = container.getBlockBlobClient(blobPath);

  await blob.uploadData(buffer, {
    blobHTTPHeaders: { blobContentType: contentType },
    overwrite: true
  });

  if (context) context.log(`Uploaded image to ${blobPath}`);
  return blob.url;
}

async function downloadBlobPath(blobPath) {
  if (!STORAGE_CONN) throw new Error('Storage connection string not configured');
  await ensureContainer();
  const blobService = BlobServiceClient.fromConnectionString(STORAGE_CONN);
  const container = blobService.getContainerClient(CONTAINER_NAME);
  const blob = container.getBlockBlobClient(blobPath);
  if (!await blob.exists()) return null;
  return await blob.downloadToBuffer();
}

async function downloadGeneratedImage(imageUrl) {
  if (!STORAGE_CONN) throw new Error('Storage connection string not configured');
  const parsedUrl = new URL(imageUrl);
  const pathParts = parsedUrl.pathname.split('/').filter(Boolean);
  if (pathParts.shift() !== CONTAINER_NAME || pathParts.length === 0) {
    throw new Error('Invalid generated image URL');
  }

  const blobService = BlobServiceClient.fromConnectionString(STORAGE_CONN);
  const container = blobService.getContainerClient(CONTAINER_NAME);
  const blob = container.getBlockBlobClient(pathParts.join('/'));
  return await blob.downloadToBuffer();
}

async function getAnnualBadgeTheme(year) {
  let buffer = await downloadBlobPath(`badge-themes/${year}.png`);
  if (!buffer && year === ACTIVE_BADGE_THEME_YEAR) {
    buffer = await fs.readFile(BUNDLED_THEME_PATH);
    await uploadToBlob(buffer, `badge-themes/${year}.png`);
  }
  return buffer;
}

function safeStorageSegment(value, fallback) {
  const segment = String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return segment || fallback;
}

async function getChapterBadgeTheme(year, chapterSlug) {
  const safeChapterSlug = safeStorageSegment(chapterSlug, 'chapter');
  return await downloadBlobPath(`badge-themes/${year}/chapters/${safeChapterSlug}.png`);
}

async function getChapterCardArtwork(year, chapterSlug) {
  const safeChapterSlug = safeStorageSegment(chapterSlug, 'chapter');
  return await downloadBlobPath(`badge-themes/${year}/chapters/${safeChapterSlug}-card.webp`);
}

async function generateAnnualBadgeTheme(year, context) {
  const prompt = `A square digital illustration forming the ${year} annual visual theme for Global Security Community event badges worldwide. ` +
    `Create one iconic, polished cybersecurity community scene that can be reused consistently across many different events and countries. ` +
    `Deep navy blue (#001f3f) and teal (#20b2aa) colour palette with restrained cyan light, layered shield geometry, elegant circuit patterns, and connected global nodes. ` +
    `Professional, inclusive, optimistic, and community-focused. Avoid offensive-security, hacker, terminal, matrix, skull, or corporate software aesthetics. ` +
    `Keep the bottom third visually quiet and darker so deterministic event text can be overlaid clearly. ` +
    `Absolutely no text, no words, no letters, no numbers, no logos, and no watermarks.`;

  if (context) context.log(`Generating the ${year} annual community badge theme...`);
  const buffer = await callImageApi(prompt, '1024x1024', context);
  await uploadToBlob(buffer, `badge-themes/${year}.png`, context);
  return buffer;
}

async function generateChapterBadgeTheme(year, chapterSlug, city, country, annualTheme, context) {
  const landmarks = await lookupLandmarks(city, country || '', context);
  const localDetail = landmarks
    ? `Use these landmark silhouettes as reference: ${landmarks}.`
    : `Incorporate two or three unmistakable architectural landmark silhouettes associated with ${city}.`;
  const prompt = `Create the ${city} chapter variation of this ${year} Global Security Community annual badge theme. ` +
    `Use the supplied annual artwork as the authoritative visual reference. Preserve its illustration style, lighting, depth, line language, deep navy and teal palette, restrained amber highlights, cybersecurity motifs, and edge framing. ` +
    `${localDetail} Make the most distinctive local landmark the dominant CENTRAL focal point, supported by a recognisable local skyline. The landmark cluster must remain clear when the upper three quarters are cropped into a landscape chapter card. ` +
    `Keep only the lowest 28 percent dark, calm, and low-detail for deterministic event typography. Do not leave the centre empty and do not place important landmark details in the reserved lower area. ` +
    `The result must be recognisably ${city}, but must clearly remain part of the same ${year} worldwide badge collection. ` +
    `Absolutely no text, no words, no letters, no numbers, no logos, no flags, no people, no faces, and no watermarks.`;

  const buffer = await callImageEditApi(annualTheme, prompt, '1024x1024', context);
  const safeChapterSlug = safeStorageSegment(chapterSlug, 'chapter');
  await uploadToBlob(buffer, `badge-themes/${year}/chapters/${safeChapterSlug}.png`, context);
  const cardBuffer = await sharp(buffer)
    .resize(720, 405, { fit: 'cover', position: 'north' })
    .webp({ quality: 78, effort: 5 })
    .toBuffer();
  await uploadToBlob(
    cardBuffer,
    `badge-themes/${year}/chapters/${safeChapterSlug}-card.webp`,
    context,
    'image/webp'
  );
  return buffer;
}

async function ensureChapterBadgeTheme(year, chapterSlug, city, country, context) {
  let annualTheme = await getAnnualBadgeTheme(year);
  if (!annualTheme) annualTheme = await generateAnnualBadgeTheme(year, context);

  let chapterTheme = await getChapterBadgeTheme(year, chapterSlug);
  if (!chapterTheme) {
    chapterTheme = await generateChapterBadgeTheme(
      year,
      chapterSlug,
      city,
      country,
      annualTheme,
      context
    );
    return { buffer: chapterTheme, created: true };
  }

  const cardArtwork = await getChapterCardArtwork(year, chapterSlug);
  if (!cardArtwork) {
    const safeChapterSlug = safeStorageSegment(chapterSlug, 'chapter');
    const cardBuffer = await sharp(chapterTheme)
      .resize(720, 405, { fit: 'cover', position: 'north' })
      .webp({ quality: 78, effort: 5 })
      .toBuffer();
    await uploadToBlob(
      cardBuffer,
      `badge-themes/${year}/chapters/${safeChapterSlug}-card.webp`,
      context,
      'image/webp'
    );
  }
  return { buffer: chapterTheme, created: false };
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
  const buffer = await callImageApi(prompt, '1024x1024', context);
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
  const buffer = await callImageApi(prompt, '1440x1024', context);
  const slug = city.toLowerCase().replace(/[^a-z0-9]/g, '-');
  const blobPath = `chapters/${slug}-banner.png`;
  return await uploadToBlob(buffer, blobPath, context);
}

// ─── Event Badge Background (uses chapter shield) ───

async function generateEventBadgeBackground(eventTitle, city, chapterSlug, slug, eventDate, context) {
  const parsedYear = Number.parseInt(String(eventDate || '').slice(0, 4), 10);
  const themeYear = Number.isInteger(parsedYear) && parsedYear >= 2020 && parsedYear <= 2100
    ? parsedYear
    : new Date().getUTCFullYear();
  let annualTheme = await getAnnualBadgeTheme(themeYear);
  const themeCreated = !annualTheme;
  if (!annualTheme) {
    annualTheme = await generateAnnualBadgeTheme(themeYear, context);
  } else if (context) {
    context.log(`Reusing the ${themeYear} annual community badge theme`);
  }
  const chapterTheme = await ensureChapterBadgeTheme(
    themeYear,
    chapterSlug,
    city,
    '',
    context
  );
  const generatedArtwork = chapterTheme.buffer;
  const chapterThemeCreated = chapterTheme.created;
  if (!chapterThemeCreated && context) {
    context.log(`Reusing the ${themeYear} ${city} chapter badge variation`);
  }
  const badgeDetails = {
    eventTitle,
    eventDate,
    eventLocation: city
  };
  const attendeeBuffer = await generateSharedEventBadgePng({
    ...badgeDetails,
    badgeType: 'Attendee'
  }, generatedArtwork);
  const speakerBuffer = await generateSharedEventBadgePng({
    ...badgeDetails,
    badgeType: 'Speaker'
  }, generatedArtwork);
  const organiserBuffer = await generateSharedEventBadgePng({
    ...badgeDetails,
    badgeType: 'Organiser'
  }, generatedArtwork);
  const safeSlug = slug || 'event';
  const attendeeImageUrl = await uploadToBlob(attendeeBuffer, `events/${safeSlug}-attendee.png`, context);
  const speakerImageUrl = await uploadToBlob(speakerBuffer, `events/${safeSlug}-speaker.png`, context);
  const organiserImageUrl = await uploadToBlob(organiserBuffer, `events/${safeSlug}-organiser.png`, context);
  return {
    attendeeImageUrl,
    speakerImageUrl,
    organiserImageUrl,
    themeYear,
    themeCreated,
    chapterThemeCreated
  };
}

module.exports = {
  lookupLandmarks,
  generateChapterShield,
  generateChapterBanner,
  generateEventBadgeBackground,
  applyShieldMask,
  callImageApi,
  callImageEditApi,
  uploadToBlob,
  downloadBlobPath,
  downloadGeneratedImage,
  getAnnualBadgeTheme,
  getChapterBadgeTheme,
  getChapterCardArtwork,
  generateAnnualBadgeTheme,
  generateChapterBadgeTheme,
  ensureChapterBadgeTheme,
  ACTIVE_BADGE_THEME_YEAR
};
