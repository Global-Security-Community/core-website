(async function() {
  var container = document.getElementById('events-list');
  if (!container) return;
  try {
    var res = await fetch('/api/getEvent?action=list');
    if (!res.ok) throw new Error('Failed to load events');
    var events = await res.json();

    var now = new Date();
    now.setHours(0, 0, 0, 0);

    var upcoming = events.filter(function(e) {
      var eventDate = new Date(e.endDate || e.date);
      return eventDate >= now;
    }).sort(function(a, b) { return new Date(a.date) - new Date(b.date); });

    var past = events.filter(function(e) {
      var eventDate = new Date(e.endDate || e.date);
      return eventDate < now;
    }).sort(function(a, b) { return new Date(b.date) - new Date(a.date); });

    var html = '';

    if (upcoming.length) {
      html += '<div class="events-grid">' + upcoming.map(renderEventCard).join('') + '</div>';
    } else {
      html += '<div class="card events-empty"><h3>Events Coming Soon</h3><p>We\'re planning exciting events. Check back soon or <a href="/chapters/">find your chapter</a> to get notified!</p></div>';
    }

    if (past.length) {
      html += '<h2 class="events-past-heading">Past Events</h2>';
      html += '<div class="events-grid">' + past.map(function(e) { return renderEventCard(e, true); }).join('') + '</div>';
    }

    container.innerHTML = html;
  } catch (err) {
    container.innerHTML = '<p>Unable to load events. Please try again later.</p>';
  }

  function renderEventCard(e, isPast) {
    var dateStr = new Date(e.date).toLocaleDateString('en-AU', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    var endStr = e.endDate ? ' \u2013 ' + new Date(e.endDate).toLocaleDateString('en-AU', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : '';
    var locationStr = GSC.esc((e.location || '').split('\n').join(', '));
    var btnText = isPast ? 'View Event' : 'View Event \u2192';
    var pastClass = isPast ? ' event-card--past' : '';
    return '<a href="/events/' + encodeURI(e.slug) + '/" class="event-card' + pastClass + '">' +
      '<div class="event-card-header">' +
        '<div class="event-card-date"><span class="icon" aria-hidden="true">' + GSCIcons.calendar + '</span> ' + dateStr + endStr + '</div>' +
        (isPast ? '<span class="status-badge status-badge--completed status-badge--inline">Completed</span>' : '') +
        '<h3 class="event-card-title">' + GSC.esc(e.title) + '</h3>' +
      '</div>' +
      '<div class="event-card-body">' +
        '<div class="event-card-location"><span class="icon" aria-hidden="true">' + GSCIcons.mapPin + '</span> ' + locationStr + '</div>' +
      '</div>' +
      '<div class="event-card-footer">' +
        '<span class="event-card-btn">' + btnText + '</span>' +
      '</div>' +
    '</a>';
  }
})();
