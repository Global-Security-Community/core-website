(function() {
  'use strict';

  function setMetric(id, value) {
    if (!Number.isInteger(value) || value < 0) return;
    var element = document.getElementById(id);
    if (element) element.textContent = new Intl.NumberFormat().format(value);
  }

  fetch('/api/communityMetrics')
    .then(function(response) {
      if (!response.ok) throw new Error('Metrics request failed');
      return response.json();
    })
    .then(function(metrics) {
      setMetric('events-hosted', metrics.eventsHosted);
      setMetric('total-registrations', metrics.totalRegistrations);
    })
    .catch(function() {
      // Keep the server-rendered values when live metrics are unavailable.
    });
})();
