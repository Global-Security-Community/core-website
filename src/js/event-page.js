(function() {
  var FETCH_TIMEOUT = 10000; // 10s timeout for API calls

  // Timeout wrapper for fetch — rejects after ms if not resolved
  function fetchWithTimeout(url, ms) {
    return new Promise(function(resolve, reject) {
      var timer = setTimeout(function() { reject(new Error('timeout')); }, ms);
      fetch(url).then(function(r) {
        clearTimeout(timer);
        resolve(r);
      }).catch(function(e) {
        clearTimeout(timer);
        reject(e);
      });
    });
  }

  // Get event slug from the page's data attribute or URL
  var slug = document.querySelector('[data-event-slug]');
  var eventSlug = slug ? slug.getAttribute('data-event-slug') : '';

  // Try to get slug from the register button href
  if (!eventSlug) {
    var btn = document.getElementById('register-btn');
    if (btn) {
      var match = btn.href.match(/event=([^&]+)/);
      if (match) eventSlug = match[1];
    }
  }

  // Update register button for unauthenticated users to preserve redirect through login
  if (eventSlug) {
    fetch('/.auth/me')
      .then(function(r) { return r.json(); })
      .then(function(data) {
        if (!data.clientPrincipal) {
          var btn = document.getElementById('register-btn');
          if (btn) {
            var registerUrl = '/register/?event=' + encodeURIComponent(eventSlug);
            btn.href = '/.auth/login/ciam?post_login_redirect_uri=' + encodeURIComponent(registerUrl);
          }
        }
      })
      .catch(function() {});
  }

  // Fetch event data with timeout
  if (eventSlug) {
    fetchWithTimeout('/api/getEvent?slug=' + encodeURIComponent(eventSlug), FETCH_TIMEOUT)
      .then(function(r) { return r.json(); })
      .then(function(data) {
        var el = document.getElementById('reg-count');
        var count = data.registrationCount;
        var cap = data.registrationCap;
        // Use front-matter attendeeCount override for legacy events (pre-platform)
        var override = slug ? slug.getAttribute('data-attendee-count') : null;
        if (override) count = parseInt(override);

        // Show registration status with capacity context
        if (el && data.status === 'completed') {
          el.textContent = count + ' attended';
        } else if (el && cap > 0) {
          var spotsLeft = cap - count;
          if (spotsLeft <= 0) {
            el.innerHTML = '<span class="reg-full">' + count + ' / ' + cap + '</span> <span class="reg-status reg-status--full">Full</span>';
          } else if (spotsLeft <= Math.ceil(cap * 0.15)) {
            el.innerHTML = count + ' / ' + cap + ' <span class="reg-status reg-status--low">' + spotsLeft + ' spot' + (spotsLeft === 1 ? '' : 's') + ' left</span>';
          } else {
            el.textContent = count + ' / ' + cap + ' registered';
          }
        } else if (el) {
          el.textContent = count + ' registered';
        }

        if (data.status === 'closed' || data.status === 'completed') {
          var btn = document.getElementById('register-btn');
          if (btn) {
            btn.textContent = 'Registration Closed';
            btn.classList.add('btn-cta--disabled');
          }
        }
        if (data.registrationCap > 0 && data.registrationCount >= data.registrationCap) {
          var btn = document.getElementById('register-btn');
          if (btn) {
            btn.textContent = 'Event Full';
            btn.classList.add('btn-cta--disabled');
          }
        }
        // Render rich HTML description from API (overrides SSR plain text)
        if (data.description) {
          var descEl = document.getElementById('event-description');
          if (descEl) {
            descEl.innerHTML = typeof DOMPurify !== 'undefined'
              ? DOMPurify.sanitize(data.description)
              : GSC.esc(data.description);
          }
        }
        // Refresh location text from the API (dashboard edits update Table
        // Storage immediately; the SSR frontmatter only updates on next deploy)
        if (data.location) {
          var cardLocEl = document.getElementById('location-card-text');
          if (cardLocEl) cardLocEl.innerHTML = GSC.formatLocation(data.location);
          var fullLocEl = document.getElementById('location-full-text');
          if (fullLocEl) fullLocEl.innerHTML = GSC.formatLocation(data.location);
        }
        renderRecognition(data.volunteers);
        // Load community partners
        if (data.id) { loadPartners(data.id); }
      })
      .catch(function(err) {
        var el = document.getElementById('reg-count');
        if (el) {
          el.textContent = err.message === 'timeout'
            ? 'Unable to load'
            : '—';
        }
      });
  }

  function renderRecognition(volunteers) {
    var section = document.getElementById('volunteer-cards');
    var groupsEl = document.getElementById('recognition-groups');
    if (!section || !groupsEl || !volunteers || volunteers.length === 0) return;

    var groups = {
      organiser: [],
      volunteer: []
    };

    volunteers.forEach(function(person) {
      var role = person.role === 'organiser' ? 'organiser' : person.role === 'volunteer' ? 'volunteer' : '';
      if (!role || !person.name) return;
      groups[role].push(person);
    });

    var html = '';
    html += renderRecognitionGroup('organiser', 'Organisers', groups.organiser);
    html += renderRecognitionGroup('volunteer', 'Volunteers', groups.volunteer);

    if (!html) return;
    groupsEl.innerHTML = html;
    section.classList.remove('is-hidden');
  }

  function renderRecognitionGroup(role, heading, people) {
    if (!people || people.length === 0) return '';

    var html = '<div class="recognition-group recognition-group--' + role + '">';
    html += '<h3>' + heading + '</h3>';
    html += '<div class="volunteer-cards">';
    people.forEach(function(person) {
      html += '<article class="volunteer-card">';
      html += '<span class="role-badge role-badge--' + role + '">' + GSC.esc(role) + '</span>';
      html += '<div class="volunteer-name">' + GSC.esc(person.name) + '</div>';
      if (person.company) html += '<div class="volunteer-company">' + GSC.esc(person.company) + '</div>';
      html += '</article>';
    });
    html += '</div></div>';
    return html;
  }

  function loadPartners(eventId) {
    fetch('/api/getCommunityPartners?eventId=' + encodeURIComponent(eventId))
      .then(function(r) { return r.ok ? r.json() : null; })
      .then(function(data) {
        if (!data || !data.partners) return;
        var tiers = data.partners;
        var tierNames = Object.keys(tiers);
        if (tierNames.length === 0) return;

        var section = document.getElementById('community-partners');
        var content = document.getElementById('partners-content');
        if (!section || !content) return;
        var html = '';
        tierNames.forEach(function(tierName) {
          html += '<div class="partners-tier">';
          html += '<h3>' + GSC.esc(tierName) + '</h3>';
          html += '<div class="partners-grid">';
          tiers[tierName].forEach(function(p) {
            var tag = p.website ? 'a' : 'div';
            var href = p.website ? ' href="' + GSC.esc(GSC.safeUrl(p.website)) + '" target="_blank" rel="noopener noreferrer"' : '';
            html += '<' + tag + ' class="partner-logo"' + href + '>';
            if (p.logoDataUrl && p.logoDataUrl.indexOf('data:image/') === 0) html += '<img src="' + GSC.esc(p.logoDataUrl) + '" alt="' + GSC.esc(p.name) + '">';
            html += '<span class="partner-name">' + GSC.esc(p.name) + '</span>';
            html += '</' + tag + '>';
          });
          html += '</div></div>';
        });
        content.innerHTML = html;
        section.classList.remove('is-hidden');
      })
      .catch(function() {});
  }

  // Sessionize integration — try cached data first, fall back to live API
  var agendaEl = document.getElementById('sessionize-agenda');
  var speakersEl = document.getElementById('sessionize-speakers');

  if (agendaEl || speakersEl) {
    var sessionizeId = '';
    var metaEl = document.querySelector('[data-sessionize-id]');
    if (metaEl) sessionizeId = metaEl.getAttribute('data-sessionize-id');

    if (sessionizeId) {
      // Agenda: try cache then live, with timeout
      if (agendaEl) {
        fetchWithTimeout('/api/getSessionizeData?sessionizeId=' + encodeURIComponent(sessionizeId) + '&type=agenda', FETCH_TIMEOUT)
          .then(function(r) { return r.ok ? r.json() : Promise.reject('no cache'); })
          .then(function(res) { renderAgenda(res.data); })
          .catch(function() {
            fetchWithTimeout('https://sessionize.com/api/v2/' + sessionizeId + '/view/GridSmart', FETCH_TIMEOUT)
              .then(function(r) { return r.json(); })
              .then(function(data) { renderAgenda(data); })
              .catch(function() { showLoadError(agendaEl, 'Could not load agenda.'); });
          });
      }

      // Speakers: try cache then live, with timeout
      if (speakersEl) {
        fetchWithTimeout('/api/getSessionizeData?sessionizeId=' + encodeURIComponent(sessionizeId) + '&type=speakers', FETCH_TIMEOUT)
          .then(function(r) { return r.ok ? r.json() : Promise.reject('no cache'); })
          .then(function(res) { renderSpeakers(res.data); })
          .catch(function() {
            fetchWithTimeout('https://sessionize.com/api/v2/' + sessionizeId + '/view/Speakers', FETCH_TIMEOUT)
              .then(function(r) { return r.json(); })
              .then(function(speakers) { renderSpeakers(speakers); })
              .catch(function() { showLoadError(speakersEl, 'Could not load speakers.'); });
          });
      }
    } else {
      // No sessionize ID — clear skeleton placeholders
      if (agendaEl) agendaEl.innerHTML = '<p>Agenda coming soon.</p>';
      if (speakersEl) speakersEl.innerHTML = '<p>Speakers to be announced.</p>';
    }
  }

  function renderSpeakers(speakers) {
    if (!speakers || speakers.length === 0) {
      speakersEl.innerHTML = '<p>Speakers to be announced.</p>';
      return;
    }
    var html = '';
    speakers.forEach(function(s) {
      var sessionName = (s.sessions && s.sessions.length) ? s.sessions[0].name : '';
      html += '<div class="speaker-card-wrap">';
      html += '<div class="speaker-card" tabindex="0" role="button" aria-label="' + GSC.esc(s.fullName) + ' — click to see bio">';
      // Front
      html += '<div class="speaker-card-front">';
      if (s.profilePicture && s.profilePicture.indexOf('https://') === 0) {
        html += '<img src="' + GSC.esc(s.profilePicture) + '" alt="' + GSC.esc(s.fullName) + '" class="speaker-photo">';
      }
      html += '<h4>' + GSC.esc(s.fullName) + '</h4>';
      if (s.tagLine) html += '<p class="speaker-tagline">' + GSC.esc(s.tagLine) + '</p>';
      if (sessionName) html += '<p class="speaker-session">' + GSC.esc(sessionName) + '</p>';
      html += '<p class="speaker-flip-hint">Flip card to see bio</p>';
      html += '</div>';
      // Back
      html += '<div class="speaker-card-back">';
      html += '<h4>' + GSC.esc(s.fullName) + '</h4>';
      html += '<p class="speaker-bio">' + GSC.esc(s.bio || 'No bio available.') + '</p>';
      html += '<p class="speaker-flip-hint">Tap to flip back</p>';
      html += '</div>';
      html += '</div></div>';
    });
    speakersEl.className = 'speakers-grid';
    speakersEl.innerHTML = html;

    // Add click and keyboard handlers for flip (CSP blocks inline onclick)
    var cards = speakersEl.querySelectorAll('.speaker-card');
    for (var i = 0; i < cards.length; i++) {
      cards[i].addEventListener('click', function() { this.classList.toggle('flipped'); });
      cards[i].addEventListener('keydown', function(e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          this.classList.toggle('flipped');
        }
      });
    }
  }

  // Lookup of session id -> session object, populated while rendering the agenda,
  // so the modal can show full details without a second fetch.
  var sessionsById = {};

  function renderAgenda(data) {
            if (!data || data.length === 0) {
              agendaEl.innerHTML = '<p>Agenda coming soon.</p>';
              return;
            }

            sessionsById = {};
            var html = '';
            data.forEach(function(day) {
              var slots = day.timeSlots || [];
              if (!slots.length) return;

              var roomNames = [];
              var roomIdSet = {};
              slots.forEach(function(slot) {
                (slot.rooms || []).forEach(function(r) {
                  if (!roomIdSet[r.id]) {
                    roomIdSet[r.id] = true;
                    roomNames.push({ id: r.id, name: r.name });
                  }
                });
              });

              var multiRoom = roomNames.length > 1;

              html += '<div class="agenda-table-wrap">';
              html += '<table class="agenda-table">';
              if (multiRoom) {
                html += '<thead><tr><th class="agenda-time-col">Time</th>';
                roomNames.forEach(function(room) {
                  html += '<th>' + GSC.esc(room.name) + '</th>';
                });
                html += '</tr></thead>';
              }
              html += '<tbody>';

              slots.forEach(function(slot) {
                var time = formatTime(slot.slotStart, day.date);
                var roomMap = {};
                (slot.rooms || []).forEach(function(r) {
                  roomMap[r.id] = r.session;
                });

                var firstSession = (slot.rooms && slot.rooms.length) ? slot.rooms[0].session : null;
                var isPlenum = firstSession && firstSession.isPlenumSession;

                html += '<tr class="' + (firstSession && firstSession.isServiceSession ? 'agenda-row-service' : 'agenda-row-session') + '">';
                html += '<td class="agenda-time-col">' + GSC.esc(time) + '</td>';

                if (isPlenum || !multiRoom) {
                  var s = firstSession;
                  var colspan = multiRoom ? ' colspan="' + roomNames.length + '"' : '';
                  html += '<td' + colspan + '>';
                  html += renderSession(s);
                  html += '</td>';
                } else {
                  roomNames.forEach(function(room) {
                    var s = roomMap[room.id];
                    html += '<td>';
                    if (s) { html += renderSession(s); }
                    html += '</td>';
                  });
                }

                html += '</tr>';
              });

              html += '</tbody></table></div>';
            });

            agendaEl.innerHTML = html;

            // Add click and keyboard handlers to open the session detail modal
            var sessionEls = agendaEl.querySelectorAll('.agenda-session[data-session-id]');
            for (var i = 0; i < sessionEls.length; i++) {
              sessionEls[i].addEventListener('click', onSessionActivate);
              sessionEls[i].addEventListener('keydown', function(e) {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSessionActivate.call(this);
                }
              });
            }
  }

  function onSessionActivate() {
    var id = this.getAttribute('data-session-id');
    var s = sessionsById[id];
    if (s) openSessionModal(s);
  }

  function renderSession(s) {
    if (!s) return '';
    var hasDetail = !!(s.description || (s.speakers && s.speakers.length));
    if (s.id != null) sessionsById[s.id] = s;
    var attrs = hasDetail && s.id != null
      ? ' tabindex="0" role="button" data-session-id="' + GSC.esc(String(s.id)) + '" aria-label="' + GSC.esc(s.title) + ' — click for session details"'
      : '';
    var h = '<div class="agenda-session' + (hasDetail ? ' agenda-session--clickable' : '') + '"' + attrs + '>';
    h += '<div class="agenda-session-title">' + GSC.esc(s.title) + '</div>';
    if (s.speakers && s.speakers.length) {
      h += '<div class="agenda-session-speakers">' + s.speakers.map(function(sp) { return GSC.esc(sp.name); }).join(', ') + '</div>';
    }
    h += '</div>';
    return h;
  }

  // ─── Session Detail Modal ───
  var sessionModal = null;
  var sessionModalTrigger = null;

  function openSessionModal(s) {
    if (!sessionModal) {
      sessionModal = document.createElement('div');
      sessionModal.className = 'session-modal-backdrop';
      sessionModal.innerHTML =
        '<div class="session-modal" role="dialog" aria-modal="true" aria-labelledby="session-modal-title">' +
          '<button type="button" class="session-modal-close" aria-label="Close">&times;</button>' +
          '<div class="session-modal-body"></div>' +
        '</div>';
      document.body.appendChild(sessionModal);

      sessionModal.addEventListener('click', function(e) {
        if (e.target === sessionModal) closeSessionModal();
      });
      sessionModal.querySelector('.session-modal-close').addEventListener('click', closeSessionModal);
      document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && sessionModal.classList.contains('is-open')) closeSessionModal();
      });
    }

    sessionModalTrigger = document.activeElement;

    var body = sessionModal.querySelector('.session-modal-body');
    var html = '<h3 id="session-modal-title">' + GSC.esc(s.title) + '</h3>';

    var timeRange = formatTimeRange(s.startsAt, s.endsAt);
    var meta = [];
    if (timeRange) meta.push(timeRange);
    if (s.room) meta.push(s.room);
    if (meta.length) html += '<p class="session-modal-meta">' + meta.map(GSC.esc).join(' &middot; ') + '</p>';

    if (s.speakers && s.speakers.length) {
      html += '<p class="session-modal-speakers">' + s.speakers.map(function(sp) { return GSC.esc(sp.name); }).join(', ') + '</p>';
    }

    if (s.description) {
      html += '<div class="session-modal-description">' + formatMultiline(s.description) + '</div>';
    }

    body.innerHTML = html;
    sessionModal.classList.add('is-open');
    document.body.classList.add('modal-open');
    sessionModal.querySelector('.session-modal-close').focus();
  }

  function closeSessionModal() {
    if (!sessionModal) return;
    sessionModal.classList.remove('is-open');
    document.body.classList.remove('modal-open');
    if (sessionModalTrigger && typeof sessionModalTrigger.focus === 'function') sessionModalTrigger.focus();
  }

  // Escape and preserve line breaks / paragraph gaps in plain-text descriptions
  function formatMultiline(text) {
    return text.split(/\r?\n\r?\n/).map(function(para) {
      return '<p>' + para.split(/\r?\n/).map(GSC.esc).join('<br>') + '</p>';
    }).join('');
  }

  function formatTimeRange(startsAt, endsAt) {
    if (!startsAt) return '';
    var start = formatIsoTime(startsAt);
    var end = endsAt ? formatIsoTime(endsAt) : '';
    return end ? start + ' – ' + end : start;
  }

  function formatIsoTime(iso) {
    // iso is "YYYY-MM-DDTHH:MM:SS"
    var timePart = iso.split('T')[1];
    if (!timePart) return '';
    return formatTime(timePart, '');
  }

  function formatTime(slotStart, dayDate) {
    // slotStart is "HH:MM:SS", dayDate is "YYYY-MM-DDT00:00:00"
    var parts = slotStart.split(':');
    var h = parseInt(parts[0], 10);
    var m = parts[1];
    var ampm = h >= 12 ? 'PM' : 'AM';
    var h12 = h % 12 || 12;
    return h12 + ':' + m + ' ' + ampm;
  }

  // ─── Add to Calendar (.ics download) ───
  var calBtn = document.getElementById('add-to-calendar');
  if (calBtn && slug) {
    var eventTitle = document.querySelector('h1') ? document.querySelector('h1').textContent.trim() : '';
    var eventDate = slug.getAttribute('data-event-slug') ? '' : ''; // read from rendered date
    // Extract date from the info card (already formatted by humanDate filter)
    var dateCell = calBtn.closest('.card');
    var dateText = dateCell ? dateCell.querySelector('.text-semibold').textContent.trim() : '';
    // Extract location from the second info card
    var locationCards = document.querySelectorAll('.cards--info .card--centered');
    var eventLocation = locationCards.length > 1 ? locationCards[1].querySelector('.text-semibold').textContent.trim() : '';

    calBtn.addEventListener('click', function() {
      // Parse the human-readable date back to YYYYMMDD
      var icsDate = parseHumanDate(dateText);
      if (!icsDate) return;

      // Build .ics content (all-day event)
      var nextDay = incrementDate(icsDate);
      var ics = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//Global Security Community//Event//EN',
        'CALSCALE:GREGORIAN',
        'METHOD:PUBLISH',
        'BEGIN:VEVENT',
        'DTSTART;VALUE=DATE:' + icsDate,
        'DTEND;VALUE=DATE:' + nextDay,
        'SUMMARY:' + escapeIcs(eventTitle),
        'LOCATION:' + escapeIcs(eventLocation),
        'URL:' + window.location.href,
        'UID:' + eventSlug + '@globalsecurity.community',
        'END:VEVENT',
        'END:VCALENDAR'
      ].join('\r\n');

      var blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
      var link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = (eventSlug || 'event') + '.ics';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
    });
  }

  function parseHumanDate(str) {
    // Parse "1 August 2026" → "20260801"
    var months = { january:'01', february:'02', march:'03', april:'04', may:'05', june:'06',
                   july:'07', august:'08', september:'09', october:'10', november:'11', december:'12' };
    var parts = str.split(' ');
    if (parts.length < 3) return null;
    var day = parts[0].padStart(2, '0');
    var month = months[parts[1].toLowerCase()];
    var year = parts[2];
    if (!month) return null;
    return year + month + day;
  }

  function incrementDate(yyyymmdd) {
    var y = parseInt(yyyymmdd.slice(0, 4), 10);
    var m = parseInt(yyyymmdd.slice(4, 6), 10) - 1;
    var d = parseInt(yyyymmdd.slice(6, 8), 10);
    var date = new Date(y, m, d + 1);
    var ny = date.getFullYear().toString();
    var nm = (date.getMonth() + 1).toString().padStart(2, '0');
    var nd = date.getDate().toString().padStart(2, '0');
    return ny + nm + nd;
  }

  function escapeIcs(str) {
    return (str || '').replace(/[\\;,]/g, function(c) { return '\\' + c; }).replace(/\n/g, '\\n');
  }

  // ─── Load Error with Retry (CSP-safe, no inline onclick) ───
  function showLoadError(el, message) {
    el.innerHTML = '<p class="load-error">' + GSC.esc(message) + ' <button type="button" class="btn-retry">Retry</button></p>';
    el.querySelector('.btn-retry').addEventListener('click', function() {
      location.reload();
    });
  }

  // ─── Share Button (Web Share API with copy-link fallback) ───
  var shareBtn = document.getElementById('share-btn');
  if (shareBtn) {
    shareBtn.addEventListener('click', function() {
      var title = document.querySelector('h1') ? document.querySelector('h1').textContent.trim() : document.title;
      var url = window.location.href;

      if (navigator.share) {
        navigator.share({ title: title, url: url }).catch(function() {});
      } else {
        // Fallback: copy URL to clipboard
        navigator.clipboard.writeText(url).then(function() {
          var textEl = shareBtn.querySelector('.btn-share-text');
          if (textEl) {
            textEl.textContent = 'Copied!';
            setTimeout(function() { textEl.textContent = 'Share'; }, 2000);
          }
        }).catch(function() {
          // Final fallback for older browsers
          var input = document.createElement('input');
          input.value = url;
          document.body.appendChild(input);
          input.select();
          document.execCommand('copy');
          document.body.removeChild(input);
          var textEl = shareBtn.querySelector('.btn-share-text');
          if (textEl) {
            textEl.textContent = 'Copied!';
            setTimeout(function() { textEl.textContent = 'Share'; }, 2000);
          }
        });
      }
    });
  }
})();
