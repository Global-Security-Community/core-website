(function() {
  fetch('/api/myTickets')
    .then(function(r) { return r.json(); })
    .then(function(data) {
      var el = document.getElementById('tickets-list');
      if (!data.tickets || data.tickets.length === 0) {
        el.innerHTML = '<p>You have no tickets yet. <a href="/events/">Browse upcoming events</a> to register.</p>';
        return;
      }
      var html = '';
      data.tickets.forEach(function(t) {
        html += '<div class="ticket">' +
          '<div class="ticket-header">' +
            '<div>' +
              '<div class="ticket-event-name">' + esc(t.eventTitle || 'Event') + '</div>' +
              '<div class="ticket-event-date">\ud83d\udcc5 ' + formatDate(t.eventDate) +
                (t.eventEndDate ? ' \u2013 ' + formatDate(t.eventEndDate) : '') + '</div>' +
              '<div class="ticket-event-location">' + formatLocation(t.eventLocation) + '</div>' +
            '</div>' +
            '<img src="/assets/GSC-Shield-Transparent.png" alt="" class="ticket-header-logo">' +
          '</div>' +
          '<div class="ticket-body">' +
            '<div class="ticket-qr">' +
              (t.qrDataUrl && t.qrDataUrl.indexOf('data:image/') === 0 ? '<img src="' + t.qrDataUrl + '" alt="QR Code">' : '') +
            '</div>' +
            '<div class="ticket-code">' + esc(t.ticketCode) + '</div>' +
            '<div class="ticket-type">ATTENDEE</div>' +
            '<div class="ticket-name">' + esc(t.fullName) + (t.company ? ' \u2013 ' + esc(t.company) : '') + '</div>' +
          '</div>' +
          '<div class="ticket-footer">' +
            (t.checkedIn
              ? '<span class="ticket-status ticket-status--checked">\u2705 Checked In</span>'
              : '<span class="ticket-status ticket-status--pending">Awaiting Check-in</span>') +
            (t.eventSlug ? '<a href="/events/' + esc(t.eventSlug) + '/" class="ticket-event-link">View Event</a>' : '') +
          '</div>' +
        '</div>';
      });
      el.innerHTML = html;
    })
    .catch(function() {
      document.getElementById('tickets-list').innerHTML = '<p>Error loading tickets. Please try again.</p>';
    });

  function esc(str) {
    if (!str) return '';
    var d = document.createElement('span');
    d.textContent = str;
    return d.innerHTML;
  }

  function formatDate(dateStr) {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('en-AU', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  }

  function formatLocation(loc) {
    if (!loc) return '';
    return loc.split('\n').map(function(line) { return esc(line.trim()); }).filter(Boolean).join('<br>');
  }
})();
