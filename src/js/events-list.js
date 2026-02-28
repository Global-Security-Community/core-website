(async function() {
  var container = document.getElementById('events-list');
  if (!container) return;
  try {
    var res = await fetch('/api/getEvent?action=list');
    if (!res.ok) throw new Error('Failed to load events');
    var events = await res.json();

    if (!events.length) {
      container.innerHTML = '<div class="card" style="text-align:center;"><h3>Events Coming Soon</h3><p>We\'re planning exciting events for 2026. Check back here for announcements about our global summit, regional meetups, and training workshops.</p></div>';
      return;
    }

    container.innerHTML = '<div class="events-grid">' + events.map(function(e) {
      var dateStr = new Date(e.date).toLocaleDateString('en-AU', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
      var endStr = e.endDate ? ' \u2013 ' + new Date(e.endDate).toLocaleDateString('en-AU', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : '';
      return '<div class="event-card">' +
        '<div class="event-card-header">' +
          '<div class="event-card-date">\ud83d\udcc5 ' + dateStr + endStr + '</div>' +
          '<h3 class="event-card-title">' + e.title + '</h3>' +
        '</div>' +
        '<div class="event-card-body">' +
          '<div class="event-card-location">\ud83d\udccd ' + e.location + '</div>' +
          (e.description ? '<div class="event-card-description">' + e.description + '</div>' : '') +
        '</div>' +
        '<div class="event-card-footer">' +
          '<a href="/events/' + e.slug + '/" class="event-card-btn">View Event \u2192</a>' +
        '</div>' +
      '</div>';
    }).join('') + '</div>';
  } catch (err) {
    container.innerHTML = '<p>Unable to load events. Please try again later.</p>';
  }
})();
