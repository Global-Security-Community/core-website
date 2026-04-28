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
 * Sanitises rich HTML content, allowing only safe formatting tags.
 * Used for event descriptions where rich text (bold, lists, etc.) is permitted.
 * @param {string} input - HTML string from rich text editor
 * @returns {string} sanitised HTML with only allowed tags/attributes
 */
function sanitiseRichText(input) {
  if (!input || typeof input !== 'string') return '';
  const sanitizeHtml = require('sanitize-html');
  return sanitizeHtml(input, {
    allowedTags: ['p', 'br', 'strong', 'em', 'u', 'ol', 'ul', 'li', 'a', 'blockquote', 'span'],
    allowedAttributes: {
      'a': ['href', 'target', 'rel'],
      'p': ['class'],
      'span': ['class'],
      'li': ['class']
    },
    allowedClasses: {
      'p': ['ql-align-center', 'ql-align-right', 'ql-align-justify'],
      'span': [],
      'li': ['ql-indent-1', 'ql-indent-2', 'ql-indent-3']
    },
    allowedSchemes: ['http', 'https'],
    transformTags: {
      'a': sanitizeHtml.simpleTransform('a', { rel: 'noopener noreferrer', target: '_blank' })
    }
  });
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

module.exports = { stripHtml, sanitiseFields, sanitiseUrl, sanitiseRichText };
