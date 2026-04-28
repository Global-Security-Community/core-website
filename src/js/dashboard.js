(function() {
  var currentSection = 'events';
  var currentEventId = '';
  var currentChapterSlug = '';
  var eventsLoadedPromise = null;

  // Quill rich text editor configuration
  var quillToolbar = [
    ['bold', 'italic', 'underline'],
    [{ 'list': 'ordered' }, { 'list': 'bullet' }],
    [{ 'align': [] }],
    ['link'],
    ['clean']
  ];
  var createQuill = null;
  var editQuill = null;
  try {
    createQuill = new Quill('#ev-description-editor', {
      theme: 'snow',
      modules: { toolbar: quillToolbar },
      placeholder: 'Describe the event...'
    });
    editQuill = new Quill('#edit-description-editor', {
      theme: 'snow',
      modules: { toolbar: quillToolbar },
      placeholder: 'Event description...'
    });
  } catch (e) {
    console.error('Quill init failed:', e);
  }

  function showSection(s) {
    currentSection = s;
    history.replaceState(null, '', '#' + s);
    ['events','create','detail','edit-event','chapter'].forEach(function(id) {
      document.getElementById('section-' + id).style.display = id === s ? 'block' : 'none';
    });
  }

  // Restore section from URL hash
  var validSections = ['events','create','detail','edit-event','chapter'];
  var initialHash = location.hash.replace('#', '');
  if (validSections.indexOf(initialHash) !== -1) {
    showSection(initialHash);
  }

  window.addEventListener('popstate', function() {
    var section = location.hash.replace('#', '') || 'events';
    if (validSections.indexOf(section) !== -1) {
      showSection(section);
    }
  });

  // Wire up navigation buttons
  document.getElementById('btn-events').addEventListener('click', function() { showSection('events'); });
  document.getElementById('btn-create').addEventListener('click', function() {
    showSection('create');
    if (currentChapterSlug) {
      document.getElementById('ev-chapter').value = currentChapterSlug;
    }
  });
  document.getElementById('btn-chapter').addEventListener('click', function() { showSection('chapter'); loadChapterEdit(); });
  document.getElementById('btn-back-events').addEventListener('click', function() { showSection('events'); });

  // Check auth — assign to eventsLoadedPromise so loadChapterEdit() can wait for it
  eventsLoadedPromise = fetch('/.auth/me')
    .then(function(r) { return r.json(); })
    .then(function(d) {
      if (d.clientPrincipal) {
        document.getElementById('dash-user').textContent = 'Welcome, ' + (d.clientPrincipal.userDetails || 'Admin');
        return loadEvents();
      }
    })
    .catch(function() {
      document.getElementById('dash-user').textContent = 'Error loading user info.';
    });

  function loadEvents() {
    return GSC.fetch('/api/eventAttendance?action=list')
      .then(function(r) {
        if (!r.ok) {
          throw new Error(r.status === 401 ? 'Not authenticated — please log in again.' :
            r.status === 403 ? 'You do not have permission to view events.' :
            'Failed to load events (status ' + r.status + ').');
        }
        return r.json();
      })
      .then(function(data) {
        var el = document.getElementById('events-list');
        if (data.chapterCity) {
          document.getElementById('dash-title').textContent = data.chapterCity + ' Chapter Management';
          // Derive chapter slug from city
          currentChapterSlug = data.chapterCity.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').trim();
          // Auto-fill chapter slug in create form
          var chapterInput = document.getElementById('ev-chapter');
          if (chapterInput && !chapterInput.value) {
            chapterInput.value = currentChapterSlug;
          }
        }
        if (!data.events || data.events.length === 0) {
          el.innerHTML = '<p>No events yet. Create your first event!</p>';
          return;
        }
        var html = '<div class="cards">';
        data.events.forEach(function(ev) {
          html += '<div class="card event-card" data-event-id="' + GSC.esc(ev.id) + '" data-chapter-slug="' + GSC.esc(ev.chapterSlug) + '" data-event-title="' + GSC.esc(ev.title) + '" data-sessionize-id="' + GSC.esc(ev.sessionizeApiId || '') + '">';
          html += '<h3>' + GSC.esc(ev.title) + '</h3>';
          html += '<p><span class="icon" aria-hidden="true">' + GSCIcons.calendar + '</span> ' + GSC.esc(ev.date) + ' &nbsp; <span class="icon" aria-hidden="true">' + GSCIcons.mapPin + '</span> ' + GSC.esc(ev.location) + '</p>';
          html += '<p><span class="icon" aria-hidden="true">' + GSCIcons.ticket + '</span> ' + ev.registrationCount + (ev.registrationCap > 0 ? ' / ' + ev.registrationCap : '') + ' registered</p>';
          html += '<span class="status-badge status-badge--' + GSC.esc(ev.status || 'default') + '">' + GSC.esc(ev.status) + '</span>';
          html += '</div>';
        });
        html += '</div>';
        el.innerHTML = html;

        // Attach click handlers to event cards
        el.querySelectorAll('.event-card').forEach(function(card) {
          card.addEventListener('click', function() {
            viewEvent(card.dataset.eventId, card.dataset.chapterSlug, card.dataset.eventTitle, card.dataset.sessionizeId);
          });
        });
      })
      .catch(function(err) {
        document.getElementById('events-list').innerHTML = '<p>' + GSC.esc(err.message || 'Failed to load events.') + '</p>';
      });
  }

  function viewEvent(eventId, chapterSlug, eventTitle, sessionizeApiId) {
    currentEventId = eventId;
    currentChapterSlug = chapterSlug;
    showSection('detail');
    document.getElementById('detail-title').textContent = eventTitle || 'Loading...';
    document.getElementById('detail-subtitle').textContent = '';
    document.getElementById('detail-attendees').innerHTML = '<p>Loading...</p>';

    GSC.fetch('/api/eventAttendance?eventId=' + encodeURIComponent(eventId))
      .then(function(r) { return r.json(); })
      .then(function(data) {
        // Event code with copy
        var subtitleEl = document.getElementById('detail-subtitle');
        subtitleEl.innerHTML = 'Event Code: <code class="dash-code" title="Click to copy">' + GSC.esc(data.eventId) + '</code>';
        subtitleEl.querySelector('code').addEventListener('click', function() {
          navigator.clipboard.writeText(data.eventId).then(function() {
            var el = document.getElementById('detail-subtitle').querySelector('code');
            var orig = el.textContent;
            el.textContent = 'Copied!';
            setTimeout(function() { el.textContent = orig; }, 1500);
          });
        });

        // 4-column grid: 2 stat cards + 2 action groups
        var evtStatus = data.eventStatus || 'published';
        var isDraft = evtStatus === 'draft';
        var isPublished = evtStatus === 'published';
        var isClosed = evtStatus === 'closed';
        var isCompleted = evtStatus === 'completed';
        var needsPublish = isDraft || isCompleted || isClosed;
        document.getElementById('detail-panel').innerHTML =
          '<div class="card stat-card"><p class="stat-number">' + data.total + '</p><p class="stat-label">Registered</p></div>' +
          '<div class="card stat-card"><p class="stat-number">' + data.checkedIn + '</p><p class="stat-label">Checked In</p></div>' +
          '<div class="action-card card">' +
            (needsPublish ? '<button id="btn-publish" class="btn-success btn-full">' + (isDraft ? 'Publish Event' : 'Re-publish Event') + '</button>' : '') +
            '<button id="btn-export" class="btn-full">Export CSV</button>' +
            '<a href="/scanner/?event=' + encodeURIComponent(eventId) + '" class="btn-link btn-full">Open Scanner</a>' +
          '</div>' +
          (isPublished ? '<div class="action-card card">' +
            '<button id="btn-close-reg" class="btn-warning btn-full">Close Registration</button>' +
            '<button id="btn-complete" class="btn-danger btn-full">Mark Complete</button>' +
          '</div>' : '') +
          (isClosed ? '<div class="action-card card">' +
            '<button id="btn-complete" class="btn-danger btn-full">Mark Complete</button>' +
          '</div>' : '');

        var actionsEl = document.getElementById('detail-actions');
        actionsEl.innerHTML = '';

        document.getElementById('btn-export').addEventListener('click', function() { exportCSV(eventId); });
        if (isPublished) {
          document.getElementById('btn-close-reg').addEventListener('click', function() { closeReg(eventId, chapterSlug); });
        }
        if (isPublished || isClosed) {
          document.getElementById('btn-complete').addEventListener('click', function() { completeEvent(eventId, chapterSlug); });
        }
        if (needsPublish) {
          document.getElementById('btn-publish').addEventListener('click', function() { publishEvent(eventId, chapterSlug); });
        }

        // Sessionize refresh button
        var existingRefreshCard = document.getElementById('card-sessionize-speakers');
        if (existingRefreshCard) existingRefreshCard.remove();
        if (sessionizeApiId) {
          var actionsEl = document.getElementById('detail-actions');
          var refreshCard = document.createElement('div');
          refreshCard.id = 'card-sessionize-speakers';
          refreshCard.className = 'card';
          refreshCard.style.cssText = 'margin-top:1rem;padding:1rem;';
          refreshCard.innerHTML =
            '<h4 class="dash-card-title"><span class="icon" aria-hidden="true">' + GSCIcons.mic + '</span> Sessionize Speakers</h4>' +
            '<p id="sessionize-status" class="dash-card-desc">Click refresh to cache speaker data from Sessionize.</p>' +
            '<button id="btn-refresh-speakers" class="btn-full">Refresh Speakers</button>' +
            '<div id="sessionize-speakers-list" class="dash-speakers-list"></div>';
          actionsEl.parentNode.insertBefore(refreshCard, actionsEl.nextSibling);

          document.getElementById('btn-refresh-speakers').addEventListener('click', function() {
            var btn = this;
            btn.disabled = true;
            btn.textContent = 'Refreshing...';
            document.getElementById('sessionize-status').textContent = 'Fetching from Sessionize...';
            GSC.fetch('/api/refreshSessionize', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ eventId: eventId, chapterSlug: chapterSlug, sessionizeApiId: sessionizeApiId })
            })
              .then(function(r) { return r.json(); })
              .then(function(result) {
                btn.disabled = false;
                btn.textContent = 'Refresh Speakers';
                if (result.success) {
                  var ts = result.lastRefreshed ? new Date(result.lastRefreshed).toLocaleString() : 'just now';
                  document.getElementById('sessionize-status').innerHTML =
                    '<span class="icon" aria-hidden="true">' + GSCIcons.checkCircle + '</span> Cached <strong>' + result.speakers + '</strong> speakers, <strong>' + result.agenda + '</strong> agenda items. Last refreshed: ' + GSC.esc(ts);
                  if (result.speakerNames && result.speakerNames.length > 0) {
                    var listHtml = '<p class="dash-speakers-label">Speakers:</p>';
                    listHtml += '<div class="dash-tag-list">';
                    result.speakerNames.forEach(function(name) {
                      listHtml += '<span class="speaker-tag">' + GSC.esc(name) + '</span>';
                    });
                    listHtml += '</div>';
                    document.getElementById('sessionize-speakers-list').innerHTML = listHtml;
                  }
                } else {
                  document.getElementById('sessionize-status').innerHTML = '<span class="icon" aria-hidden="true">' + GSCIcons.alertTriangle + '</span> ' + GSC.esc(result.message || result.error || 'Failed to refresh');
                }
              })
              .catch(function() {
                btn.disabled = false;
                btn.textContent = 'Refresh Speakers';
                document.getElementById('sessionize-status').innerHTML = '<span class="icon" aria-hidden="true">' + GSCIcons.xCircle + '</span> Failed to refresh. Please try again.';
              });
          });
        }

        // Regenerate image button — disabled until image generation workflow is finalised
        var existingRegenCard = document.getElementById('card-event-badge');
        if (existingRegenCard) existingRegenCard.remove();
        var regenCard = document.createElement('div');
        regenCard.id = 'card-event-badge';
        regenCard.className = 'card';
        regenCard.style.cssText = 'margin-top:1rem;padding:1rem;';
        regenCard.innerHTML =
          '<h4 class="dash-card-title"><span class="icon" aria-hidden="true">' + GSCIcons.image + '</span> Event Badge Image</h4>' +
          '<p class="dash-card-info">Image generation is temporarily disabled while we improve the workflow.</p>';
        var actionsParent2 = document.getElementById('detail-actions').parentNode;
        actionsParent2.insertBefore(regenCard, document.getElementById('detail-attendees'));

        // Community Partners management section
        var existingPartnerSection = document.getElementById('card-community-partners');
        if (existingPartnerSection) existingPartnerSection.remove();
        var partnerSection = document.createElement('div');
        partnerSection.id = 'card-community-partners';
        partnerSection.className = 'card';
        partnerSection.style.cssText = 'margin-top:1rem;padding:1rem;';
        partnerSection.innerHTML =
          '<h4 class="dash-section-title"><span class="icon" aria-hidden="true">' + GSCIcons.handshake + '</span> Community Partners</h4>' +
          '<div id="partner-list" class="dash-partner-list"></div>' +
          '<details><summary class="dash-summary">Add Partner</summary>' +
          '<div class="dash-form-content">' +
            '<input type="text" id="cp-name" placeholder="Partner name" maxlength="100" class="dash-input">' +
            '<input type="text" id="cp-tier" placeholder="Tier (e.g. Gold, Community)" maxlength="50" class="dash-input">' +
            '<input type="url" id="cp-website" placeholder="Website URL (optional)" maxlength="300" class="dash-input">' +
            '<label class="help-text-block">Logo (PNG/JPG, recommended 400×200px — auto-resized):</label>' +
            '<input type="file" id="cp-logo" accept="image/png,image/jpeg,image/svg+xml" class="dash-field">' +
            '<div id="cp-preview" class="dash-field"></div>' +
            '<button id="cp-add-btn" class="btn-full">Add Community Partner</button>' +
            '<p id="cp-msg" class="dash-form-msg"></p>' +
          '</div></details>';
        var actionsParent = document.getElementById('detail-actions').parentNode;
        actionsParent.insertBefore(partnerSection, document.getElementById('detail-attendees'));

        // Load existing partners
        loadEventPartners(eventId);

        // Load activity log
        loadAuditLog(eventId);

        // Logo preview with auto-resize
        document.getElementById('cp-logo').addEventListener('change', function(e) {
          var file = e.target.files[0];
          if (!file) return;
          var preview = document.getElementById('cp-preview');
          if (file.type === 'image/svg+xml') {
            var reader = new FileReader();
            reader.onload = function(ev) {
              preview.innerHTML = '<img src="' + ev.target.result + '" class="partner-preview-img">';
            };
            reader.readAsDataURL(file);
            return;
          }
          var img = new Image();
          img.onload = function() {
            var maxW = 400;
            var w = img.width, h = img.height;
            if (w > maxW) { h = Math.round(h * maxW / w); w = maxW; }
            var canvas = document.createElement('canvas');
            canvas.width = w; canvas.height = h;
            canvas.getContext('2d').drawImage(img, 0, 0, w, h);
            var resized = canvas.toDataURL(file.type, 0.85);
            preview.innerHTML = '<img src="' + resized + '" class="partner-preview-img">' +
              '<p class="partner-resize-info">Resized to ' + w + '×' + h + 'px</p>';
            preview.dataset.logoData = resized;
          };
          img.src = URL.createObjectURL(file);
        });

        // Add partner button
        document.getElementById('cp-add-btn').addEventListener('click', function() {
          var name = document.getElementById('cp-name').value.trim();
          var tier = document.getElementById('cp-tier').value.trim();
          var website = document.getElementById('cp-website').value.trim();
          var msg = document.getElementById('cp-msg');
          var preview = document.getElementById('cp-preview');
          var fileInput = document.getElementById('cp-logo');
          var btn = this;

          if (!name) { msg.textContent = 'Please enter a partner name.'; msg.style.display = 'block'; msg.style.color = '#721c24'; return; }

          var logoData = preview.dataset.logoData || '';
          var file = fileInput.files[0];

          function sendPartner(base64, contentType) {
            var raw = base64.replace(/^data:[^;]+;base64,/, '');
            btn.disabled = true; btn.textContent = 'Adding...';
            GSC.fetch('/api/communityPartner', {
              method: 'POST', headers: {'Content-Type':'application/json'},
              body: JSON.stringify({ eventId: eventId, name: name, tier: tier, logoBase64: raw, logoContentType: contentType, website: website })
            }).then(function(r) { return r.json(); }).then(function(d) {
              btn.disabled = false; btn.textContent = 'Add Community Partner';
              if (d.success) {
                msg.innerHTML = '<span class="icon" aria-hidden="true">' + GSCIcons.checkCircle + '</span> ' + GSC.esc(name) + ' added!'; msg.style.color = '#155724'; msg.style.display = 'block';
                document.getElementById('cp-name').value = '';
                document.getElementById('cp-tier').value = '';
                document.getElementById('cp-website').value = '';
                fileInput.value = ''; preview.innerHTML = ''; delete preview.dataset.logoData;
                loadEventPartners(eventId);
              } else {
                msg.innerHTML = '<span class="icon" aria-hidden="true">' + GSCIcons.xCircle + '</span> ' + GSC.esc(d.error || 'Failed'); msg.style.color = '#721c24'; msg.style.display = 'block';
              }
            }).catch(function() {
              btn.disabled = false; btn.textContent = 'Add Community Partner';
              msg.innerHTML = '<span class="icon" aria-hidden="true">' + GSCIcons.xCircle + '</span> Network error'; msg.style.color = '#721c24'; msg.style.display = 'block';
            });
          }

          if (logoData) {
            sendPartner(logoData, file && file.type === 'image/svg+xml' ? 'image/svg+xml' : 'image/png');
          } else if (file && file.type === 'image/svg+xml') {
            var reader = new FileReader();
            reader.onload = function(ev) { sendPartner(ev.target.result, 'image/svg+xml'); };
            reader.readAsDataURL(file);
          } else {
            msg.textContent = 'Please select a logo image.'; msg.style.display = 'block'; msg.style.color = '#721c24';
          }
        });

        // Load attendees with role support
        var adminRegBtn = document.getElementById('admin-reg-btn');
        adminRegBtn.addEventListener('click', function() { adminRegister(eventId); });

        if (!data.attendees || data.attendees.length === 0) {
          document.getElementById('detail-attendees').innerHTML = '<p>No registrations yet.</p>';
          return;
        }
        var html = '<table><thead><tr><th class="th-checkbox"><input type="checkbox" id="select-all"></th><th>Name</th><th>Email</th><th>Role</th><th>Ticket</th><th>Checked In</th></tr></thead><tbody>';
        data.attendees.forEach(function(a) {
          var role = a.role || 'attendee';
          var volIcon = a.volunteerInterest ? ' <span title="Volunteer interest" class="vol-interest-icon"><span class="icon" aria-hidden="true">' + GSCIcons.handRaised + '</span></span>' : '';
          html += '<tr>';
          html += '<td><input type="checkbox" class="attendee-check" data-reg-id="' + GSC.esc(a.id) + '"></td>';
          html += '<td>' + GSC.esc(a.name) + volIcon + '</td>';
          html += '<td>' + GSC.esc(a.email) + '</td>';
          html += '<td><span class="role-badge role-badge--' + GSC.esc(role) + '">' + GSC.esc(role) + '</span></td>';
          html += '<td class="td-mono">' + GSC.esc(a.ticketCode) + '</td>';
          html += '<td>' + (a.checkedIn ? '<span class="icon" aria-hidden="true">' + GSCIcons.checkCircle + '</span> ' + GSC.esc(a.checkedInAt) : '—') + '</td>';
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
        // Resend email button
        document.getElementById('resend-email-btn').addEventListener('click', function() { resendTicketEmails(eventId, eventTitle); });
      })
      .catch(function() {
        document.getElementById('detail-title').textContent = 'Error loading event details';
        document.getElementById('detail-attendees').innerHTML = '<p>Failed to load. Please try again.</p>';
      });
  }

  function exportCSV(eventId) {
    window.open('/api/eventAttendance?eventId=' + encodeURIComponent(eventId) + '&format=csv', '_blank');
  };

  function loadEventPartners(eventId) {
    var listEl = document.getElementById('partner-list');
    if (!listEl) return;
    GSC.fetch('/api/getCommunityPartners?eventId=' + encodeURIComponent(eventId))
      .then(function(r) { return r.ok ? r.json() : { partners: {} }; })
      .then(function(data) {
        var tiers = data.partners || {};
        var allPartners = [];
        Object.keys(tiers).forEach(function(t) {
          tiers[t].forEach(function(p) { p.tierName = t; allPartners.push(p); });
        });
        if (allPartners.length === 0) {
          listEl.innerHTML = '<p class="dash-no-partners">No community partners yet.</p>';
          return;
        }
        var html = '<div class="partner-chip-list">';
        allPartners.forEach(function(p) {
          html += '<div class="partner-chip">';
          if (p.logoDataUrl) html += '<img src="' + p.logoDataUrl + '" class="partner-chip-logo">';
          html += '<span class="partner-chip-name">' + GSC.esc(p.name) + '</span>';
          if (p.tierName) html += '<span class="partner-chip-tier">(' + GSC.esc(p.tierName) + ')</span>';
          html += '<button class="cp-delete btn-icon-delete" data-id="' + GSC.esc(p.id) + '" title="Remove"><span class="icon" aria-hidden="true">' + GSCIcons.x + '</span></button>';
          html += '</div>';
        });
        html += '</div>';
        listEl.innerHTML = html;
        listEl.querySelectorAll('.cp-delete').forEach(function(btn) {
          btn.addEventListener('click', function() {
            if (!confirm('Remove this community partner?')) return;
            GSC.fetch('/api/communityPartner', {
              method: 'POST', headers: {'Content-Type':'application/json'},
              body: JSON.stringify({ eventId: eventId, partnerId: btn.dataset.id, action: 'delete' })
            }).then(function() { loadEventPartners(eventId); });
          });
        });
      })
      .catch(function() {});
  }

  function publishEvent(eventId, chapterSlug) {
    if (!confirm('Publish this event? It will become visible to the public.')) return;
    GSC.fetch('/api/eventAttendance', {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ eventId: eventId, chapterSlug: chapterSlug, status: 'published' })
    })
    .then(function(r) {
      if (!r.ok) throw new Error('Failed');
      alert('Event published!'); loadEvents();
    })
    .catch(function() { alert('Failed to publish event. Please try again.'); });
  }

  function closeReg(eventId, chapterSlug) {
    if (!confirm('Close registration for this event?')) return;
    GSC.fetch('/api/eventAttendance', {
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
    GSC.fetch('/api/eventAttendance', {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ eventId: eventId, chapterSlug: chapterSlug, status: 'completed' })
    }).then(function() {
      return GSC.fetch('/api/issueBadges', {
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
    var btn = this;
    var msg = document.getElementById('create-message');

    var title = document.getElementById('ev-title').value.trim();
    var date = document.getElementById('ev-date').value;
    var description = createQuill ? createQuill.getText().trim() : '';
    var descriptionHtml = createQuill ? createQuill.root.innerHTML : '';
    var address1 = document.getElementById('ev-address1').value.trim();
    var chapterSlug = document.getElementById('ev-chapter').value.trim();

    function showErr(text) {
      msg.style.display = 'block';
      msg.style.backgroundColor = '#f8d7da'; msg.style.color = '#721c24';
      msg.textContent = text;
    }

    if (!title || !date || !description || !chapterSlug) {
      showErr('Please fill in title, date, description, and chapter slug.');
      return;
    }
    if (!address1) {
      showErr('Please enter an address for the event.');
      return;
    }
    if (title.length > 200) { showErr('Title must be 200 characters or less.'); return; }
    if (description.length > 5000) { showErr('Description must be 5000 characters or less.'); return; }

    createSubmitting = true;
    btn.disabled = true;
    btn.textContent = 'Creating...';
    msg.style.display = 'none';

    var payload = {
      title: title,
      date: date,
      locationBuilding: document.getElementById('ev-building').value,
      locationAddress1: address1,
      locationAddress2: document.getElementById('ev-address2').value,
      locationCity: document.getElementById('ev-city').value,
      locationState: document.getElementById('ev-state').value,
      description: descriptionHtml,
      sessionizeApiId: document.getElementById('ev-sessionize').value,
      registrationCap: document.getElementById('ev-cap').value,
      chapterSlug: chapterSlug
    };

    GSC.fetch('/api/createEvent', {
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
    if (state === 'done') icon.innerHTML = '<span class="icon" aria-hidden="true">' + GSCIcons.checkCircle + '</span>';
    else if (state === 'active') icon.innerHTML = '<span class="icon" aria-hidden="true">' + GSCIcons.refreshCw + '</span>';
    else if (state === 'error') icon.innerHTML = '<span class="icon" aria-hidden="true">' + GSCIcons.xCircle + '</span>';
    else icon.innerHTML = '<span class="icon" aria-hidden="true">' + GSCIcons.hourglass + '</span>';
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
            link.classList.remove('is-hidden');
            document.getElementById('create-another-btn').classList.remove('is-hidden');
            // Publish the event now that its page is live
            if (event.id && event.chapterSlug) {
              fetch('/api/eventAttendance', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ eventId: event.id, chapterSlug: event.chapterSlug, status: 'published' })
              }).then(function(r) {
                loadEvents();
                if (!r.ok) {
                  document.querySelector('.pipeline-note').textContent = 'Event page is live! Note: status update encountered an error — the event may still appear as draft in the dashboard until you refresh.';
                }
              }).catch(function() {
                document.querySelector('.pipeline-note').textContent = 'Event page is live! Note: status update failed — the event may still appear as draft in the dashboard until you refresh.';
              });
            }
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
    ['ev-title','ev-date','ev-building','ev-address1','ev-address2','ev-city','ev-state','ev-sessionize','ev-chapter'].forEach(function(id) {
      document.getElementById(id).value = '';
    });
    if (createQuill) createQuill.setText('');
    document.getElementById('ev-cap').value = '0';
    // Reset pipeline steps
    ['step-stored','step-page','step-live'].forEach(function(id) { setStepState(id, 'pending'); });
    document.getElementById('create-progress-link').classList.add('is-hidden');
    document.getElementById('create-another-btn').classList.add('is-hidden');
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
    GSC.fetch('/api/updateRegistrationRole', {
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

  function resendTicketEmails(eventId, eventTitle) {
    var selected = document.querySelectorAll('.attendee-check:checked');
    var ids = [];
    selected.forEach(function(cb) { ids.push(cb.dataset.regId); });
    if (ids.length === 0) return;
    if (!confirm('Resend ticket confirmation email to ' + ids.length + ' attendee(s)?')) return;

    var btn = document.getElementById('resend-email-btn');
    btn.disabled = true;
    btn.textContent = 'Sending...';

    GSC.fetch('/api/resendTicketEmail', {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ eventId: eventId, registrationIds: ids })
    })
    .then(function(r) { return r.json(); })
    .then(function(d) {
      if (d.success) {
        var msg = d.sent + ' email(s) sent.';
        if (d.failed > 0) {
          msg += ' ' + d.failed + ' failed.';
          if (d.errors && d.errors.length > 0) {
            msg += '\n\nErrors:\n' + d.errors.map(function(e) { return (e.email || e.id) + ': ' + e.error; }).join('\n');
          }
        }
        alert(msg);
      } else {
        alert(d.error || 'Failed to resend emails.');
      }
    })
    .catch(function() { alert('Network error.'); })
    .finally(function() { btn.disabled = false; btn.textContent = 'Resend Email'; });
  }

  function loadAuditLog(eventId) {
    var el = document.getElementById('audit-log');
    if (!el) return;
    el.innerHTML = '<p class="text-muted">Loading activity log...</p>';
    GSC.fetch('/api/getAuditLog?eventId=' + encodeURIComponent(eventId))
      .then(function(r) { return r.ok ? r.json() : { entries: [] }; })
      .then(function(data) {
        var entries = data.entries || [];
        if (entries.length === 0) {
          el.innerHTML = '<p class="text-muted">No activity recorded yet.</p>';
          return;
        }
        var html = '<div class="audit-entries">';
        entries.forEach(function(e) {
          var ts = new Date(e.timestamp).toLocaleString();
          var label = formatAuditAction(e.action);
          var detail = '';
          if (e.details) {
            try {
              var d = typeof e.details === 'string' ? JSON.parse(e.details) : e.details;
              detail = formatAuditDetails(e.action, d);
            } catch(err) { /* ignore */ }
          }
          html += '<div class="audit-entry">' +
            '<span class="audit-time">' + GSC.esc(ts) + '</span>' +
            '<span class="audit-action">' + GSC.esc(label) + '</span>' +
            '<span class="audit-admin">' + GSC.esc(e.adminEmail || 'system') + '</span>' +
            (detail ? '<span class="audit-detail">' + detail + '</span>' : '') +
          '</div>';
        });
        html += '</div>';
        el.innerHTML = html;
      })
      .catch(function() {
        el.innerHTML = '<p class="text-muted">Failed to load activity log.</p>';
      });
  }

  function formatAuditAction(action) {
    var labels = {
      'event_created': 'Created event',
      'event_updated': 'Updated event',
      'event_deleted': 'Deleted event',
      'status_changed': 'Changed status',
      'registration_admin_created': 'Admin registered attendee',
      'registration_role_updated': 'Updated roles',
      'attendee_checked_in': 'Checked in attendee',
      'partner_added': 'Added partner',
      'partner_updated': 'Updated partner',
      'partner_deleted': 'Removed partner',
      'email_resent': 'Resent emails',
      'badges_issued': 'Issued badges'
    };
    return labels[action] || action.replace(/_/g, ' ');
  }

  function formatAuditDetails(action, d) {
    if (action === 'status_changed') return GSC.esc(d.from || '?') + ' → ' + GSC.esc(d.to || '?');
    if (action === 'registration_admin_created') return GSC.esc(d.email || '') + ' as ' + GSC.esc(d.role || 'attendee');
    if (action === 'registration_role_updated') return GSC.esc((d.count || 0) + '') + ' attendee(s) → ' + GSC.esc(d.role || '');
    if (action === 'attendee_checked_in') return GSC.esc(d.attendee || '');
    if (action === 'email_resent') return GSC.esc((d.sent || 0) + '') + ' sent' + (d.failed ? ', ' + d.failed + ' failed' : '');
    if (action === 'badges_issued') return GSC.esc((d.issued || 0) + '/' + (d.total || 0)) + ' badges';
    if (action === 'event_updated' && d.fields) return 'Fields: ' + GSC.esc(d.fields.join(', '));
    if ((action === 'partner_added' || action === 'partner_updated') && d.name) return GSC.esc(d.name);
    return '';
  }

  function adminRegister(eventId) {
    var nameEl = document.getElementById('admin-reg-name');
    var emailEl = document.getElementById('admin-reg-email');
    var roleEl = document.getElementById('admin-reg-role');
    var name = nameEl.value.trim();
    var email = emailEl.value.trim();
    var role = roleEl.value;
    if (!name || !email) { alert('Please enter name and email.'); return; }
    GSC.fetch('/api/manualRegister', {
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

  // ─── Edit Event ───

  var editEventData = null;

  document.getElementById('btn-edit-event').addEventListener('click', function() {
    if (!currentEventId || !currentChapterSlug) return;
    showSection('edit-event');
    loadEditEvent();
  });

  document.getElementById('btn-back-detail').addEventListener('click', function() {
    showSection('detail');
  });

  function loadEditEvent() {
    var msg = document.getElementById('edit-event-message');
    msg.style.display = 'none';
    document.getElementById('edit-event-form').style.display = 'none';

    GSC.fetch('/api/getEvent?id=' + encodeURIComponent(currentEventId) + '&chapterSlug=' + encodeURIComponent(currentChapterSlug))
      .then(function(r) { return r.json(); })
      .then(function(data) {
        if (data.error) {
          msg.style.display = 'block';
          msg.style.backgroundColor = '#f8d7da'; msg.style.color = '#721c24';
          msg.textContent = data.error;
          return;
        }
        editEventData = data;
        document.getElementById('edit-title').value = data.title || '';
        document.getElementById('edit-slug').value = data.slug || '';
        document.getElementById('edit-date').value = data.date || '';
        document.getElementById('edit-building').value = data.locationBuilding || '';
        document.getElementById('edit-address1').value = data.locationAddress1 || '';
        document.getElementById('edit-address2').value = data.locationAddress2 || '';
        document.getElementById('edit-city').value = data.locationCity || '';
        document.getElementById('edit-state').value = data.locationState || '';
        if (editQuill) editQuill.root.innerHTML = data.description || '';
        document.getElementById('edit-sessionize').value = data.sessionizeApiId || '';
        document.getElementById('edit-cap').value = data.registrationCap || 0;
        document.getElementById('edit-event-form').style.display = 'block';
      })
      .catch(function() {
        msg.style.display = 'block';
        msg.style.backgroundColor = '#f8d7da'; msg.style.color = '#721c24';
        msg.textContent = 'Failed to load event data.';
      });
  }

  document.getElementById('edit-save-btn').addEventListener('click', function() {
    var btn = this;
    var msg = document.getElementById('edit-event-message');

    var title = document.getElementById('edit-title').value.trim();
    var slug = document.getElementById('edit-slug').value.trim();
    var date = document.getElementById('edit-date').value;
    var description = editQuill ? editQuill.getText().trim() : '';
    var descriptionHtml = editQuill ? editQuill.root.innerHTML : '';
    var address1 = document.getElementById('edit-address1').value.trim();

    function showErr(text) {
      GSC.showMessage(msg, 'error', text);
      msg.style.display = 'block';
    }

    if (!title || !date || !description) { showErr('Title, date, and description are required.'); return; }
    if (!address1) { showErr('Address is required.'); return; }
    if (!slug) { showErr('Slug is required.'); return; }

    btn.disabled = true;
    btn.textContent = 'Saving...';
    msg.style.display = 'none';

    var payload = {
      eventId: currentEventId,
      chapterSlug: currentChapterSlug,
      title: title,
      slug: slug,
      date: date,
      locationBuilding: document.getElementById('edit-building').value,
      locationAddress1: address1,
      locationAddress2: document.getElementById('edit-address2').value,
      locationCity: document.getElementById('edit-city').value,
      locationState: document.getElementById('edit-state').value,
      description: descriptionHtml,
      sessionizeApiId: document.getElementById('edit-sessionize').value,
      registrationCap: document.getElementById('edit-cap').value
    };

    GSC.fetch('/api/updateEvent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
      .then(function(r) { return r.json(); })
      .then(function(data) {
        btn.disabled = false;
        btn.textContent = 'Save Changes';
        if (data.success) {
          GSC.showMessage(msg, 'success', 'Event updated successfully!');
          msg.style.display = 'block';
          loadEvents();
        } else {
          showErr(data.error || 'Failed to update event.');
        }
      })
      .catch(function() {
        btn.disabled = false;
        btn.textContent = 'Save Changes';
        showErr('Network error. Please try again.');
      });
  });

  document.getElementById('edit-delete-btn').addEventListener('click', function() {
    var eventTitle = document.getElementById('edit-title').value.trim() || 'this event';
    if (!confirm('Are you sure you want to permanently delete "' + eventTitle + '"? This cannot be undone.')) {
      return;
    }

    var btn = this;
    var msg = document.getElementById('edit-event-message');
    btn.disabled = true;
    btn.textContent = 'Deleting...';
    msg.style.display = 'none';

    GSC.fetch('/api/deleteEvent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventId: currentEventId, chapterSlug: currentChapterSlug })
    })
      .then(function(r) { return r.json(); })
      .then(function(data) {
        if (data.success) {
          currentEventId = null;
          loadEvents();
          showSection('events');
        } else {
          btn.disabled = false;
          btn.textContent = 'Delete Event';
          GSC.showMessage(msg, 'error', data.error || 'Failed to delete event.');
          msg.style.display = 'block';
        }
      })
      .catch(function() {
        btn.disabled = false;
        btn.textContent = 'Delete Event';
        GSC.showMessage(msg, 'error', 'Network error. Please try again.');
        msg.style.display = 'block';
      });
  });

  // ─── Chapter Edit ───

  var chapterEditLoaded = false;

  function loadChapterEdit() {
    document.getElementById('chapter-edit-form').innerHTML = '<p>Loading chapter data...</p>';
    document.getElementById('chapter-edit-message').style.display = 'none';

    // Wait for events to finish loading — they set currentChapterSlug from the API
    eventsLoadedPromise.then(function() {
      // If we already know the slug, use it; otherwise ask the API to look it up by email
      var url = currentChapterSlug
        ? '/api/getChapter?slug=' + encodeURIComponent(currentChapterSlug)
        : '/api/getChapter?mine=true';

      fetch(url)
        .then(function(r) { return r.json(); })
        .then(function(data) {
          if (data.error) {
            document.getElementById('chapter-edit-form').innerHTML = '<p>' + GSC.esc(data.error) + '</p>';
            return;
          }
          if (data.slug) currentChapterSlug = data.slug;
          renderChapterForm(data.leads || [], data.city, data.country);
          chapterEditLoaded = true;
        })
        .catch(function() {
          document.getElementById('chapter-edit-form').innerHTML = '<p>Failed to load chapter data.</p>';
        });
    }).catch(function() {
      document.getElementById('chapter-edit-form').innerHTML = '<p>Failed to load chapter data.</p>';
    });
  }

  function renderChapterForm(leads, city, country) {
    var maxLeads = 4;
    // Ensure at least 1 lead row
    if (leads.length === 0) leads = [{ name: '', email: '', github: '', linkedin: '', twitter: '', website: '' }];

    var html = '<p class="text-muted">Edit chapter leads and social links for <strong>' + GSC.esc(city) + ', ' + GSC.esc(country) + '</strong>. Up to 4 leads.</p>';
    html += '<div id="leads-container">';

    leads.forEach(function(lead, i) {
      html += buildLeadRow(i, lead);
    });

    html += '</div>';

    if (leads.length < maxLeads) {
      html += '<button id="add-lead-btn" type="button" class="btn-outline mb-1">+ Add Lead</button>';
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
    return '<div class="lead-edit-row card lead-card">' +
      '<h4 class="lead-card-title">Lead ' + (index + 1) + '</h4>' +
      '<div class="form-group form-grid-2col">' +
        '<div><label>Name *</label><input type="text" class="lead-name" value="' + GSC.esc(lead.name) + '" maxlength="100" placeholder="Full name"></div>' +
        '<div><label>Email *</label><input type="email" class="lead-email" value="' + GSC.esc(lead.email) + '" maxlength="200" placeholder="Email address"></div>' +
      '</div>' +
      '<div class="form-group form-grid-2col">' +
        '<div><label>GitHub</label><input type="url" class="lead-github" value="' + GSC.esc(lead.github) + '" maxlength="200" placeholder="https://github.com/..."></div>' +
        '<div><label>LinkedIn</label><input type="url" class="lead-linkedin" value="' + GSC.esc(lead.linkedin) + '" maxlength="200" placeholder="https://linkedin.com/in/..."></div>' +
      '</div>' +
      '<div class="form-group form-grid-2col">' +
        '<div><label>X / Twitter</label><input type="url" class="lead-twitter" value="' + GSC.esc(lead.twitter) + '" maxlength="200" placeholder="https://x.com/..."></div>' +
        '<div><label>Website</label><input type="url" class="lead-website" value="' + GSC.esc(lead.website) + '" maxlength="200" placeholder="https://..."></div>' +
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

    GSC.fetch('/api/updateChapter', {
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
