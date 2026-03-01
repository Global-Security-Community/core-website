(function() {
  var currentSection = 'events';
  var currentEventId = '';
  var currentChapterSlug = '';

  function showSection(s) {
    currentSection = s;
    ['events','create','detail','chapter'].forEach(function(id) {
      document.getElementById('section-' + id).style.display = id === s ? 'block' : 'none';
    });
  }

  // Wire up navigation buttons
  document.getElementById('btn-events').addEventListener('click', function() { showSection('events'); });
  document.getElementById('btn-create').addEventListener('click', function() { showSection('create'); });
  document.getElementById('btn-chapter').addEventListener('click', function() { showSection('chapter'); loadChapterEdit(); });
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
          // Derive chapter slug from city
          currentChapterSlug = data.chapterCity.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').trim();
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
            '<button id="btn-complete" class="btn-danger" style="width:100%">Mark Complete</button>' +
          '</div>';

        var actionsEl = document.getElementById('detail-actions');
        actionsEl.innerHTML = '';

        document.getElementById('btn-export').addEventListener('click', function() { exportCSV(eventId); });
        document.getElementById('btn-close-reg').addEventListener('click', function() { closeReg(eventId, chapterSlug); });
        document.getElementById('btn-complete').addEventListener('click', function() { completeEvent(eventId, chapterSlug); });

        // Load attendees with role support
        var adminRegBtn = document.getElementById('admin-reg-btn');
        adminRegBtn.addEventListener('click', function() { adminRegister(eventId); });

        if (!data.attendees || data.attendees.length === 0) {
          document.getElementById('detail-attendees').innerHTML = '<p>No registrations yet.</p>';
          return;
        }
        var html = '<table><thead><tr><th style="width:30px;"><input type="checkbox" id="select-all"></th><th>Name</th><th>Email</th><th>Role</th><th>Ticket</th><th>Checked In</th></tr></thead><tbody>';
        data.attendees.forEach(function(a) {
          var role = a.role || 'attendee';
          var volIcon = a.volunteerInterest ? ' <span title="Volunteer interest" class="vol-interest-icon">🙋</span>' : '';
          html += '<tr>';
          html += '<td><input type="checkbox" class="attendee-check" data-reg-id="' + esc(a.id) + '"></td>';
          html += '<td>' + esc(a.name) + volIcon + '</td>';
          html += '<td>' + esc(a.email) + '</td>';
          html += '<td><span class="role-badge role-badge--' + esc(role) + '">' + esc(role) + '</span></td>';
          html += '<td style="font-family:monospace;">' + esc(a.ticketCode) + '</td>';
          html += '<td>' + (a.checkedIn ? '✅ ' + esc(a.checkedInAt) : '—') + '</td>';
          html += '</tr>';
        });
        html += '</tbody></table>';
        document.getElementById('detail-attendees').innerHTML = html;

        // Select all checkbox
        document.getElementById('select-all').addEventListener('change', function() {
          var checked = this.checked;
          document.querySelectorAll('.attendee-check').forEach(function(cb) { cb.checked = checked; });
          updateRoleActionBar();
        });
        document.querySelectorAll('.attendee-check').forEach(function(cb) {
          cb.addEventListener('change', updateRoleActionBar);
        });

        // Role apply button
        document.getElementById('role-apply-btn').addEventListener('click', function() { applyRoleChange(eventId, eventTitle); });
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
    if (!confirm('Are you sure you want to mark this event as complete?\n\nBadges will be automatically issued to all checked-in attendees.')) return;
    fetch('/api/eventAttendance', {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ eventId: eventId, chapterSlug: chapterSlug, status: 'completed' })
    }).then(function() {
      return fetch('/api/issueBadges', {
        method: 'POST', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ eventId: eventId, chapterSlug: chapterSlug })
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

  function updateRoleActionBar() {
    var selected = document.querySelectorAll('.attendee-check:checked');
    var bar = document.getElementById('role-action-bar');
    if (selected.length > 0) {
      bar.style.display = 'flex';
      document.getElementById('role-selected-count').textContent = selected.length + ' selected';
    } else {
      bar.style.display = 'none';
    }
  }

  function applyRoleChange(eventId, eventTitle) {
    var role = document.getElementById('role-select').value;
    if (!role) { alert('Please select a role.'); return; }
    var selected = document.querySelectorAll('.attendee-check:checked');
    var ids = [];
    selected.forEach(function(cb) { ids.push(cb.dataset.regId); });
    if (ids.length === 0) return;
    if (!confirm('Set ' + ids.length + ' attendee(s) to "' + role + '"?')) return;
    fetch('/api/updateRegistrationRole', {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ eventId: eventId, registrationIds: ids, role: role })
    })
    .then(function(r) { return r.json(); })
    .then(function(d) {
      if (d.success) {
        alert(d.updated + ' role(s) updated.');
        viewEvent(eventId, currentChapterSlug, eventTitle);
      } else {
        alert(d.error || 'Failed to update roles.');
      }
    })
    .catch(function() { alert('Network error.'); });
  }

  function adminRegister(eventId) {
    var nameEl = document.getElementById('admin-reg-name');
    var emailEl = document.getElementById('admin-reg-email');
    var roleEl = document.getElementById('admin-reg-role');
    var name = nameEl.value.trim();
    var email = emailEl.value.trim();
    var role = roleEl.value;
    if (!name || !email) { alert('Please enter name and email.'); return; }
    fetch('/api/adminRegister', {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ eventId: eventId, name: name, email: email, role: role })
    })
    .then(function(r) { return r.json(); })
    .then(function(d) {
      if (d.success) {
        nameEl.value = ''; emailEl.value = ''; roleEl.value = 'attendee';
        alert('Registered ' + d.registration.fullName + ' as ' + d.registration.role + '.');
        viewEvent(eventId, currentChapterSlug, document.getElementById('detail-title').textContent);
      } else {
        alert(d.error || 'Failed to register.');
      }
    })
    .catch(function() { alert('Network error.'); });
  }

  function esc(str) {
    if (!str) return '';
    var d = document.createElement('span');
    d.textContent = str;
    return d.innerHTML;
  }

  // ─── Chapter Edit ───

  var chapterEditLoaded = false;

  function loadChapterEdit() {
    if (!currentChapterSlug) {
      document.getElementById('chapter-edit-form').innerHTML = '<p>Could not determine chapter slug. Please go back to events first.</p>';
      return;
    }
    document.getElementById('chapter-edit-form').innerHTML = '<p>Loading chapter data...</p>';
    document.getElementById('chapter-edit-message').style.display = 'none';

    fetch('/api/getChapter?slug=' + encodeURIComponent(currentChapterSlug))
      .then(function(r) { return r.json(); })
      .then(function(data) {
        if (data.error) {
          document.getElementById('chapter-edit-form').innerHTML = '<p>' + esc(data.error) + '</p>';
          return;
        }
        renderChapterForm(data.leads || [], data.city, data.country);
        chapterEditLoaded = true;
      })
      .catch(function() {
        document.getElementById('chapter-edit-form').innerHTML = '<p>Failed to load chapter data.</p>';
      });
  }

  function renderChapterForm(leads, city, country) {
    var maxLeads = 4;
    // Ensure at least 1 lead row
    if (leads.length === 0) leads = [{ name: '', email: '', github: '', linkedin: '', twitter: '', website: '' }];

    var html = '<p class="text-muted">Edit chapter leads and social links for <strong>' + esc(city) + ', ' + esc(country) + '</strong>. Up to 4 leads.</p>';
    html += '<div id="leads-container">';

    leads.forEach(function(lead, i) {
      html += buildLeadRow(i, lead);
    });

    html += '</div>';

    if (leads.length < maxLeads) {
      html += '<button id="add-lead-btn" type="button" class="btn-outline" style="margin-bottom:1rem;">+ Add Lead</button>';
    }

    html += '<button id="save-chapter-btn" type="button">Save Chapter</button>';

    document.getElementById('chapter-edit-form').innerHTML = html;

    // Wire up add lead
    var addBtn = document.getElementById('add-lead-btn');
    if (addBtn) {
      addBtn.addEventListener('click', function() {
        var container = document.getElementById('leads-container');
        var count = container.querySelectorAll('.lead-edit-row').length;
        if (count >= maxLeads) return;
        var div = document.createElement('div');
        div.innerHTML = buildLeadRow(count, { name: '', email: '', github: '', linkedin: '', twitter: '', website: '' });
        container.appendChild(div.firstChild);
        if (count + 1 >= maxLeads) addBtn.style.display = 'none';
      });
    }

    // Wire up save
    document.getElementById('save-chapter-btn').addEventListener('click', saveChapter);
  }

  function buildLeadRow(index, lead) {
    return '<div class="lead-edit-row card" style="padding:1rem;margin-bottom:1rem;">' +
      '<h4 style="margin:0 0 0.75rem 0;">Lead ' + (index + 1) + '</h4>' +
      '<div class="form-group" style="display:grid;grid-template-columns:1fr 1fr;gap:0.75rem;">' +
        '<div><label>Name *</label><input type="text" class="lead-name" value="' + esc(lead.name) + '" maxlength="100" placeholder="Full name"></div>' +
        '<div><label>Email *</label><input type="email" class="lead-email" value="' + esc(lead.email) + '" maxlength="200" placeholder="Email address"></div>' +
      '</div>' +
      '<div class="form-group" style="display:grid;grid-template-columns:1fr 1fr;gap:0.75rem;">' +
        '<div><label>GitHub</label><input type="url" class="lead-github" value="' + esc(lead.github) + '" maxlength="200" placeholder="https://github.com/..."></div>' +
        '<div><label>LinkedIn</label><input type="url" class="lead-linkedin" value="' + esc(lead.linkedin) + '" maxlength="200" placeholder="https://linkedin.com/in/..."></div>' +
      '</div>' +
      '<div class="form-group" style="display:grid;grid-template-columns:1fr 1fr;gap:0.75rem;">' +
        '<div><label>X / Twitter</label><input type="url" class="lead-twitter" value="' + esc(lead.twitter) + '" maxlength="200" placeholder="https://x.com/..."></div>' +
        '<div><label>Website</label><input type="url" class="lead-website" value="' + esc(lead.website) + '" maxlength="200" placeholder="https://..."></div>' +
      '</div>' +
    '</div>';
  }

  function saveChapter() {
    var rows = document.querySelectorAll('.lead-edit-row');
    var leads = [];
    var valid = true;

    rows.forEach(function(row) {
      var name = row.querySelector('.lead-name').value.trim();
      var email = row.querySelector('.lead-email').value.trim();
      if (!name && !email) return; // skip empty rows
      if (!name || !email) {
        valid = false;
        return;
      }
      leads.push({
        name: name,
        email: email,
        github: row.querySelector('.lead-github').value.trim(),
        linkedin: row.querySelector('.lead-linkedin').value.trim(),
        twitter: row.querySelector('.lead-twitter').value.trim(),
        website: row.querySelector('.lead-website').value.trim()
      });
    });

    if (!valid || leads.length === 0) {
      alert('Each lead must have a name and email.');
      return;
    }

    var msg = document.getElementById('chapter-edit-message');
    var btn = document.getElementById('save-chapter-btn');
    btn.disabled = true;
    btn.textContent = 'Saving...';

    fetch('/api/updateChapter', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chapterSlug: currentChapterSlug, leads: leads })
    })
    .then(function(r) { return r.json(); })
    .then(function(d) {
      btn.disabled = false;
      btn.textContent = 'Save Chapter';
      if (d.success) {
        msg.style.display = 'block';
        msg.style.backgroundColor = '#d4edda'; msg.style.color = '#155724';
        msg.textContent = 'Chapter updated.' + (d.pageUpdated ? ' Page will redeploy shortly.' : ' Page could not be updated automatically.');
      } else {
        msg.style.display = 'block';
        msg.style.backgroundColor = '#f8d7da'; msg.style.color = '#721c24';
        msg.textContent = d.error || 'Failed to update chapter.';
      }
    })
    .catch(function() {
      btn.disabled = false;
      btn.textContent = 'Save Chapter';
      msg.style.display = 'block';
      msg.style.backgroundColor = '#f8d7da'; msg.style.color = '#721c24';
      msg.textContent = 'Network error. Please try again.';
    });
  }
})();
