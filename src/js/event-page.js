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
        if (el && data.registrationCap > 0) {
          el.textContent = data.registrationCount + ' / ' + data.registrationCap + ' registered';
        } else if (el) {
          el.textContent = data.registrationCount + ' registered';
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
      })
      .catch(function() {});
  }

  // Sessionize integration
  var agendaEl = document.getElementById('sessionize-agenda');
  var speakersEl = document.getElementById('sessionize-speakers');

  if (agendaEl || speakersEl) {
    // Find sessionize API ID from the page (we embed it as a data attribute)
    var sessionizeId = '';
    var metaEl = document.querySelector('[data-sessionize-id]');
    if (metaEl) sessionizeId = metaEl.getAttribute('data-sessionize-id');

    if (sessionizeId) {
      // Fetch agenda (GridSmart view) — use timeSlots for grid layout
      if (agendaEl) {
        fetch('https://sessionize.com/api/v2/' + sessionizeId + '/view/GridSmart')
          .then(function(r) { return r.json(); })
          .then(function(data) {
            if (!data || data.length === 0) {
              agendaEl.innerHTML = '<p>Agenda coming soon.</p>';
              return;
            }

            var html = '';
            data.forEach(function(day) {
              var slots = day.timeSlots || [];
              if (!slots.length) return;

              // Collect unique room names in order
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

              // Table header with room columns
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

                // Check if this is a plenum (same session in all rooms)
                var firstSession = (slot.rooms && slot.rooms.length) ? slot.rooms[0].session : null;
                var isPlenum = firstSession && firstSession.isPlenumSession;

                html += '<tr class="' + (firstSession && firstSession.isServiceSession ? 'agenda-row-service' : 'agenda-row-session') + '">';
                html += '<td class="agenda-time-col">' + esc(time) + '</td>';

                if (isPlenum || !multiRoom) {
                  // Span all room columns
                  var s = firstSession;
                  var colspan = multiRoom ? ' colspan="' + roomNames.length + '"' : '';
                  html += '<td' + colspan + '>';
                  html += renderSession(s);
                  html += '</td>';
                } else {
                  // One cell per room
                  roomNames.forEach(function(room) {
                    var s = roomMap[room.id];
                    html += '<td>';
                    if (s) {
                      html += renderSession(s);
                    }
                    html += '</td>';
                  });
                }

                html += '</tr>';
              });

              html += '</tbody></table></div>';
            });

            agendaEl.innerHTML = html;
          })
          .catch(function() { agendaEl.innerHTML = '<p>Could not load agenda.</p>'; });
      }

      // Fetch speakers
      if (speakersEl) {
        fetch('https://sessionize.com/api/v2/' + sessionizeId + '/view/Speakers')
          .then(function(r) { return r.json(); })
          .then(function(speakers) {
            if (!speakers || speakers.length === 0) {
              speakersEl.innerHTML = '<p>Speakers to be announced.</p>';
              return;
            }
            var html = '';
            speakers.forEach(function(s) {
              html += '<div class="card" style="text-align:center;">';
              if (s.profilePicture && (s.profilePicture.indexOf('https://') === 0)) {
                html += '<img src="' + esc(s.profilePicture) + '" alt="' + esc(s.fullName) + '" style="width:80px;height:80px;border-radius:50%;margin-bottom:0.5rem;">';
              }
              html += '<h4 style="margin:0 0 0.25rem 0;">' + esc(s.fullName) + '</h4>';
              if (s.tagLine) html += '<p style="color:#666;margin:0;font-size:0.9rem;">' + esc(s.tagLine) + '</p>';
              html += '</div>';
            });
            speakersEl.innerHTML = html;
          })
          .catch(function() { speakersEl.innerHTML = '<p>Could not load speakers.</p>'; });
      }
    }
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
