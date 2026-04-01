/**
 * Structured security event logging helper.
 * Logs security-relevant events in a consistent JSON format
 * for easier monitoring, alerting, and forensic analysis.
 */

/**
 * Log a security event with structured data.
 * @param {object} context - Azure Functions context with .log()
 * @param {string} event - Event type (e.g. 'auth_failure', 'admin_action', 'rate_limited')
 * @param {object} details - Event-specific details
 */
function logSecurityEvent(context, event, details = {}) {
  const entry = {
    type: 'security_event',
    event,
    timestamp: new Date().toISOString(),
    ...details
  };
  context.log(JSON.stringify(entry));
}

module.exports = { logSecurityEvent };
