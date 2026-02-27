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
      // Fetch agenda (GridSmart view)
      if (agendaEl) {
        fetch('https://sessionize.com/api/v2/' + sessionizeId + '/view/GridSmart')
          .then(function(r) { return r.json(); })
          .then(function(data) {
            if (!data || data.length === 0) {
              agendaEl.innerHTML = '<p>Agenda coming soon.</p>';
              return;
            }
            var html = '';
            data.forEach(function(room) {
              html += '<h3>' + esc(room.name || 'Main') + '</h3>';
              html += '<div class="cards" style="grid-template-columns: 1fr;">';
              (room.sessions || []).forEach(function(session) {
                var time = session.startsAt ? new Date(session.startsAt).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}) : '';
                html += '<div class="card"><p style="color:var(--color-primary-teal);font-weight:600;margin:0 0 0.25rem 0;">' + esc(time) + '</p>';
                html += '<h4 style="margin:0 0 0.5rem 0;">' + esc(session.title) + '</h4>';
                if (session.speakers && session.speakers.length) {
                  html += '<p style="color:#666;margin:0;">' + session.speakers.map(function(s) { return esc(s.name); }).join(', ') + '</p>';
                }
                html += '</div>';
              });
              html += '</div>';
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
              if (s.profilePicture) {
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

  function esc(str) {
    if (!str) return '';
    var d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }
})();
