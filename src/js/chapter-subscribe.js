(function() {
  var card = document.getElementById('subscribe-card');
  if (!card) return;

  var chapterSlug = card.getAttribute('data-chapter-slug');
  var btn = document.getElementById('btn-subscribe');
  var msg = document.getElementById('subscribe-msg');
  var loginHint = document.getElementById('subscribe-login-hint');

  // Check if user is logged in
  fetch('/.auth/me')
    .then(function(r) { return r.json(); })
    .then(function(data) {
      var principal = data.clientPrincipal;
      if (!principal) return;

      // User is logged in — show subscribe button, hide login hint
      loginHint.style.display = 'none';
      btn.style.display = 'inline-block';

      // Check current subscription status
      fetch('/api/chapterSubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chapterSlug: chapterSlug, action: 'status' })
      })
        .then(function(r) { return r.json(); })
        .then(function(res) {
          updateButton(res.subscribed);
        })
        .catch(function() { updateButton(false); });
    })
    .catch(function() { /* not logged in */ });

  function updateButton(subscribed) {
    if (subscribed) {
      btn.textContent = '';
      btn.innerHTML = '<span class="icon" aria-hidden="true">' + GSCIcons.checkCircle + '</span> Subscribed — Unsubscribe';
      btn.className = 'btn-secondary';
      msg.textContent = 'You will be notified when new events are announced.';
    } else {
      btn.textContent = '';
      btn.innerHTML = '<span class="icon" aria-hidden="true">' + GSCIcons.bell + '</span> Subscribe to Event Notifications';
      btn.className = '';
      msg.textContent = 'Get an email when new events are announced for this chapter.';
    }
    btn.dataset.subscribed = subscribed ? 'true' : 'false';
  }

  btn.addEventListener('click', function() {
    var isSubscribed = btn.dataset.subscribed === 'true';
    var action = isSubscribed ? 'unsubscribe' : 'subscribe';
    btn.disabled = true;
    btn.textContent = isSubscribed ? 'Unsubscribing...' : 'Subscribing...';

    fetch('/api/chapterSubscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chapterSlug: chapterSlug, action: action })
    })
      .then(function(r) { return r.json(); })
      .then(function(res) {
        btn.disabled = false;
        if (res.success !== undefined) {
          updateButton(res.subscribed);
        } else {
          btn.textContent = '';
          btn.innerHTML = '<span class="icon" aria-hidden="true">' + GSCIcons.xCircle + '</span> Error — try again';
        }
      })
      .catch(function() {
        btn.disabled = false;
        btn.textContent = '';
        btn.innerHTML = '<span class="icon" aria-hidden="true">' + GSCIcons.xCircle + '</span> Error — try again';
      });
  });
})();
