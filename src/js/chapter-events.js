(function() {
  var container = document.getElementById('chapter-events');
  if (!container) return;
  var chapterSlug = container.getAttribute('data-chapter-slug');
  if (!chapterSlug) return;

  (async function() {
    try {
      var res = await fetch('/api/getEvent?action=list&chapter=' + encodeURIComponent(chapterSlug));
      if (!res.ok) throw new Error('Failed');
      var events = await res.json();
      if (!events.length) {
        container.innerHTML = '<p>Events for this chapter are coming soon. Check back for meetups, workshops, and other community gatherings.</p>';
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
          '</div>' +
          '<div class="event-card-footer">' +
            '<a href="/events/' + e.slug + '/" class="event-card-btn">View Event \u2192</a>' +
          '</div>' +
        '</div>';
      }).join('') + '</div>';
    } catch (err) {
      container.innerHTML = '<p>Events for this chapter are coming soon.</p>';
    }
  })();
})();
