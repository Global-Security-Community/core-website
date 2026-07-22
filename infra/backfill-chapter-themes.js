#!/usr/bin/env node

const {
  ensureChapterBadgeTheme,
  ACTIVE_BADGE_THEME_YEAR
} = require('../api/src/helpers/imageGenerator');

const chapters = [
  ['adelaide', 'Adelaide', 'Australia'],
  ['auckland', 'Auckland', 'New Zealand'],
  ['colombo', 'Colombo', 'Sri Lanka'],
  ['kansas-city', 'Kansas City', 'United States'],
  ['perth', 'Perth', 'Australia'],
  ['sydney', 'Sydney', 'Australia'],
  ['toronto', 'Toronto', 'Canada'],
  ['wellington', 'Wellington', 'New Zealand']
];

async function main() {
  if (!process.env.AZURE_STORAGE_CONNECTION_STRING ||
      !process.env.AZURE_OPENAI_IMAGE_ENDPOINT ||
      !process.env.AZURE_OPENAI_IMAGE_API_KEY) {
    throw new Error('Storage and Azure OpenAI image settings must be provided as environment variables');
  }

  const context = { log: message => console.log(message) };
  for (const [slug, city, country] of chapters) {
    console.log(`Ensuring ${city} ${ACTIVE_BADGE_THEME_YEAR} artwork...`);
    await ensureChapterBadgeTheme(
      ACTIVE_BADGE_THEME_YEAR,
      slug,
      city,
      country,
      context
    );
  }
}

main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
