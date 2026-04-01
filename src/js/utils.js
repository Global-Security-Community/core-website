/* ─── Shared Utilities ─── */
var GSC = window.GSC || {};

/**
 * HTML-escape a string for safe insertion into the DOM.
 */
GSC.esc = function(str) {
  if (!str) return '';
  var d = document.createElement('span');
  d.textContent = str;
  return d.innerHTML;
};

/**
 * Format a date string as a long locale date (en-AU).
 */
GSC.formatDate = function(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('en-AU', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });
};

/**
 * Format a multi-line location string as HTML with <br> separators.
 */
GSC.formatLocation = function(loc) {
  if (!loc) return '';
  return loc.split('\n').map(function(line) {
    return GSC.esc(line.trim());
  }).filter(Boolean).join('<br>');
};

/**
 * Show a form message with a type class.
 * @param {HTMLElement} el - The message element
 * @param {'success'|'error'|'warning'} type
 * @param {string} text
 */
GSC.showMessage = function(el, type, text) {
  el.className = 'form-message form-message--' + type;
  el.textContent = text;
};

/**
 * Validate a URL and return it only if it uses a safe scheme (http/https).
 * Returns empty string for javascript:, data:, or other dangerous schemes.
 */
GSC.safeUrl = function(url) {
  if (!url) return '';
  try {
    var u = new URL(url);
    if (u.protocol === 'http:' || u.protocol === 'https:') return url;
  } catch (e) { /* invalid URL */ }
  return '';
};

window.GSC = GSC;
