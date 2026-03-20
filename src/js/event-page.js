(function() {
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

  // Fetch registration count
  if (eventSlug) {
    fetch('/api/getEvent?slug=' + encodeURIComponent(eventSlug))
      .then(function(r) { return r.json(); })
      .then(function(data) {
        var el = document.getElementById('reg-count');
        var count = data.registrationCount;
        var cap = data.registrationCap;
        // For completed events with a cap, show as fully attended
        if (data.status === 'completed' && cap > 0) {
          count = cap;
        }
        if (el && cap > 0) {
          el.textContent = count + ' / ' + cap + ' registered';
        } else if (el) {
          el.textContent = count + ' registered';
        }
        if (data.status === 'closed' || data.status === 'completed') {
          var btn = document.getElementById('register-btn');
          if (btn) {
            btn.textContent = 'Registration Closed';
            btn.style.backgroundColor = '#999';
            btn.style.pointerEvents = 'none';
          }
        }
        if (data.registrationCap > 0 && data.registrationCount >= data.registrationCap) {
          var btn = document.getElementById('register-btn');
          if (btn) {
            btn.textContent = 'Event Full';
            btn.style.backgroundColor = '#999';
            btn.style.pointerEvents = 'none';
          }
        }
        // Render volunteer cards
        if (data.volunteers && data.volunteers.length > 0) {
          var volEl = document.getElementById('volunteer-cards');
          if (volEl) {
            var html = '';
            data.volunteers.forEach(function(v) {
              html += '<div class="volunteer-card">';
              html += '<div class="volunteer-name">' + esc(v.name) + '</div>';
              if (v.company) html += '<div class="volunteer-company">' + esc(v.company) + '</div>';
              html += '</div>';
            });
            volEl.innerHTML = html;
            volEl.style.display = 'flex';
          }
        }
        // Load community partners
        if (data.id) { loadPartners(data.id); }
      })
      .catch(function() {});
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
          html += '<h3>' + esc(tierName) + '</h3>';
          html += '<div class="partners-grid">';
          tiers[tierName].forEach(function(p) {
            var tag = p.website ? 'a' : 'div';
            var href = p.website ? ' href="' + esc(p.website) + '" target="_blank" rel="noopener noreferrer"' : '';
            html += '<' + tag + ' class="partner-logo"' + href + '>';
            if (p.logoDataUrl) html += '<img src="' + p.logoDataUrl + '" alt="' + esc(p.name) + '">';
            html += '<span class="partner-name">' + esc(p.name) + '</span>';
            html += '</' + tag + '>';
          });
          html += '</div></div>';
        });
        content.innerHTML = html;
        section.style.display = 'block';
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
      // Agenda: try cache then live
      if (agendaEl) {
        fetch('/api/getSessionizeData?sessionizeId=' + encodeURIComponent(sessionizeId) + '&type=agenda')
          .then(function(r) { return r.ok ? r.json() : Promise.reject('no cache'); })
          .then(function(res) { renderAgenda(res.data); })
          .catch(function() {
            fetch('https://sessionize.com/api/v2/' + sessionizeId + '/view/GridSmart')
              .then(function(r) { return r.json(); })
              .then(function(data) { renderAgenda(data); })
              .catch(function() { agendaEl.innerHTML = '<p>Could not load agenda.</p>'; });
          });
      }

      // Speakers: try cache then live
      if (speakersEl) {
        fetch('/api/getSessionizeData?sessionizeId=' + encodeURIComponent(sessionizeId) + '&type=speakers')
          .then(function(r) { return r.ok ? r.json() : Promise.reject('no cache'); })
          .then(function(res) { renderSpeakers(res.data); })
          .catch(function() {
            fetch('https://sessionize.com/api/v2/' + sessionizeId + '/view/Speakers')
              .then(function(r) { return r.json(); })
              .then(function(speakers) { renderSpeakers(speakers); })
              .catch(function() { speakersEl.innerHTML = '<p>Could not load speakers.</p>'; });
          });
      }
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
      html += '<div class="speaker-card">';
      // Front
      html += '<div class="speaker-card-front">';
      if (s.profilePicture && s.profilePicture.indexOf('https://') === 0) {
        html += '<img src="' + esc(s.profilePicture) + '" alt="' + esc(s.fullName) + '" class="speaker-photo">';
      }
      html += '<h4>' + esc(s.fullName) + '</h4>';
      if (s.tagLine) html += '<p class="speaker-tagline">' + esc(s.tagLine) + '</p>';
      if (sessionName) html += '<p class="speaker-session">' + esc(sessionName) + '</p>';
      html += '</div>';
      // Back
      html += '<div class="speaker-card-back">';
      html += '<h4>' + esc(s.fullName) + '</h4>';
      html += '<p class="speaker-bio">' + esc(s.bio || 'No bio available.') + '</p>';
      html += '<p class="speaker-flip-hint">Tap to flip back</p>';
      html += '</div>';
      html += '</div></div>';
    });
    speakersEl.className = 'speakers-grid';
    speakersEl.innerHTML = html;

    // Add click handlers for flip (CSP blocks inline onclick)
    var cards = speakersEl.querySelectorAll('.speaker-card');
    for (var i = 0; i < cards.length; i++) {
      cards[i].addEventListener('click', function() { this.classList.toggle('flipped'); });
    }
  }

  function renderAgenda(data) {
            if (!data || data.length === 0) {
              agendaEl.innerHTML = '<p>Agenda coming soon.</p>';
              return;
            }

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
                  html += '<th>' + esc(room.name) + '</th>';
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
                html += '<td class="agenda-time-col">' + esc(time) + '</td>';

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
  }

  function renderSession(s) {
    if (!s) return '';
    var h = '<div class="agenda-session">';
    h += '<div class="agenda-session-title">' + esc(s.title) + '</div>';
    if (s.speakers && s.speakers.length) {
      h += '<div class="agenda-session-speakers">' + s.speakers.map(function(sp) { return esc(sp.name); }).join(', ') + '</div>';
    }
    h += '</div>';
    return h;
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

  function esc(str) {
    if (!str) return '';
    var d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }
})();
