(function() {
  fetch('/api/myTickets')
    .then(function(r) { return r.json(); })
    .then(function(data) {
      var el = document.getElementById('tickets-list');
      if (!data.tickets || data.tickets.length === 0) {
        el.innerHTML = '<p>You have no tickets yet. <a href="/events/">Browse upcoming events</a> to register.</p>';
        return;
      }
      var html = '<div class="cards">';
      data.tickets.forEach(function(t) {
        html += '<div class="card" style="text-align:center;">';
        html += '<h3 style="margin-top:0;">Ticket</h3>';
        html += '<p style="font-family:monospace; font-size:1.2rem; font-weight:600;">' + esc(t.ticketCode) + '</p>';
        if (t.qrDataUrl && t.qrDataUrl.indexOf('data:image/') === 0) {
          html += '<img src="' + t.qrDataUrl + '" alt="QR Code" style="width:160px;height:160px;margin:0.5rem 0;">';
        }
        html += '<p style="margin:0.5rem 0;">Registered: ' + esc(t.registeredAt ? new Date(t.registeredAt).toLocaleDateString() : '') + '</p>';
        if (t.checkedIn) {
          html += '<p style="color:var(--color-primary-teal);font-weight:600;">✅ Checked In</p>';
        } else {
          html += '<p style="color:#666;">Not yet checked in</p>';
        }
        html += '</div>';
      });
      html += '</div>';
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
})();
