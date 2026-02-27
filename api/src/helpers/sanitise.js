/**
 * Strips HTML tags from a string to prevent XSS when rendering user input.
 * @param {string} input
 * @returns {string}
 */
function stripHtml(input) {
  if (!input || typeof input !== 'string') return '';
  return input.replace(/<[^>]*>/g, '');
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

module.exports = { stripHtml, sanitiseFields };
