const fs = require('fs/promises');
const path = require('path');

const sourceRoot = path.join(__dirname, '..');

async function countContentDirectories(section) {
  const entries = await fs.readdir(path.join(sourceRoot, section), { withFileTypes: true });
  return entries.filter(entry => entry.isDirectory() && entry.name !== 'apply');
}

async function getChapterMetrics() {
  const chapterDirectories = await countContentDirectories('chapters');
  const countries = new Set();

  await Promise.all(chapterDirectories.map(async directory => {
    const content = await fs.readFile(
      path.join(sourceRoot, 'chapters', directory.name, 'index.md'),
      'utf8'
    );
    const match = content.match(/^country:\s*["']?([^"'\r\n]+)["']?\s*$/m);
    if (match) countries.add(match[1].trim());
  }));

  return {
    chaptersWorldwide: chapterDirectories.length,
    countriesRepresented: countries.size
  };
}

async function getLiveMetrics() {
  try {
    const metricsResponse = await fetch('https://globalsecurity.community/api/communityMetrics');
    if (metricsResponse.ok) {
      const metrics = await metricsResponse.json();
      if (Number.isInteger(metrics.eventsHosted) && Number.isInteger(metrics.totalRegistrations)) {
        return metrics;
      }
    }
  } catch {
    // The aggregate endpoint may not exist during its first deployment.
  }

  // During the endpoint's first deployment, derive the same totals from existing public APIs.
  const eventsResponse = await fetch('https://globalsecurity.community/api/getEvent?action=list');
  if (!eventsResponse.ok) throw new Error('Unable to fetch published events');
  const events = await eventsResponse.json();
  const eventDetails = await Promise.all(events.map(async event => {
    const response = await fetch(
      `https://globalsecurity.community/api/getEvent?slug=${encodeURIComponent(event.slug)}`
    );
    return response.ok ? response.json() : null;
  }));

  return {
    eventsHosted: events.length,
    totalRegistrations: eventDetails.reduce(
      (sum, event) => sum + (Number.isInteger(event?.registrationCount) ? event.registrationCount : 0),
      0
    )
  };
}

module.exports = async function communityMetrics() {
  const chapterMetrics = await getChapterMetrics();
  const eventDirectories = await countContentDirectories('events');

  try {
    return Object.assign(chapterMetrics, await getLiveMetrics());
  } catch {
    return Object.assign(chapterMetrics, {
      eventsHosted: eventDirectories.length,
      totalRegistrations: '&mdash;'
    });
  }
};

module.exports.getChapterMetrics = getChapterMetrics;
