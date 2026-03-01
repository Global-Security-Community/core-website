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
    })
    .catch(function() {
      document.getElementById('dash-user').textContent = 'Error loading user info.';
    });

  function loadEvents() {
    fetch('/api/eventAttendance?action=list')
      .then(function(r) { return r.json(); })
      .then(function(data) {
        var el = document.getElementById('events-list');
        if (data.chapterCity) {
          document.getElementById('dash-title').textContent = data.chapterCity + ' Chapter Management';
        }
        if (!data.events || data.events.length === 0) {
          el.innerHTML = '<p>No events yet. Create your first event!</p>';
          return;
        }
        var html = '<div class="cards">';
        data.events.forEach(function(ev) {
          html += '<div class="card event-card" data-event-id="' + esc(ev.id) + '" data-chapter-slug="' + esc(ev.chapterSlug) + '" data-event-title="' + esc(ev.title) + '">';
          html += '<h3>' + esc(ev.title) + '</h3>';
          html += '<p>📅 ' + esc(ev.date) + ' &nbsp; 📍 ' + esc(ev.location) + '</p>';
          html += '<p>🎟️ ' + ev.registrationCount + (ev.registrationCap > 0 ? ' / ' + ev.registrationCap : '') + ' registered</p>';
          html += '<span class="status-badge status-badge--' + esc(ev.status || 'default') + '">' + esc(ev.status) + '</span>';
          html += '</div>';
        });
        html += '</div>';
        el.innerHTML = html;

        // Attach click handlers to event cards
        el.querySelectorAll('.event-card').forEach(function(card) {
          card.addEventListener('click', function() {
            viewEvent(card.dataset.eventId, card.dataset.chapterSlug, card.dataset.eventTitle);
          });
        });
      })
      .catch(function() {
        document.getElementById('events-list').innerHTML = '<p>Failed to load events.</p>';
      });
  }

  function viewEvent(eventId, chapterSlug, eventTitle) {
    currentEventId = eventId;
    currentChapterSlug = chapterSlug;
    showSection('detail');
    document.getElementById('detail-title').textContent = eventTitle || 'Loading...';
    document.getElementById('detail-subtitle').textContent = '';
    document.getElementById('detail-attendees').innerHTML = '<p>Loading...</p>';

    fetch('/api/eventAttendance?eventId=' + encodeURIComponent(eventId))
      .then(function(r) { return r.json(); })
      .then(function(data) {
        // Event code with copy
        var subtitleEl = document.getElementById('detail-subtitle');
        subtitleEl.innerHTML = 'Event Code: <code style="cursor:pointer;background:#e9ecef;padding:2px 8px;border-radius:4px;font-size:0.85em;" title="Click to copy">' + esc(data.eventId) + '</code>';
        subtitleEl.querySelector('code').addEventListener('click', function() {
          navigator.clipboard.writeText(data.eventId).then(function() {
            var el = document.getElementById('detail-subtitle').querySelector('code');
            var orig = el.textContent;
            el.textContent = 'Copied!';
            setTimeout(function() { el.textContent = orig; }, 1500);
          });
        });

        // 4-column grid: 2 stat cards + 2 action groups
        document.getElementById('detail-panel').innerHTML =
          '<div class="card stat-card"><p class="stat-number">' + data.total + '</p><p class="stat-label">Registered</p></div>' +
          '<div class="card stat-card"><p class="stat-number">' + data.checkedIn + '</p><p class="stat-label">Checked In</p></div>' +
          '<div class="action-card card">' +
            '<button id="btn-export" style="width:100%">Export CSV</button>' +
            '<a href="/scanner/?event=' + encodeURIComponent(eventId) + '" class="btn-link" style="width:100%;text-align:center;display:block;box-sizing:border-box;">Open Scanner</a>' +
          '</div>' +
          '<div class="action-card card">' +
            '<button id="btn-close-reg" class="btn-warning" style="width:100%">Close Registration</button>' +
            '<button id="btn-complete" class="btn-danger" style="width:100%">Mark Completed & Issue Badges</button>' +
          '</div>';

        var actionsEl = document.getElementById('detail-actions');
        actionsEl.innerHTML = '';

        document.getElementById('btn-export').addEventListener('click', function() { exportCSV(eventId); });
        document.getElementById('btn-close-reg').addEventListener('click', function() { closeReg(eventId, chapterSlug); });
        document.getElementById('btn-complete').addEventListener('click', function() { completeEvent(eventId, chapterSlug); });

        // Load volunteers
        loadVolunteers(eventId);
        // Wire up add volunteer button
        var addBtn = document.getElementById('vol-add-btn');
        addBtn.addEventListener('click', function() { addVolunteer(eventId); });

        if (!data.attendees || data.attendees.length === 0) {
          document.getElementById('detail-attendees').innerHTML = '<p>No registrations yet.</p>';
          return;
        }
        var html = '<table><thead><tr><th>Name</th><th>Email</th><th>Ticket</th><th>Checked In</th></tr></thead><tbody>';
        data.attendees.forEach(function(a) {
          html += '<tr>';
          html += '<td>' + esc(a.name) + '</td>';
          html += '<td>' + esc(a.email) + '</td>';
          html += '<td style="font-family:monospace;">' + esc(a.ticketCode) + '</td>';
          html += '<td>' + (a.checkedIn ? '✅ ' + esc(a.checkedInAt) : '—') + '</td>';
          html += '</tr>';
        });
        html += '</tbody></table>';
        document.getElementById('detail-attendees').innerHTML = html;
      })
      .catch(function() {
        document.getElementById('detail-title').textContent = 'Error loading event details';
        document.getElementById('detail-attendees').innerHTML = '<p>Failed to load. Please try again.</p>';
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
    })
    .then(function(r) {
      if (!r.ok) throw new Error('Failed');
      alert('Registration closed.'); loadEvents();
    })
    .catch(function() { alert('Failed to close registration. Please try again.'); });
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
    .then(function(d) { alert('Event completed. ' + (d.issued || 0) + ' badges issued.'); loadEvents(); })
    .catch(function() { alert('Failed to complete event. Please try again.'); });
  }

  // Create event handler
  var createSubmitting = false;
  document.getElementById('create-btn').addEventListener('click', function() {
    if (createSubmitting) return;
    createSubmitting = true;
    var btn = this;
    var msg = document.getElementById('create-message');
    btn.disabled = true;
    btn.textContent = 'Creating...';

    var payload = {
      title: document.getElementById('ev-title').value,
      date: document.getElementById('ev-date').value,
      endDate: document.getElementById('ev-enddate').value,
      locationBuilding: document.getElementById('ev-building').value,
      locationAddress1: document.getElementById('ev-address1').value,
      locationAddress2: document.getElementById('ev-address2').value,
      locationCity: document.getElementById('ev-city').value,
      locationState: document.getElementById('ev-state').value,
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
      if (res.ok) {
        showCreateProgress(res.data.event);
        loadEvents();
      } else {
        msg.style.display = 'block';
        msg.style.backgroundColor = '#f8d7da'; msg.style.color = '#721c24';
        msg.textContent = res.data.error || 'Failed to create event.';
        btn.disabled = false; btn.textContent = 'Create Event';
        createSubmitting = false;
      }
    })
    .catch(function() {
      msg.style.display = 'block';
      msg.style.backgroundColor = '#f8d7da'; msg.style.color = '#721c24';
      msg.textContent = 'Network error. Please try again.';
      btn.disabled = false; btn.textContent = 'Create Event';
      createSubmitting = false;
    });
  });

  function setStepState(stepId, state) {
    var el = document.getElementById(stepId);
    el.className = 'pipeline-step ' + state;
    var icon = el.querySelector('.step-icon');
    if (state === 'done') icon.textContent = '✅';
    else if (state === 'active') icon.textContent = '🔄';
    else if (state === 'error') icon.textContent = '❌';
    else icon.textContent = '⏳';
  }

  function showCreateProgress(event) {
    document.getElementById('create-form-wrap').style.display = 'none';
    document.getElementById('create-message').style.display = 'none';
    var progress = document.getElementById('create-progress');
    progress.style.display = 'block';
    document.getElementById('create-progress-title').textContent = event.title;

    // Step 1: Stored — already done
    setStepState('step-stored', 'done');

    // Step 2: Page generation triggered
    setStepState('step-page', 'active');

    // Poll for event page to come live
    var slug = event.slug;
    var pageUrl = '/events/' + slug + '/';
    var attempts = 0;
    var maxAttempts = 30; // ~2.5 minutes

    var pollTimer = setInterval(function() {
      attempts++;
      fetch(pageUrl, { method: 'HEAD' })
        .then(function(r) {
          if (r.ok) {
            clearInterval(pollTimer);
            setStepState('step-page', 'done');
            setStepState('step-live', 'done');
            var link = document.getElementById('create-progress-link');
            link.href = pageUrl;
            link.style.display = 'inline-block';
            document.getElementById('create-another-btn').style.display = 'inline-block';
          } else if (attempts >= maxAttempts) {
            clearInterval(pollTimer);
            setStepState('step-page', 'done');
            setStepState('step-live', 'error');
            document.querySelector('.pipeline-note').textContent = 'Page generation is taking longer than expected. It may still be deploying — check back in a few minutes.';
            document.getElementById('create-another-btn').style.display = 'inline-block';
          }
        })
        .catch(function() {
          if (attempts >= maxAttempts) {
            clearInterval(pollTimer);
            setStepState('step-page', 'done');
            setStepState('step-live', 'error');
            document.querySelector('.pipeline-note').textContent = 'Could not verify page deployment. It may still be in progress.';
            document.getElementById('create-another-btn').style.display = 'inline-block';
          }
        });
    }, 5000);

    // Mark page generation as done after ~15s (workflow dispatch is near-instant)
    setTimeout(function() {
      if (document.getElementById('step-page').classList.contains('active')) {
        setStepState('step-page', 'done');
        setStepState('step-live', 'active');
      }
    }, 15000);
  }

  // "Create Another Event" resets the form
  document.getElementById('create-another-btn').addEventListener('click', function() {
    createSubmitting = false;
    document.getElementById('create-form-wrap').style.display = '';
    document.getElementById('create-progress').style.display = 'none';
    document.getElementById('create-btn').disabled = false;
    document.getElementById('create-btn').textContent = 'Create Event';
    // Clear form fields
    ['ev-title','ev-date','ev-enddate','ev-building','ev-address1','ev-address2','ev-city','ev-state','ev-description','ev-sessionize','ev-chapter'].forEach(function(id) {
      document.getElementById(id).value = '';
    });
    document.getElementById('ev-cap').value = '0';
    // Reset pipeline steps
    ['step-stored','step-page','step-live'].forEach(function(id) { setStepState(id, 'pending'); });
    document.getElementById('create-progress-link').style.display = 'none';
    document.getElementById('create-another-btn').style.display = 'none';
  });

  function loadVolunteers(eventId) {
    var el = document.getElementById('volunteer-list');
    el.innerHTML = '<p>Loading volunteers...</p>';
    fetch('/api/eventVolunteers?eventId=' + encodeURIComponent(eventId))
      .then(function(r) { return r.json(); })
      .then(function(data) {
        if (!data.volunteers || data.volunteers.length === 0) {
          el.innerHTML = '<p class="text-muted">No volunteers added yet.</p>';
          return;
        }
        var html = '<table><thead><tr><th>Name</th><th>Email</th><th></th></tr></thead><tbody>';
        data.volunteers.forEach(function(v) {
          html += '<tr>';
          html += '<td>' + esc(v.name) + '</td>';
          html += '<td>' + esc(v.email) + '</td>';
          html += '<td><button class="vol-remove-btn btn-danger" data-vol-id="' + esc(v.id) + '" style="padding:0.25rem 0.75rem;font-size:0.8rem;">Remove</button></td>';
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
    .then(function(r) {
      if (!r.ok) throw new Error('Failed');
      loadVolunteers(eventId);
    })
    .catch(function() { alert('Failed to remove volunteer. Please try again.'); });
  }

  function esc(str) {
    if (!str) return '';
    var d = document.createElement('span');
    d.textContent = str;
    return d.innerHTML;
  }
})();
