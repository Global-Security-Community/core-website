(function() {
  var currentSection = 'events';
  var currentEventId = '';
  var currentChapterSlug = '';

  function showSection(s) {
    currentSection = s;
    ['events','create','detail'].forEach(function(id) {
      document.getElementById('section-' + id).style.display = id === s ? 'block' : 'none';
    });
  }

  // Wire up navigation buttons
  document.getElementById('btn-events').addEventListener('click', function() { showSection('events'); });
  document.getElementById('btn-create').addEventListener('click', function() { showSection('create'); });
  document.getElementById('btn-back-events').addEventListener('click', function() { showSection('events'); });

  // Check auth
  fetch('/.auth/me')
    .then(function(r) { return r.json(); })
    .then(function(d) {
      if (d.clientPrincipal) {
        document.getElementById('dash-user').textContent = 'Welcome, ' + (d.clientPrincipal.userDetails || 'Admin');
        loadEvents();
      }
    });

  function loadEvents() {
    fetch('/api/eventAttendance?action=list')
      .then(function(r) { return r.json(); })
      .then(function(data) {
        var el = document.getElementById('events-list');
        if (!data.events || data.events.length === 0) {
          el.innerHTML = '<p>No events yet. Create your first event!</p>';
          return;
        }
        var html = '<div class="cards">';
        data.events.forEach(function(ev) {
          html += '<div class="card event-card" style="cursor:pointer;" data-event-id="' + esc(ev.id) + '" data-chapter-slug="' + esc(ev.chapterSlug) + '">';
          html += '<h3 style="margin-top:0;">' + esc(ev.title) + '</h3>';
          html += '<p>📅 ' + esc(ev.date) + ' &nbsp; 📍 ' + esc(ev.location) + '</p>';
          html += '<p>🎟️ ' + ev.registrationCount + (ev.registrationCap > 0 ? ' / ' + ev.registrationCap : '') + ' registered</p>';
          html += '<span style="display:inline-block;padding:0.25rem 0.75rem;border-radius:12px;font-size:0.8rem;background:' + statusColour(ev.status) + ';color:white;">' + esc(ev.status) + '</span>';
          html += '</div>';
        });
        html += '</div>';
        el.innerHTML = html;

        // Attach click handlers to event cards
        el.querySelectorAll('.event-card').forEach(function(card) {
          card.addEventListener('click', function() {
            viewEvent(card.dataset.eventId, card.dataset.chapterSlug);
          });
        });
      })
      .catch(function() {
        document.getElementById('events-list').innerHTML = '<p>Failed to load events.</p>';
      });
  }

  function viewEvent(eventId, chapterSlug) {
    currentEventId = eventId;
    currentChapterSlug = chapterSlug;
    showSection('detail');
    document.getElementById('detail-title').textContent = 'Loading...';
    document.getElementById('detail-attendees').innerHTML = '<p>Loading...</p>';

    fetch('/api/eventAttendance?eventId=' + encodeURIComponent(eventId))
      .then(function(r) { return r.json(); })
      .then(function(data) {
        document.getElementById('detail-title').textContent = 'Attendance: ' + data.eventId;
        document.getElementById('detail-stats').innerHTML =
          '<div class="card" style="text-align:center;flex:1;"><p style="font-size:2rem;margin:0;">' + data.total + '</p><p style="margin:0;">Registered</p></div>' +
          '<div class="card" style="text-align:center;flex:1;"><p style="font-size:2rem;margin:0;">' + data.checkedIn + '</p><p style="margin:0;">Checked In</p></div>';

        var actionsEl = document.getElementById('detail-actions');
        actionsEl.innerHTML =
          '<button id="btn-export" style="margin-right:0.5rem;">Export CSV</button>' +
          '<a href="/scanner/?event=' + encodeURIComponent(eventId) + '" style="display:inline-block;padding:0.75rem 1.5rem;background:var(--color-primary-teal);color:white;border-radius:4px;text-decoration:none;font-weight:600;margin-right:0.5rem;">Open Scanner</a>' +
          '<button id="btn-close-reg" style="background:var(--color-accent-orange);margin-right:0.5rem;">Close Registration</button>' +
          '<button id="btn-complete" style="background:#e74c3c;">Mark Completed & Issue Badges</button>';

        document.getElementById('btn-export').addEventListener('click', function() { exportCSV(eventId); });
        document.getElementById('btn-close-reg').addEventListener('click', function() { closeReg(eventId, chapterSlug); });
        document.getElementById('btn-complete').addEventListener('click', function() { completeEvent(eventId, chapterSlug); });

        // Load volunteers
        loadVolunteers(eventId);
        // Wire up add volunteer button
        var addBtn = document.getElementById('vol-add-btn');
        addBtn.onclick = function() { addVolunteer(eventId); };

        if (!data.attendees || data.attendees.length === 0) {
          document.getElementById('detail-attendees').innerHTML = '<p>No registrations yet.</p>';
          return;
        }
        var html = '<table style="width:100%;border-collapse:collapse;"><thead><tr style="border-bottom:2px solid var(--color-border);"><th style="text-align:left;padding:0.5rem;">Name</th><th style="text-align:left;padding:0.5rem;">Email</th><th style="text-align:left;padding:0.5rem;">Ticket</th><th style="text-align:left;padding:0.5rem;">Checked In</th></tr></thead><tbody>';
        data.attendees.forEach(function(a) {
          html += '<tr style="border-bottom:1px solid var(--color-border);">';
          html += '<td style="padding:0.5rem;">' + esc(a.name) + '</td>';
          html += '<td style="padding:0.5rem;">' + esc(a.email) + '</td>';
          html += '<td style="padding:0.5rem;font-family:monospace;">' + esc(a.ticketCode) + '</td>';
          html += '<td style="padding:0.5rem;">' + (a.checkedIn ? '✅ ' + esc(a.checkedInAt) : '—') + '</td>';
          html += '</tr>';
        });
        html += '</tbody></table>';
        document.getElementById('detail-attendees').innerHTML = html;
      });
  }

  function exportCSV(eventId) {
    window.open('/api/eventAttendance?eventId=' + encodeURIComponent(eventId) + '&format=csv', '_blank');
  };

  function closeReg(eventId, chapterSlug) {
    if (!confirm('Close registration for this event?')) return;
    fetch('/api/eventAttendance', {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ eventId: eventId, chapterSlug: chapterSlug, status: 'closed' })
    }).then(function() { alert('Registration closed.'); loadEvents(); });
  }

  function completeEvent(eventId, chapterSlug) {
    if (!confirm('Mark event as completed and issue attendee badges?')) return;
    fetch('/api/eventAttendance', {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ eventId: eventId, chapterSlug: chapterSlug, status: 'completed' })
    }).then(function() {
      return fetch('/api/issueBadges', {
        method: 'POST', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ eventId: eventId, chapterSlug: chapterSlug, badgeType: 'Attendee' })
      });
    }).then(function(r) { return r.json(); })
    .then(function(d) { alert('Event completed. ' + (d.issued || 0) + ' badges issued.'); loadEvents(); });
  }

  // Create event handler
  document.getElementById('create-btn').addEventListener('click', function() {
    var btn = this;
    var msg = document.getElementById('create-message');
    btn.disabled = true;
    btn.textContent = 'Creating...';

    var payload = {
      title: document.getElementById('ev-title').value,
      date: document.getElementById('ev-date').value,
      endDate: document.getElementById('ev-enddate').value,
      location: document.getElementById('ev-location').value,
      description: document.getElementById('ev-description').value,
      sessionizeApiId: document.getElementById('ev-sessionize').value,
      registrationCap: document.getElementById('ev-cap').value,
      chapterSlug: document.getElementById('ev-chapter').value
    };

    fetch('/api/createEvent', {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify(payload)
    })
    .then(function(r) { return r.json().then(function(d) { return {ok: r.ok, data: d}; }); })
    .then(function(res) {
      msg.style.display = 'block';
      if (res.ok) {
        msg.style.backgroundColor = '#d4edda'; msg.style.color = '#155724';
        msg.textContent = 'Event created! Page will be generated shortly. Slug: ' + res.data.event.slug;
        loadEvents();
      } else {
        msg.style.backgroundColor = '#f8d7da'; msg.style.color = '#721c24';
        msg.textContent = res.data.error || 'Failed to create event.';
      }
    })
    .catch(function() {
      msg.style.display = 'block';
      msg.style.backgroundColor = '#f8d7da'; msg.style.color = '#721c24';
      msg.textContent = 'Network error. Please try again.';
    })
    .finally(function() { btn.disabled = false; btn.textContent = 'Create Event'; });
  });

  function statusColour(s) {
    if (s === 'published') return 'var(--color-primary-teal)';
    if (s === 'closed') return 'var(--color-accent-orange)';
    if (s === 'completed') return '#666';
    return '#999';
  }

  function loadVolunteers(eventId) {
    var el = document.getElementById('volunteer-list');
    el.innerHTML = '<p>Loading volunteers...</p>';
    fetch('/api/eventVolunteers?eventId=' + encodeURIComponent(eventId))
      .then(function(r) { return r.json(); })
      .then(function(data) {
        if (!data.volunteers || data.volunteers.length === 0) {
          el.innerHTML = '<p style="color:#666;">No volunteers added yet.</p>';
          return;
        }
        var html = '<table style="width:100%;border-collapse:collapse;margin-bottom:1rem;"><thead><tr><th style="text-align:left;padding:0.5rem;">Name</th><th style="text-align:left;padding:0.5rem;">Email</th><th style="padding:0.5rem;"></th></tr></thead><tbody>';
        data.volunteers.forEach(function(v) {
          html += '<tr style="border-bottom:1px solid var(--color-border);">';
          html += '<td style="padding:0.5rem;">' + esc(v.name) + '</td>';
          html += '<td style="padding:0.5rem;">' + esc(v.email) + '</td>';
          html += '<td style="padding:0.5rem;"><button class="vol-remove-btn" data-vol-id="' + esc(v.id) + '" style="background:#e74c3c;padding:0.25rem 0.75rem;font-size:0.8rem;">Remove</button></td>';
          html += '</tr>';
        });
        html += '</tbody></table>';
        el.innerHTML = html;

        // Attach remove handlers
        el.querySelectorAll('.vol-remove-btn').forEach(function(btn) {
          btn.addEventListener('click', function() {
            removeVol(eventId, btn.dataset.volId);
          });
        });
      })
      .catch(function() { el.innerHTML = '<p>Failed to load volunteers.</p>'; });
  }

  function addVolunteer(eventId) {
    var nameEl = document.getElementById('vol-name');
    var emailEl = document.getElementById('vol-email');
    var email = emailEl.value.trim();
    var name = nameEl.value.trim();
    if (!email) { alert('Please enter the volunteer\'s email.'); return; }
    fetch('/api/eventVolunteers', {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ eventId: eventId, email: email, name: name })
    })
    .then(function(r) { return r.json(); })
    .then(function(d) {
      if (d.success) {
        nameEl.value = ''; emailEl.value = '';
        loadVolunteers(eventId);
      } else {
        alert(d.error || 'Failed to add volunteer.');
      }
    })
    .catch(function() { alert('Network error.'); });
  }

  function removeVol(eventId, volunteerId) {
    if (!confirm('Remove this volunteer?')) return;
    fetch('/api/eventVolunteers', {
      method: 'DELETE', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ eventId: eventId, volunteerId: volunteerId })
    })
    .then(function() { loadVolunteers(eventId); });
  }

  function esc(str) {
    if (!str) return '';
    var d = document.createElement('span');
    d.textContent = str;
    return d.innerHTML;
  }
})();
