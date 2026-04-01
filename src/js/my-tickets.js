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
        html += '<div class="ticket" id="ticket-' + GSC.esc(t.registrationId) + '">' +
          '<div class="ticket-header">' +
            '<div>' +
              '<div class="ticket-event-name">' + GSC.esc(t.eventTitle || 'Event') + '</div>' +
              '<div class="ticket-event-date">\ud83d\udcc5 ' + GSC.formatDate(t.eventDate) +
                (t.eventEndDate ? ' \u2013 ' + GSC.formatDate(t.eventEndDate) : '') + '</div>' +
              '<div class="ticket-event-location">' + GSC.formatLocation(t.eventLocation) + '</div>' +
            '</div>' +
            '<img src="/assets/GSC-Shield-Transparent.png" alt="" class="ticket-header-logo">' +
          '</div>' +
          '<div class="ticket-body">' +
            '<div class="ticket-qr">' +
              (t.qrDataUrl && t.qrDataUrl.indexOf('data:image/') === 0 ? '<img src="' + t.qrDataUrl + '" alt="QR Code">' : '') +
            '</div>' +
            '<div class="ticket-code">' + GSC.esc(t.ticketCode) + '</div>' +
            '<div class="ticket-type"><span class="role-badge role-badge--' + GSC.esc(t.role || 'attendee') + '">' + GSC.esc((t.role || 'attendee').toUpperCase()) + '</span></div>' +
            '<div class="ticket-name">' + GSC.esc(t.fullName) + (t.company ? ' \u2013 ' + GSC.esc(t.company) : '') + '</div>' +
          '</div>' +
          '<div class="ticket-footer">' +
            (t.checkedIn
              ? '<span class="ticket-status ticket-status--checked">\u2705 Checked In</span>'
              : '<span class="ticket-status ticket-status--pending">Awaiting Check-in</span>') +
            (t.eventSlug ? '<a href="/events/' + GSC.esc(t.eventSlug) + '/" class="ticket-event-link">View Event</a>' : '') +
            (!t.checkedIn ? '<button class="ticket-cancel-btn" data-reg-id="' + GSC.esc(t.registrationId) + '" data-event="' + GSC.esc(t.eventTitle) + '">Cancel Registration</button>' : '') +
          '</div>' +
        '</div>';
      });
      el.innerHTML = html;

      // Attach cancel handlers
      el.querySelectorAll('.ticket-cancel-btn').forEach(function(btn) {
        btn.addEventListener('click', function() {
          var regId = this.getAttribute('data-reg-id');
          var eventName = this.getAttribute('data-event');
          if (!confirm('Are you sure you want to cancel your registration for ' + eventName + '? This cannot be undone.')) return;
          var cancelBtn = this;
          cancelBtn.disabled = true;
          cancelBtn.textContent = 'Cancelling...';
          fetch('/api/cancelRegistration', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ registrationId: regId })
          })
          .then(function(r) {
            var contentType = r.headers.get('content-type') || '';
            if (contentType.indexOf('application/json') === -1) {
              throw new Error('Unexpected response (status ' + r.status + '). Please refresh the page and try again.');
            }
            return r.json().then(function(d) { return { ok: r.ok, data: d }; });
          })
          .then(function(res) {
            if (res.ok) {
              var ticketEl = document.getElementById('ticket-' + regId);
              if (ticketEl) {
                ticketEl.style.opacity = '0.5';
                ticketEl.innerHTML = '<div style="padding:2rem;text-align:center;"><p>\u2705 Registration cancelled.</p><p style="font-size:0.85em;color:#666;">\ud83d\udce7 A cancellation confirmation has been sent. Check your junk folder if you don\'t see it.</p></div>';
                setTimeout(function() { ticketEl.remove(); }, 2000);
              }
            } else {
              alert(res.data.error || 'Failed to cancel registration.');
              cancelBtn.disabled = false;
              cancelBtn.textContent = 'Cancel Registration';
            }
          })
          .catch(function(err) {
            alert(err.message || 'Network error. Please try again.');
            cancelBtn.disabled = false;
            cancelBtn.textContent = 'Cancel Registration';
          });
        });
      });
    })
    .catch(function() {
      document.getElementById('tickets-list').innerHTML = '<p>Error loading tickets. Please try again.</p>';
    });
})();
