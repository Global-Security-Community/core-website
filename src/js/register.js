(function() {
  var params = new URLSearchParams(window.location.search);
  var eventSlug = params.get('event');

  if (!eventSlug) {
    document.getElementById('event-info').innerHTML = '<p>No event specified. <a href="/events/">Browse events</a>.</p>';
    return;
  }

  // Fetch event details
  GSC.fetch('/api/getEvent?slug=' + encodeURIComponent(eventSlug))
    .then(function(r) { return r.json(); })
    .then(function(ev) {
      if (!ev || ev.error) {
        document.getElementById('event-info').innerHTML = '<p>Event not found. <a href="/events/">Browse events</a>.</p>';
        return;
      }
      document.getElementById('event-info').innerHTML =
        '<div class="card narrow-content">' +
        '<h2 class="mt-0">' + GSC.esc(ev.title) + '</h2>' +
        '<p><span class="icon" aria-hidden="true">' + GSCIcons.calendar + '</span> ' + GSC.esc(ev.date) + (ev.endDate ? ' – ' + GSC.esc(ev.endDate) : '') + '</p>' +
        '<p><span class="icon" aria-hidden="true">' + GSCIcons.mapPin + '</span> ' + GSC.esc(ev.location) + '</p>' +
        '<p><span class="icon" aria-hidden="true">' + GSCIcons.ticket + '</span> ' + ev.registrationCount + (ev.registrationCap > 0 ? ' / ' + ev.registrationCap : '') + ' registered</p>' +
        '</div>';

      if (ev.status === 'closed' || ev.status === 'completed') {
        document.getElementById('event-info').innerHTML += '<p class="reg-closed-msg">Registration is closed for this event.</p>';
        return;
      }
      if (ev.registrationCap > 0 && ev.registrationCount >= ev.registrationCap) {
        document.getElementById('event-info').innerHTML += '<p class="reg-closed-msg">This event has reached capacity.</p>';
        return;
      }

      document.getElementById('reg-form-wrap').style.display = 'block';

      // Volunteer interest toggle
      document.getElementById('reg-volunteer-interest').addEventListener('change', function() {
        var box = document.getElementById('volunteer-confirm');
        box.style.display = this.checked ? 'block' : 'none';
        if (!this.checked) document.getElementById('reg-volunteer-confirm').checked = false;
      });

      fetch('/.auth/me')
        .then(function(r) { return r.json(); })
        .then(function(d) {
          if (d.clientPrincipal && d.clientPrincipal.userDetails) {
            document.getElementById('reg-email').value = d.clientPrincipal.userDetails;
          }
          // Pre-fill name from CIAM claims if available
          if (d.clientPrincipal && d.clientPrincipal.claims) {
            var claims = d.clientPrincipal.claims;
            var getClaim = function(type) { var c = claims.find(function(x) { return x.typ === type; }); return c ? c.val : ''; };
            var name = getClaim('name');
            if (name) document.getElementById('reg-name').value = name;
            var email = getClaim('preferred_username') || getClaim('http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress');
            if (email) document.getElementById('reg-email').value = email;
          }
        })
        .catch(function() {});
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

    var volunteerInterest = document.getElementById('reg-volunteer-interest').checked &&
                            document.getElementById('reg-volunteer-confirm').checked;

    var turnstileResponse = document.querySelector('[name="cf-turnstile-response"]');
    var turnstileToken = turnstileResponse ? turnstileResponse.value : '';

    var payload = {
      eventSlug: eventSlug,
      fullName: document.getElementById('reg-name').value,
      email: document.getElementById('reg-email').value,
      company: document.getElementById('reg-company').value,
      employmentStatus: document.getElementById('reg-employment').value,
      industry: document.getElementById('reg-industry').value,
      jobTitle: document.getElementById('reg-jobtitle').value,
      companySize: document.getElementById('reg-company-size').value,
      experienceLevel: document.getElementById('reg-experience').value,
      volunteerInterest: volunteerInterest,
      turnstileToken: turnstileToken
    };

    GSC.fetch('/api/registerEvent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    .then(function(r) { return r.json().then(function(d) { return {ok: r.ok, status: r.status, data: d}; }); })
    .then(function(res) {
      if (res.ok || res.status === 201) {
        var r = res.data.registration;
        document.getElementById('reg-form-wrap').style.display = 'none';
        document.getElementById('reg-success').style.display = 'block';
        var ticketHtml = '<div class="ticket">' +
          '<div class="ticket-header">' +
            '<div>' +
              '<div class="ticket-event-name">' + GSC.esc(r.eventTitle) + '</div>' +
              '<div class="ticket-event-date"><span class="icon" aria-hidden="true">' + GSCIcons.calendar + '</span> ' + GSC.formatDate(r.eventDate) + '</div>' +
              '<div class="ticket-event-location">' + GSC.formatLocation(r.eventLocation) + '</div>' +
            '</div>' +
            '<img src="/assets/GSC-Shield-Transparent.png" alt="" class="ticket-header-logo">' +
          '</div>' +
          '<div class="ticket-body">' +
            '<div class="ticket-qr">' +
              (r.qrDataUrl && r.qrDataUrl.indexOf('data:image/') === 0 ? '<img src="' + r.qrDataUrl + '" alt="Ticket QR Code">' : '') +
            '</div>' +
            '<div class="ticket-code">' + GSC.esc(r.ticketCode) + '</div>' +
            '<div class="ticket-type">ATTENDEE</div>' +
            '<div class="ticket-name">' + GSC.esc(r.fullName) + (r.company ? ' \u2013 ' + GSC.esc(r.company) : '') + '</div>' +
          '</div>' +
        '</div>';
        document.getElementById('success-qr').innerHTML = ticketHtml;
        document.getElementById('success-details').textContent = '';
        // Show email status message
        var emailMsg = document.getElementById('success-email-status');
        if (emailMsg) {
          if (res.data.emailSent) {
            emailMsg.innerHTML = '<p>A confirmation email with your ticket has been sent.</p>' +
              '<p class="help-text"><span class="icon" aria-hidden="true">' + GSCIcons.mail + '</span> Can\'t find it? Please check your junk or spam folder.</p>';
          } else {
            emailMsg.innerHTML = '<div class="form-message form-message--warning" style="display:block;">' +
              '<p><strong>We couldn\'t send a confirmation email.</strong></p>' +
              '<p>Your registration is confirmed — you can find your ticket on the <a href="/my-tickets/">My Tickets</a> page. ' +
              'If you need a copy emailed, please <a href="/contact/">contact us</a>.</p></div>';
          }
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
})();
