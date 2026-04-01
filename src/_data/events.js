/**
 * Eleventy global data file — fetches events from the live API at build time.
 * Falls back to an empty array if the API is unavailable (local dev without API).
 * The events-list.js client script hydrates/replaces this on page load.
 */
module.exports = async function() {
  try {
    const res = await fetch('https://globalsecurity.community/api/getEvent?action=list');
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
};
