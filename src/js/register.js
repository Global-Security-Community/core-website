(function() {
  var params = new URLSearchParams(window.location.search);
  var eventSlug = params.get('event');

  if (!eventSlug) {
    document.getElementById('event-info').innerHTML = '<p>No event specified. <a href="/events/">Browse events</a>.</p>';
    return;
  }

  // Fetch event details
  fetch('/api/getEvent?slug=' + encodeURIComponent(eventSlug))
    .then(function(r) { return r.json(); })
    .then(function(ev) {
      if (!ev || ev.error) {
        document.getElementById('event-info').innerHTML = '<p>Event not found. <a href="/events/">Browse events</a>.</p>';
        return;
      }
      document.getElementById('event-info').innerHTML =
        '<div class="card" style="max-width:600px;">' +
        '<h2 style="margin-top:0;">' + esc(ev.title) + '</h2>' +
        '<p>📅 ' + esc(ev.date) + (ev.endDate ? ' – ' + esc(ev.endDate) : '') + '</p>' +
        '<p>📍 ' + esc(ev.location) + '</p>' +
        '<p>🎟️ ' + ev.registrationCount + (ev.registrationCap > 0 ? ' / ' + ev.registrationCap : '') + ' registered</p>' +
        '</div>';

      if (ev.status === 'closed' || ev.status === 'completed') {
        document.getElementById('event-info').innerHTML += '<p style="color:#e74c3c;font-weight:600;">Registration is closed for this event.</p>';
        return;
      }
      if (ev.registrationCap > 0 && ev.registrationCount >= ev.registrationCap) {
        document.getElementById('event-info').innerHTML += '<p style="color:#e74c3c;font-weight:600;">This event has reached capacity.</p>';
        return;
      }

      document.getElementById('reg-form-wrap').style.display = 'block';

      // Pre-fill from auth
      fetch('/.auth/me')
        .then(function(r) { return r.json(); })
        .then(function(d) {
          if (d.clientPrincipal && d.clientPrincipal.userDetails) {
            document.getElementById('reg-email').value = d.clientPrincipal.userDetails;
          }
        });
    })
    .catch(function() {
      document.getElementById('event-info').innerHTML = '<p>Error loading event. Please try again.</p>';
    });

  // Registration submit
  document.getElementById('reg-form').addEventListener('submit', function(e) {
    e.preventDefault();
    var msg = document.getElementById('reg-message');
    var btn = this.querySelector('button');
    btn.disabled = true;
    btn.textContent = 'Registering...';

    var payload = {
      eventSlug: eventSlug,
      fullName: document.getElementById('reg-name').value,
      email: document.getElementById('reg-email').value,
      employmentStatus: document.getElementById('reg-employment').value,
      industry: document.getElementById('reg-industry').value,
      jobTitle: document.getElementById('reg-jobtitle').value,
      companySize: document.getElementById('reg-company-size').value,
      experienceLevel: document.getElementById('reg-experience').value
    };

    fetch('/api/registerEvent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    .then(function(r) { return r.json().then(function(d) { return {ok: r.ok, status: r.status, data: d}; }); })
    .then(function(res) {
      if (res.ok || res.status === 201) {
        document.getElementById('reg-form-wrap').style.display = 'none';
        document.getElementById('reg-success').style.display = 'block';
        document.getElementById('success-details').textContent = 'Ticket Code: ' + res.data.registration.ticketCode;
        if (res.data.registration.qrDataUrl) {
          document.getElementById('success-qr').innerHTML = '<img src="' + res.data.registration.qrDataUrl + '" alt="Ticket QR Code" style="width:200px;height:200px;">';
        }
      } else if (res.status === 409) {
        msg.style.display = 'block';
        msg.style.backgroundColor = '#fff3cd'; msg.style.color = '#856404';
        msg.textContent = 'You are already registered. Ticket code: ' + (res.data.ticketCode || '');
      } else {
        msg.style.display = 'block';
        msg.style.backgroundColor = '#f8d7da'; msg.style.color = '#721c24';
        msg.textContent = res.data.error || 'Registration failed. Please try again.';
      }
    })
    .catch(function() {
      msg.style.display = 'block';
      msg.style.backgroundColor = '#f8d7da'; msg.style.color = '#721c24';
      msg.textContent = 'Network error. Please try again.';
    })
    .finally(function() {
      btn.disabled = false;
      btn.textContent = 'Register';
    });
  });

  function esc(str) {
    if (!str) return '';
    var d = document.createElement('span');
    d.textContent = str;
    return d.innerHTML;
  }
})();
