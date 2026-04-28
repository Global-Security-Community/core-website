(function() {
  var container = document.getElementById('chapter-events');
  if (!container) return;
  var chapterSlug = container.getAttribute('data-chapter-slug');
  if (!chapterSlug) return;

  // Try to load AI-generated chapter banner
  var banner = document.getElementById('chapter-banner');
  if (banner) {
    var bannerUrl = 'https://gsccoresa.blob.core.windows.net/generated-images/chapters/' + encodeURIComponent(chapterSlug) + '-banner.png';
    var img = document.getElementById('chapter-banner-img');
    img.onload = function() { banner.style.display = 'block'; };
    img.onerror = function() { banner.style.display = 'none'; };
    img.src = bannerUrl;
  }

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
        var isUpcoming = eventDate >= now;
        var badgeText = isUpcoming ? 'Upcoming' : 'Past Event';
        var badgeClass = isUpcoming ? 'event-badge event-badge--upcoming' : 'event-badge event-badge--past';
        var dateStr = new Date(e.date).toLocaleDateString('en-AU', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        var endStr = e.endDate ? ' \u2013 ' + new Date(e.endDate).toLocaleDateString('en-AU', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : '';
        return '<a href="/events/' + encodeURI(e.slug) + '/" class="event-card">' +
          '<div class="event-card-header">' +
            '<span class="' + badgeClass + '">' + badgeText + '</span>' +
            '<div class="event-card-date"><span class="icon" aria-hidden="true">' + GSCIcons.calendar + '</span> ' + dateStr + endStr + '</div>' +
            '<h3 class="event-card-title">' + GSC.esc(e.title) + '</h3>' +
          '</div>' +
          '<div class="event-card-body">' +
            '<div class="event-card-location"><span class="icon" aria-hidden="true">' + GSCIcons.mapPin + '</span> ' + GSC.esc((e.location || '').split('\n').join(', ')) + '</div>' +
          '</div>' +
          '<div class="event-card-footer">' +
            '<span class="event-card-btn">View Event \u2192</span>' +
          '</div>' +
        '</a>';
      }).join('') + '</div>';

      if (sorted.length > 3) {
        container.innerHTML += '<p class="chapter-events-more"><a href="/events/">View all events \u2192</a></p>';
      }
    } catch (err) {
      container.innerHTML = '<p>Events for this chapter are coming soon.</p>';
    }
  })();
})();
