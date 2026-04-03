/**
 * Strips HTML tags from a string. Note: this is tag-stripping only —
 * it does NOT handle HTML entities, URL schemes, YAML, or CSV contexts.
 * Use context-specific validators for those cases.
 * @param {string} input
 * @returns {string}
 */
function stripHtml(input) {
  if (!input || typeof input !== 'string') return '';
  let result = input;
  let prev;
  do {
    prev = result;
    result = result.replace(/<[^>]*>/g, '');
  } while (result !== prev);
  return result;
}

/**
 * Sanitises an object's string values by stripping HTML tags.
 * Only processes own string properties.
 * @param {Object} obj
 * @param {string[]} fields - field names to sanitise
 * @returns {Object} new object with sanitised values
 */
function sanitiseFields(obj, fields) {
  const result = { ...obj };
  for (const field of fields) {
    if (typeof result[field] === 'string') {
      result[field] = stripHtml(result[field]);
    }
  }
  return result;
}

/**
 * Validates that a URL uses only http: or https: schemes.
 * Returns the URL string if safe, empty string otherwise.
 * @param {string} url
 * @returns {string}
 */
function sanitiseUrl(url) {
  if (!url || typeof url !== 'string') return '';
  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') return url;
  } catch { /* invalid URL */ }
  return '';
}

module.exports = { stripHtml, sanitiseFields, sanitiseUrl };
