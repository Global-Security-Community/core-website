(function() {
  var currentSection = 'events';
  var currentEventId = '';
  var currentChapterSlug = '';
  var eventsLoadedPromise = null;
  var communityReportEvents = [];
  var currentAttendees = [];
  var currentEventTitle = '';
  var postEventState = null;
  var postEventDefaultTemplates = null;
  var postEventSaveTimer = null;
  var currentPostEventStatus = '';

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
    ['events','create','detail','edit-event','chapter','reports'].forEach(function(id) {
      document.getElementById('section-' + id).style.display = id === s ? 'block' : 'none';
    });
  }

  // Restore section from URL hash
  var validSections = ['events','create','detail','edit-event','chapter','reports'];
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
  document.getElementById('btn-reports').addEventListener('click', function() { showSection('reports'); loadCommunityReports(); });
  document.getElementById('btn-back-reports').addEventListener('click', function() { showSection('events'); });
  document.getElementById('report-download-btn').addEventListener('click', downloadCommunityReport);
  document.getElementById('report-event').addEventListener('change', loadSelectedCommunityReport);

  // Check auth — assign to eventsLoadedPromise so loadChapterEdit() can wait for it
  eventsLoadedPromise = fetch('/.auth/me')
    .then(function(r) { return r.json(); })
    .then(function(d) {
      if (d.clientPrincipal) {
        document.getElementById('dash-user').textContent = 'Welcome, ' + (d.clientPrincipal.userDetails || 'Admin');
        return loadEvents().then(function() {
          return initCommunityReports();
        });
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

  function initCommunityReports() {
    return GSC.fetch('/api/registrationReport?action=events')
      .then(function(r) {
        if (!r.ok) return null;
        return r.json();
      })
      .then(function(data) {
        if (!data) return;
        communityReportEvents = data.events || [];
        document.getElementById('btn-reports').classList.remove('is-hidden');
      })
      .catch(function() {
        document.getElementById('btn-reports').classList.add('is-hidden');
      });
  }

  function loadCommunityReports() {
    var msg = document.getElementById('reports-message');
    msg.style.display = 'none';
    GSC.fetch('/api/registrationReport?action=events')
      .then(function(r) {
        if (!r.ok) {
          throw new Error(r.status === 403 ? 'Only community organisers can access reports.' : 'Failed to load reports.');
        }
        return r.json();
      })
      .then(function(data) {
        communityReportEvents = data.events || [];
        document.getElementById('reports-summary').innerHTML =
          '<div class="card stat-card"><p class="stat-number">' + (data.totalEvents || 0) + '</p><p class="stat-label">Events</p></div>' +
          '<div class="card stat-card"><p class="stat-number">' + (data.totalRegistrations || 0) + '</p><p class="stat-label">Registrations</p></div>';

        var select = document.getElementById('report-event');
        var html = '<option value="">All events</option>';
        communityReportEvents.forEach(function(ev) {
          var label = (ev.date ? ev.date + ' - ' : '') + ev.title + ' (' + ev.registrationCount + ')';
          html += '<option value="' + GSC.esc(ev.id) + '">' + GSC.esc(label) + '</option>';
        });
        select.innerHTML = html;
        loadSelectedCommunityReport();
      })
      .catch(function(err) {
        msg.style.display = 'block';
        msg.style.backgroundColor = '#f8d7da';
        msg.style.color = '#721c24';
        msg.textContent = err.message || 'Failed to load reports.';
      });
  }

  function loadSelectedCommunityReport() {
    var eventId = document.getElementById('report-event').value;
    var visuals = document.getElementById('reports-visuals');
    var url = '/api/registrationReport';
    if (eventId) url += '?eventId=' + encodeURIComponent(eventId);

    visuals.innerHTML = '<p class="text-muted">Loading report data...</p>';
    GSC.fetch(url)
      .then(function(r) {
        if (!r.ok) throw new Error('Failed to load report data.');
        return r.json();
      })
      .then(renderReportVisuals)
      .catch(function(err) {
        visuals.innerHTML = '<p class="text-muted">' + GSC.esc(err.message || 'Failed to load report data.') + '</p>';
      });
  }

  function downloadCommunityReport() {
    var eventId = document.getElementById('report-event').value;
    var url = '/api/registrationReport?format=csv';
    if (eventId) url += '&eventId=' + encodeURIComponent(eventId);
    window.open(url, '_blank');
  }

  function renderReportVisuals(data) {
    var rows = data.rows || [];
    var total = rows.length;
    var checkedIn = rows.filter(function(r) { return r.checkedIn; }).length;
    var volunteers = rows.filter(function(r) { return r.volunteerInterest; }).length;
    var chapters = uniqueCount(rows, 'chapterSlug');
    var html = '';

    if (total === 0) {
      document.getElementById('reports-visuals').innerHTML = '<p class="text-muted">No registrations found for this selection.</p>';
      return;
    }

    html += '<div class="report-kpi-grid">';
    html += reportKpi('Registrations', total);
    html += reportKpi('Checked In', checkedIn + ' (' + percentage(checkedIn, total) + '%)');
    html += reportKpi('Volunteer Interest', volunteers + ' (' + percentage(volunteers, total) + '%)');
    html += reportKpi('Chapters', chapters);
    html += '</div>';

    html += '<div class="report-chart-grid">';
    html += barChart('Registrations by chapter', countBy(rows, 'chapterSlug'), total);
    html += barChart('Companies', countBy(rows, 'company'), total);
    html += barChart('Position titles', countBy(rows, 'jobTitle'), total);
    html += barChart('Employment status', countBy(rows, 'employmentStatus'), total);
    html += barChart('Industry', countBy(rows, 'industry'), total);
    html += barChart('Experience level', countBy(rows, 'experienceLevel'), total);
    html += barChart('Company size', countBy(rows, 'companySize'), total);
    html += barChart('Role', countBy(rows, 'role'), total);
    html += '</div>';

    document.getElementById('reports-visuals').innerHTML = html;
  }

  function reportKpi(label, value) {
    return '<div class="card report-kpi"><p class="stat-number">' + GSC.esc(String(value)) + '</p><p class="stat-label">' + GSC.esc(label) + '</p></div>';
  }

  function countBy(rows, field) {
    var counts = {};
    rows.forEach(function(row) {
      var value = row[field] || 'Not provided';
      counts[value] = (counts[value] || 0) + 1;
    });
    return Object.keys(counts).map(function(label) {
      return { label: label, count: counts[label] };
    }).sort(function(a, b) {
      if (b.count !== a.count) return b.count - a.count;
      return a.label.localeCompare(b.label);
    }).slice(0, 8);
  }

  function barChart(title, items, total) {
    var html = '<div class="card report-chart"><h3>' + GSC.esc(title) + '</h3>';
    if (!items.length) {
      html += '<p class="text-muted">No data.</p></div>';
      return html;
    }
    html += '<div class="report-bars">';
    items.forEach(function(item) {
      var pct = percentage(item.count, total);
      html += '<div class="report-bar-row">';
      html += '<div class="report-bar-label"><span>' + GSC.esc(item.label) + '</span><strong>' + item.count + '</strong></div>';
      html += '<div class="report-bar-track"><div class="report-bar-fill" style="width:' + pct + '%"></div></div>';
      html += '</div>';
    });
    html += '</div></div>';
    return html;
  }

  function percentage(value, total) {
    if (!total) return 0;
    return Math.round((value / total) * 100);
  }

  function uniqueCount(rows, field) {
    var seen = {};
    rows.forEach(function(row) {
      if (row[field]) seen[row[field]] = true;
    });
    return Object.keys(seen).length;
  }

  function viewEvent(eventId, chapterSlug, eventTitle, sessionizeApiId) {
    currentEventId = eventId;
    currentChapterSlug = chapterSlug;
    showSection('detail');
    document.getElementById('detail-title').textContent = eventTitle || 'Loading...';
    document.getElementById('detail-subtitle').textContent = '';
    document.getElementById('detail-attendees').innerHTML = '<p>Loading...</p>';
    currentAttendees = [];
    currentEventTitle = eventTitle || 'your event';
    postEventState = null;
    document.getElementById('post-event-communication-panel').style.display = 'none';
    resetAttendeeEmailComposer();

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
            '<button id="btn-complete" class="btn-danger btn-full">Review &amp; Complete Event</button>' +
          '</div>' : '') +
          (isClosed ? '<div class="action-card card">' +
            '<button id="btn-complete" class="btn-danger btn-full">Review &amp; Complete Event</button>' +
          '</div>' : '') +
          (isCompleted ? '<div class="action-card card">' +
            '<button id="btn-post-event" class="btn-full">Post-event Communications</button>' +
          '</div>' : '');

        var actionsEl = document.getElementById('detail-actions');
        actionsEl.innerHTML = '';

        document.getElementById('btn-export').addEventListener('click', function() { exportCSV(eventId); });
        if (isPublished) {
          document.getElementById('btn-close-reg').addEventListener('click', function() { closeReg(eventId, chapterSlug); });
        }
        if (isPublished || isClosed) {
          document.getElementById('btn-complete').addEventListener('click', function() {
            openPostEventCommunication(eventId, chapterSlug, evtStatus);
          });
        }
        if (isCompleted) {
          document.getElementById('btn-post-event').addEventListener('click', function() {
            openPostEventCommunication(eventId, chapterSlug, evtStatus);
          });
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

        // Badge artwork status
        var existingRegenCard = document.getElementById('card-event-badge');
        if (existingRegenCard) existingRegenCard.remove();
        var regenCard = document.createElement('div');
        var themeYear = (data.eventDate || '').slice(0, 4) || new Date().getFullYear();
        regenCard.id = 'card-event-badge';
        regenCard.className = 'card';
        regenCard.style.cssText = 'margin-top:1rem;padding:1rem;';
        regenCard.innerHTML =
          '<h4 class="dash-card-title"><span class="icon" aria-hidden="true">' + GSCIcons.image + '</span> Attendee Badge</h4>' +
          '<p class="dash-card-info">Apply the shared ' + GSC.esc(themeYear) + ' community theme with this chapter’s local variation to the attendee, speaker, and organiser badges.</p>' +
          '<div id="badge-artwork-preview"></div>' +
          '<button id="btn-generate-badge-artwork" class="btn-full">' + (data.hasBadgeArtwork ? 'Rebuild Badges from Community Theme' : 'Apply Community Theme') + '</button>' +
          (data.hasBadgeArtwork ? '<p class="dash-card-info">Custom artwork is already saved for this event.</p>' : '') +
          '<p id="badge-artwork-status" class="dash-form-msg" role="status" aria-live="polite"></p>';
        var actionsParent2 = document.getElementById('detail-actions').parentNode;
        actionsParent2.insertBefore(regenCard, document.getElementById('detail-attendees'));
        document.getElementById('btn-generate-badge-artwork').addEventListener('click', function() {
          generateBadgeArtwork(eventId, chapterSlug);
        });

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
        currentAttendees = data.attendees.slice();
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
        document.getElementById('role-apply-btn').onclick = function() { applyRoleChange(eventId, eventTitle); };
        // Resend email button
        document.getElementById('resend-email-btn').onclick = function() { resendTicketEmails(eventId); };
        document.getElementById('compose-email-btn').onclick = function() { showAttendeeEmailComposer(); };
        document.getElementById('attendee-email-audience').onchange = function() {
          updateAttendeeEmailAudience(true);
        };
        document.getElementById('cancel-attendee-email-btn').onclick = resetAttendeeEmailComposer;
        document.getElementById('send-attendee-email-btn').onclick = function() { sendAttendeeEmails(eventId); };
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
          if (p.logoDataUrl && p.logoDataUrl.indexOf('data:image/') === 0) html += '<img src="' + GSC.esc(p.logoDataUrl) + '" class="partner-chip-logo">';
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

  function generateBadgeArtwork(eventId, chapterSlug) {
    var btn = document.getElementById('btn-generate-badge-artwork');
    var status = document.getElementById('badge-artwork-status');
    btn.disabled = true;
    btn.textContent = 'Generating...';
    status.textContent = 'Azure OpenAI is creating the artwork. This can take up to a minute.';

    GSC.fetch('/api/regenerateImage', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ eventId: eventId, chapterSlug: chapterSlug })
    })
    .then(function(response) {
      return response.json().then(function(data) {
        if (!response.ok) throw new Error(data.error || 'Failed to generate artwork.');
        return data;
      });
    })
    .then(function(data) {
      var preview = document.getElementById('badge-artwork-preview');
      preview.innerHTML =
        '<div class="badge-artwork-preview-grid">' +
          '<figure><img src="' + GSC.esc(data.attendeeImageDataUrl) + '" alt="Generated attendee badge artwork" class="badge-artwork-preview"><figcaption>Attendee</figcaption></figure>' +
          '<figure><img src="' + GSC.esc(data.speakerImageDataUrl) + '" alt="Generated speaker badge artwork" class="badge-artwork-preview"><figcaption>Speaker</figcaption></figure>' +
          '<figure><img src="' + GSC.esc(data.organiserImageDataUrl) + '" alt="Generated organiser badge artwork" class="badge-artwork-preview"><figcaption>Organiser</figcaption></figure>' +
        '</div>';
      var annualStatus = data.themeCreated
        ? 'The ' + data.themeYear + ' community theme was created. '
        : 'The existing ' + data.themeYear + ' community theme was reused. ';
      var chapterStatus = data.chapterThemeCreated
        ? 'A local chapter variation was created from it. '
        : 'The chapter’s existing local variation was reused. ';
      status.textContent = annualStatus + chapterStatus + 'Event badge variants are saved.';
      btn.textContent = 'Rebuild Badges from Community Theme';
      loadAuditLog(eventId);
    })
    .catch(function(error) {
      status.textContent = error.message;
      btn.textContent = 'Try Again';
    })
    .finally(function() {
      btn.disabled = false;
    });
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

  function openPostEventCommunication(eventId, chapterSlug, eventStatus) {
    var panel = document.getElementById('post-event-communication-panel');
    var content = document.getElementById('post-event-content');
    var status = document.getElementById('post-event-status');
    currentPostEventStatus = eventStatus;
    document.getElementById('post-event-heading').textContent = eventStatus === 'completed'
      ? 'Thank event contributors'
      : 'Complete event and thank contributors';
    panel.style.display = 'block';
    content.innerHTML = '<p class="text-muted">Loading recipients and message templates...</p>';
    status.style.display = 'none';
    panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    document.getElementById('post-event-close-btn').onclick = function() {
      panel.style.display = 'none';
    };

    GSC.fetch('/api/postEventCommunication?eventId=' + encodeURIComponent(eventId) +
      '&chapterSlug=' + encodeURIComponent(chapterSlug))
      .then(function(response) {
        return response.json().then(function(data) {
          if (!response.ok) throw new Error(data.error || 'Could not load post-event communications.');
          return data;
        });
      })
      .then(function(data) {
        postEventState = data;
        postEventDefaultTemplates = data.defaultTemplates;
        currentPostEventStatus = data.eventStatus;
        renderPostEventCommunication(eventId, chapterSlug);
      })
      .catch(function(error) {
        content.innerHTML = '<p class="form-message form-message--error">' + GSC.esc(error.message) + '</p>';
      });
  }

  function renderPostEventCommunication(eventId, chapterSlug) {
    var content = document.getElementById('post-event-content');
    document.getElementById('post-event-heading').textContent = currentPostEventStatus === 'completed'
      ? 'Thank event contributors'
      : 'Complete event and thank contributors';
    var recipients = postEventState.recipients;
    var job = postEventState.job;
    var started = Boolean(job.startedAt);
    var roleConfig = [
      ['attendee', 'Attendees', 'Attendee'],
      ['volunteer', 'Volunteers', 'Attendee'],
      ['speaker', 'Speakers', 'Speaker'],
      ['organiser', 'Organisers', 'Organiser'],
      ['sponsor', 'Community Partners', 'Attendee']
    ];
    var html =
      '<div class="post-event-guidance">' +
        '<h4>What will happen</h4>' +
        '<ul>' +
          '<li>Only registrations marked as checked in will receive an email.</li>' +
          '<li>Each person receives one message based on their assigned role.</li>' +
          '<li>The appropriate community, Speaker, or Organiser badge is attached as a LinkedIn-ready PNG.</li>' +
          '<li>Your messages are frozen when sending starts; successful deliveries are never repeated.</li>' +
          '<li>Messages send in safe batches while this page is open. If interrupted, reopen this event and resume.</li>' +
        '</ul>' +
      '</div>' +
      '<div class="post-event-recipient-summary">' +
        roleConfig.map(function(config) {
          return '<div><strong>' + recipients.roles[config[0]] + '</strong><span>' + config[1] + '</span></div>';
        }).join('') +
        '<div class="post-event-recipient-total"><strong>' + recipients.total + '</strong><span>Total recipients</span></div>' +
      '</div>';

    if (!postEventState.hasBadgeArtwork) {
      html += '<p class="post-event-warning"><strong>Badge artwork has not been applied.</strong> You can still continue, but the standard fallback badge will be attached.</p>';
    }

    if (started) {
      html += postEventProgressHtml(job.progress, job.status);
    } else {
      html += '<div class="post-event-template-list">';
      roleConfig.forEach(function(config) {
        var role = config[0];
        var template = postEventState.templates[role];
        var recipientCount = recipients.roles[role];
        html +=
          '<details class="post-event-template"' + (recipientCount > 0 ? ' open' : '') + '>' +
            '<summary><span>' + config[1] + '</span><span>' + recipientCount + ' recipients · ' + config[2] + ' badge</span></summary>' +
            '<div class="post-event-template__body">' +
              '<div class="form-group">' +
                '<label for="post-event-subject-' + role + '">Subject</label>' +
                '<input id="post-event-subject-' + role + '" data-post-event-role="' + role + '" data-post-event-field="subject" maxlength="150" value="' + GSC.esc(template.subject) + '">' +
              '</div>' +
              '<div class="form-group">' +
                '<label for="post-event-message-' + role + '">Message</label>' +
                '<textarea id="post-event-message-' + role + '" data-post-event-role="' + role + '" data-post-event-field="message" rows="8" maxlength="5000">' + GSC.esc(template.message) + '</textarea>' +
              '</div>' +
              '<button type="button" class="btn-outline post-event-restore" data-role="' + role + '">Restore default</button>' +
              '<div class="post-event-preview" id="post-event-preview-' + role + '" aria-label="' + config[1] + ' email preview"></div>' +
            '</div>' +
          '</details>';
      });
      html += '</div>' +
        '<p class="char-hint">Available placeholders: ' + postEventState.placeholders.map(GSC.esc).join(', ') + '. Draft changes save automatically.</p>' +
        '<div class="post-event-actions">' +
          '<button id="post-event-save-btn" type="button" class="btn-outline">Save Draft</button>' +
          '<button id="post-event-send-btn" type="button" class="btn-danger">' +
            (currentPostEventStatus === 'completed' ? 'Approve &amp; Send' : 'Approve, Complete Event &amp; Send') +
          '</button>' +
        '</div>';
    }

    content.innerHTML = html;
    if (started) {
      wirePostEventProgressActions(eventId, chapterSlug);
      return;
    }

    content.querySelectorAll('[data-post-event-field]').forEach(function(field) {
      field.addEventListener('input', function() {
        updatePostEventPreview(this.dataset.postEventRole);
        clearTimeout(postEventSaveTimer);
        postEventSaveTimer = setTimeout(function() {
          savePostEventDraft(eventId, chapterSlug, true);
        }, 1000);
      });
    });
    content.querySelectorAll('.post-event-restore').forEach(function(button) {
      button.addEventListener('click', function() {
        var role = this.dataset.role;
        document.getElementById('post-event-subject-' + role).value = postEventDefaultTemplates[role].subject;
        document.getElementById('post-event-message-' + role).value = postEventDefaultTemplates[role].message;
        updatePostEventPreview(role);
        savePostEventDraft(eventId, chapterSlug, true);
      });
    });
    roleConfig.forEach(function(config) { updatePostEventPreview(config[0]); });
    document.getElementById('post-event-save-btn').onclick = function() {
      savePostEventDraft(eventId, chapterSlug, false);
    };
    document.getElementById('post-event-send-btn').onclick = function() {
      approveAndSendPostEvent(eventId, chapterSlug);
    };
  }

  function collectPostEventTemplates() {
    var templates = {};
    ['attendee', 'volunteer', 'speaker', 'organiser', 'sponsor'].forEach(function(role) {
      templates[role] = {
        subject: document.getElementById('post-event-subject-' + role).value.trim(),
        message: document.getElementById('post-event-message-' + role).value.trim()
      };
    });
    return templates;
  }

  function updatePostEventPreview(role) {
    var subject = document.getElementById('post-event-subject-' + role).value;
    var message = document.getElementById('post-event-message-' + role).value;
    var preview = document.getElementById('post-event-preview-' + role);
    preview.innerHTML = '<strong>' + GSC.esc(subject) + '</strong><p>' +
      GSC.esc(message).replace(/\n/g, '<br>') + '</p>';
  }

  function savePostEventDraft(eventId, chapterSlug, silent) {
    var status = document.getElementById('post-event-status');
    return postEventRequest({
      action: 'saveDraft',
      eventId: eventId,
      chapterSlug: chapterSlug,
      templates: collectPostEventTemplates()
    }).then(function(data) {
      postEventState.templates = data.templates;
      status.textContent = silent ? 'Draft saved.' : 'Message draft saved.';
      status.style.display = 'block';
      if (silent) setTimeout(function() {
        if (status.textContent === 'Draft saved.') status.style.display = 'none';
      }, 1500);
      return data;
    }).catch(function(error) {
      status.textContent = error.message;
      status.style.display = 'block';
      return null;
    });
  }

  function approveAndSendPostEvent(eventId, chapterSlug) {
    clearTimeout(postEventSaveTimer);
    var total = postEventState.recipients.total;
    if (total === 0) {
      alert('No checked-in registrations are eligible for post-event communication.');
      return;
    }
    if (!confirm(
      'Complete this event and send role-specific thank-you emails to ' + total + ' checked-in recipient(s)?\n\n' +
      'The messages and recipient list will be frozen. Sending cannot be recalled, but failed deliveries can be retried safely.'
    )) return;

    var templates = collectPostEventTemplates();
    var status = document.getElementById('post-event-status');
    status.textContent = 'Saving messages and preparing recipients...';
    status.style.display = 'block';

    var completePromise = currentPostEventStatus === 'completed'
      ? Promise.resolve()
      : GSC.fetch('/api/eventAttendance', {
          method: 'POST',
          headers: {'Content-Type':'application/json'},
          body: JSON.stringify({ eventId: eventId, chapterSlug: chapterSlug, status: 'completed' })
        }).then(function(response) {
          if (!response.ok) throw new Error('The event could not be marked complete.');
          currentPostEventStatus = 'completed';
        });

    completePromise
      .then(function() {
        return postEventRequest({
          action: 'start',
          eventId: eventId,
          chapterSlug: chapterSlug,
          templates: templates
        });
      })
      .then(function(data) {
        postEventState.job = {
          status: 'processing',
          startedAt: new Date().toISOString(),
          completedAt: '',
          progress: data.progress
        };
        renderPostEventCommunication(eventId, chapterSlug);
        return processPostEventBatches(eventId, chapterSlug);
      })
      .catch(function(error) {
        status.textContent = error.message;
        status.style.display = 'block';
      });
  }

  function processPostEventBatches(eventId, chapterSlug) {
    var status = document.getElementById('post-event-status');
    status.textContent = 'Sending the next safe batch. Keep this page open...';
    status.style.display = 'block';
    return postEventRequest({
      action: 'processBatch',
      eventId: eventId,
      chapterSlug: chapterSlug
    }).then(function(data) {
      postEventState.job.status = data.jobStatus;
      postEventState.job.progress = data.progress;
      if (data.progress.pending > 0) {
        renderPostEventCommunication(eventId, chapterSlug);
        if (data.retryAfterMs) {
          return new Promise(function(resolve) {
            setTimeout(resolve, data.retryAfterMs);
          }).then(function() {
            return processPostEventBatches(eventId, chapterSlug);
          });
        }
        return processPostEventBatches(eventId, chapterSlug);
      }
      renderPostEventCommunication(eventId, chapterSlug);
      loadAuditLog(eventId);
      status.textContent = data.progress.failed > 0
        ? 'Sending finished with ' + data.progress.failed + ' failed recipient(s). Review and retry them below.'
        : 'All ' + data.progress.sent + ' post-event messages were sent successfully.';
      status.style.display = 'block';
      return data;
    }).catch(function(error) {
      status.textContent = 'Sending paused: ' + error.message + ' Reopen this event and resume when ready.';
      status.style.display = 'block';
      return null;
    });
  }

  function wirePostEventProgressActions(eventId, chapterSlug) {
    var progress = postEventState.job.progress;
    var prepareButton = document.getElementById('post-event-prepare-btn');
    var resumeButton = document.getElementById('post-event-resume-btn');
    var retryButton = document.getElementById('post-event-retry-btn');
    if (prepareButton) prepareButton.onclick = function() {
      var button = this;
      button.disabled = true;
      postEventRequest({
        action: 'start',
        eventId: eventId,
        chapterSlug: chapterSlug,
        templates: postEventState.templates
      }).then(function(data) {
        postEventState.job.status = 'processing';
        postEventState.job.progress = data.progress;
        renderPostEventCommunication(eventId, chapterSlug);
        return processPostEventBatches(eventId, chapterSlug);
      }).catch(function(error) {
        button.disabled = false;
        document.getElementById('post-event-status').textContent = error.message;
        document.getElementById('post-event-status').style.display = 'block';
      });
    };
    if (resumeButton) resumeButton.onclick = function() {
      this.disabled = true;
      processPostEventBatches(eventId, chapterSlug);
    };
    if (retryButton) retryButton.onclick = function() {
      var button = this;
      button.disabled = true;
      postEventRequest({
        action: 'retryFailed',
        eventId: eventId,
        chapterSlug: chapterSlug
      }).then(function(data) {
        postEventState.job.status = 'processing';
        postEventState.job.progress = data.progress;
        renderPostEventCommunication(eventId, chapterSlug);
        return processPostEventBatches(eventId, chapterSlug);
      }).catch(function(error) {
        button.disabled = false;
        document.getElementById('post-event-status').textContent = error.message;
        document.getElementById('post-event-status').style.display = 'block';
      });
    };
  }

  function postEventProgressHtml(progress, jobStatus) {
    var completed = progress.sent + progress.failed;
    var percentage = progress.total ? Math.round(completed / progress.total * 100) : 100;
    var html =
      '<div class="post-event-progress">' +
        '<div class="post-event-progress__heading"><strong>Delivery progress</strong><span>' + completed + ' of ' + progress.total + ' processed</span></div>' +
        '<div class="post-event-progress__track" role="progressbar" aria-valuemin="0" aria-valuemax="' + progress.total + '" aria-valuenow="' + completed + '">' +
          '<span style="width:' + percentage + '%"></span>' +
        '</div>' +
        '<div class="post-event-progress__counts">' +
          '<span><strong>' + progress.sent + '</strong> sent</span>' +
          '<span><strong>' + progress.pending + '</strong> pending</span>' +
          '<span><strong>' + progress.failed + '</strong> failed</span>' +
        '</div>' +
      '</div>';
    if (jobStatus === 'initialising') {
      html += '<p class="text-muted">Recipient preparation was interrupted before sending began. It is safe to resume.</p>' +
        '<button id="post-event-prepare-btn" type="button">Resume Preparation</button>';
    } else if (progress.pending > 0) {
      html += '<button id="post-event-resume-btn" type="button">Resume Sending</button>';
    } else if (progress.failed > 0) {
      html += '<button id="post-event-retry-btn" type="button">Retry Failed Messages</button>';
    } else if (jobStatus === 'completed') {
      html += '<p class="post-event-success">All post-event messages were delivered successfully.</p>';
    }
    return html;
  }

  function postEventRequest(body) {
    return GSC.fetch('/api/postEventCommunication', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify(body)
    }).then(function(response) {
      return response.json().then(function(data) {
        if (!response.ok) throw new Error(data.error || 'Post-event communication failed.');
        return data;
      });
    });
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
    if (document.getElementById('attendee-email-audience').value === 'selected') {
      updateAttendeeEmailAudience();
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

  function resendTicketEmails(eventId) {
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
    .finally(function() { btn.disabled = false; btn.textContent = 'Resend Tickets'; });
  }

  function showAttendeeEmailComposer() {
    var composer = document.getElementById('attendee-email-composer');
    composer.style.display = 'block';
    updateAttendeeEmailAudience(true);
    document.getElementById('attendee-email-audience').focus();
  }

  function resetAttendeeEmailComposer() {
    var composer = document.getElementById('attendee-email-composer');
    if (!composer) return;
    composer.style.display = 'none';
    document.getElementById('attendee-email-subject').value = '';
    document.getElementById('attendee-email-message').value = '';
    document.getElementById('attendee-email-audience').value = 'selected';
    var status = document.getElementById('attendee-email-status');
    status.textContent = '';
    status.style.display = 'none';
  }

  function getAttendeeEmailAudienceIds() {
    var audience = document.getElementById('attendee-email-audience').value;
    if (audience === 'selected') {
      var selectedIds = [];
      document.querySelectorAll('.attendee-check:checked').forEach(function(cb) {
        selectedIds.push(cb.dataset.regId);
      });
      return selectedIds;
    }
    return currentAttendees.filter(function(attendee) {
      var interested = attendee.volunteerInterest === true;
      var confirmed = attendee.role === 'volunteer';
      if (audience === 'volunteer-interest') return interested;
      if (audience === 'volunteer-role') return confirmed;
      return interested || confirmed;
    }).map(function(attendee) { return attendee.id; });
  }

  function updateAttendeeEmailAudience(loadTemplate) {
    var audience = document.getElementById('attendee-email-audience').value;
    var ids = getAttendeeEmailAudienceIds();
    var countText = ids.length + (ids.length === 1 ? ' recipient' : ' recipients');
    document.getElementById('attendee-email-recipients').textContent = countText;

    var copy = {
      selected: {
        help: 'Uses the registrations selected in the attendee table.',
        subject: 'Important information for ' + currentEventTitle,
        message: ''
      },
      'volunteer-interest': {
        help: 'People who opted in to hear about volunteering. This does not grant the volunteer role or scanner access.',
        subject: 'Volunteer opportunities for ' + currentEventTitle,
        message: 'Thank you for indicating that you may be interested in volunteering.\n\nWe are getting the volunteer team together and wanted to share the next steps with you.'
      },
      'volunteer-role': {
        help: 'Only registrations assigned the confirmed Volunteer role.',
        subject: 'Volunteer briefing for ' + currentEventTitle,
        message: 'Thank you for volunteering to help with this event.\n\nPlease review the following important information about your volunteer role and event-day arrangements.'
      },
      'volunteer-all': {
        help: 'The combined interested and confirmed volunteer groups. Duplicate registrations are included only once.',
        subject: 'Volunteer information for ' + currentEventTitle,
        message: 'Thank you for your interest in helping with this event.\n\nWe are coordinating the volunteer team and wanted to share the following information and next steps.'
      }
    }[audience];
    document.getElementById('attendee-email-audience-help').textContent = copy.help;
    if (loadTemplate) {
      document.getElementById('attendee-email-subject').value = copy.subject;
      document.getElementById('attendee-email-message').value = copy.message;
    }
  }

  function sendAttendeeEmails(eventId) {
    var audience = document.getElementById('attendee-email-audience').value;
    var registrationIds = getAttendeeEmailAudienceIds();
    var subject = document.getElementById('attendee-email-subject').value.trim();
    var message = document.getElementById('attendee-email-message').value.trim();
    var status = document.getElementById('attendee-email-status');
    if (registrationIds.length === 0) {
      resetAttendeeEmailComposer();
      return;
    }
    if (!subject || !message) {
      status.textContent = 'Enter both a subject and message.';
      status.style.display = 'block';
      return;
    }
    if (!confirm('Send this email to ' + registrationIds.length + ' recipient(s)?')) return;

    var btn = document.getElementById('send-attendee-email-btn');
    btn.disabled = true;
    btn.textContent = 'Sending...';
    status.style.display = 'none';

    var batches = [];
    for (var i = 0; i < registrationIds.length; i += 100) {
      batches.push(registrationIds.slice(i, i + 100));
    }
    var result = { sent: 0, failed: 0 };
    var sendSequence = Promise.resolve();

    batches.forEach(function(batch, index) {
      sendSequence = sendSequence.then(function() {
        status.textContent = batches.length > 1 ? 'Sending batch ' + (index + 1) + ' of ' + batches.length + '...' : '';
        status.style.display = batches.length > 1 ? 'block' : 'none';
        return GSC.fetch('/api/sendAttendeeEmail', {
          method: 'POST',
          headers: {'Content-Type':'application/json'},
          body: JSON.stringify({
            eventId: eventId,
            registrationIds: batch,
            audience: audience,
            subject: subject,
            message: message
          })
        }).then(function(r) {
          return r.json().then(function(data) {
            if (!r.ok) throw new Error(data.error || 'Failed to send emails.');
            result.sent += data.sent || 0;
            result.failed += data.failed || 0;
          });
        });
      });
    });

    sendSequence
    .then(function() {
      status.textContent = result.sent + ' email(s) sent.' + (result.failed ? ' ' + result.failed + ' failed.' : '');
      status.style.display = 'block';
      if (result.sent > 0 && result.failed === 0) {
        document.getElementById('attendee-email-subject').value = '';
        document.getElementById('attendee-email-message').value = '';
      }
      loadAuditLog(eventId);
    })
    .catch(function(error) {
      status.textContent = (result.sent ? result.sent + ' email(s) sent before an error occurred. ' : '') + error.message;
      status.style.display = 'block';
    })
    .finally(function() {
      btn.disabled = false;
      btn.textContent = 'Send Email';
    });
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
      'attendee_email_sent': 'Emailed attendees',
      'badge_artwork_generated': 'Generated badge artwork',
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
    if (action === 'attendee_email_sent') return GSC.esc(d.subject || '') + ' · ' + GSC.esc((d.sent || 0) + '') + ' sent' + (d.failed ? ', ' + d.failed + ' failed' : '');
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
        if (editQuill) {
          var safeDesc = typeof DOMPurify !== 'undefined'
            ? DOMPurify.sanitize(data.description || '')
            : GSC.esc(data.description || '');
          editQuill.root.innerHTML = safeDesc;
        }
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
