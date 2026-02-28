(function() {
  var eventId = '';
  var scanLog = [];
  var totalCheckedIn = 0;
  var totalRegistered = 0;
  var scanner = null;

  document.getElementById('start-scanner-btn').addEventListener('click', function() {
    eventId = document.getElementById('scanner-event-id').value.trim();
    if (!eventId) { alert('Please enter an event ID.'); return; }

    document.getElementById('scanner-wrap').style.display = 'block';
    this.disabled = true;
    this.textContent = 'Scanner Active';

    // Load current stats
    loadStats();

    // Start QR scanner
    try {
      scanner = new Html5Qrcode('reader');
      scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        onScanSuccess,
        function() {} // ignore scan failures
      );
    } catch (err) {
      document.getElementById('reader').innerHTML = '<p>Camera not available. Use manual entry below.</p>';
    }
  });

  document.getElementById('manual-checkin-btn').addEventListener('click', function() {
    var code = document.getElementById('manual-code').value.trim();
    if (code) {
      doCheckIn(code);
      document.getElementById('manual-code').value = '';
    }
  });

  function onScanSuccess(ticketCode) {
    // Debounce — don't scan same code within 5 seconds
    var recent = scanLog.find(function(s) { return s.code === ticketCode && Date.now() - s.time < 5000; });
    if (recent) return;

    if (scanner) scanner.pause(true);
    doCheckIn(ticketCode);
    setTimeout(function() {
      if (scanner) try { scanner.resume(); } catch(e) {}
    }, 2000);
  }

  function doCheckIn(ticketCode) {
    var resultEl = document.getElementById('scan-result');
    resultEl.style.display = 'block';
    resultEl.textContent = 'Checking in...';
    resultEl.style.backgroundColor = '#fff3cd';
    resultEl.style.color = '#856404';

    fetch('/api/checkIn', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ticketCode: ticketCode, eventId: eventId })
    })
    .then(function(r) { return r.json(); })
    .then(function(data) {
      scanLog.unshift({ code: ticketCode, time: Date.now(), result: data.status, name: data.attendeeName || '' });

      if (data.status === 'checked_in') {
        resultEl.style.backgroundColor = '#d4edda'; resultEl.style.color = '#155724';
        resultEl.innerHTML = '✅ <strong>' + esc(data.attendeeName) + '</strong> checked in!';
        totalCheckedIn++;
        document.getElementById('scan-total').textContent = totalCheckedIn;
      } else if (data.status === 'already_checked_in') {
        resultEl.style.backgroundColor = '#fff3cd'; resultEl.style.color = '#856404';
        resultEl.innerHTML = '⚠️ <strong>' + esc(data.attendeeName) + '</strong> already checked in at ' + esc(data.checkedInAt);
      } else {
        resultEl.style.backgroundColor = '#f8d7da'; resultEl.style.color = '#721c24';
        resultEl.innerHTML = '❌ Invalid ticket code';
      }

      renderLog();
    })
    .catch(function() {
      resultEl.style.backgroundColor = '#f8d7da'; resultEl.style.color = '#721c24';
      resultEl.textContent = 'Network error. Please try again.';
    });
  }

  function loadStats() {
    fetch('/api/eventAttendance?eventId=' + encodeURIComponent(eventId))
      .then(function(r) { return r.json(); })
      .then(function(data) {
        totalRegistered = data.total || 0;
        totalCheckedIn = data.checkedIn || 0;
        document.getElementById('scan-total').textContent = totalCheckedIn;
        document.getElementById('scan-registered').textContent = totalRegistered;
      })
      .catch(function() {
        document.getElementById('scan-total').textContent = '?';
        document.getElementById('scan-registered').textContent = '?';
      });
  }

  function renderLog() {
    var html = '';
    scanLog.slice(0, 20).forEach(function(s) {
      var icon = s.result === 'checked_in' ? '✅' : s.result === 'already_checked_in' ? '⚠️' : '❌';
      html += '<p style="margin:0.25rem 0;">' + icon + ' <strong>' + esc(s.name || s.code) + '</strong> <span style="color:#999;font-size:0.8rem;">' + new Date(s.time).toLocaleTimeString() + '</span></p>';
    });
    document.getElementById('scan-log').innerHTML = html;
  }

  function esc(str) {
    if (!str) return '';
    var d = document.createElement('span');
    d.textContent = str;
    return d.innerHTML;
  }
})();
