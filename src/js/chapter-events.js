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

      // Sort newest first, take top 3
      var sorted = events.sort(function(a, b) { return new Date(b.date) - new Date(a.date); });
      var display = sorted.slice(0, 3);
      var now = new Date();
      now.setHours(0, 0, 0, 0);

      container.innerHTML = '<div class="events-grid">' + display.map(function(e) {
        var eventDate = new Date(e.endDate || e.date);
        var isUpcoming = eventDate >= now && e.status === 'published';
        var badgeText = isUpcoming ? 'Upcoming' : 'Past Event';
        var badgeStyle = isUpcoming
          ? 'background:var(--color-primary-teal);color:white;'
          : 'background:#666;color:white;';
        var dateStr = new Date(e.date).toLocaleDateString('en-AU', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        var endStr = e.endDate ? ' \u2013 ' + new Date(e.endDate).toLocaleDateString('en-AU', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : '';
        return '<div class="event-card">' +
          '<div class="event-card-header">' +
            '<span style="display:inline-block;padding:2px 10px;border-radius:12px;font-size:0.8rem;font-weight:600;margin-bottom:0.5rem;' + badgeStyle + '">' + badgeText + '</span>' +
            '<div class="event-card-date">\ud83d\udcc5 ' + dateStr + endStr + '</div>' +
            '<h3 class="event-card-title">' + e.title + '</h3>' +
          '</div>' +
          '<div class="event-card-body">' +
            '<div class="event-card-location">\ud83d\udccd ' + (e.location || '').split('\n').join(', ') + '</div>' +
          '</div>' +
          '<div class="event-card-footer">' +
            '<a href="/events/' + e.slug + '/" class="event-card-btn">View Event \u2192</a>' +
          '</div>' +
        '</div>';
      }).join('') + '</div>';

      if (sorted.length > 3) {
        container.innerHTML += '<p style="text-align:center;margin-top:1rem;"><a href="/events/">View all events \u2192</a></p>';
      }
    } catch (err) {
      container.innerHTML = '<p>Events for this chapter are coming soon.</p>';
    }
  })();
})();
