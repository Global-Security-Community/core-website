---
layout: base.njk
title: Check-in Scanner
---

<div class="container">
  <h1>Check-in Scanner</h1>

  <div class="form-group scanner-setup">
    <label for="scanner-event-id">Event ID *</label>
    <input type="text" id="scanner-event-id" placeholder="Paste the event ID from your dashboard">
    <button id="start-scanner-btn" type="button" class="btn-start-scanner">Start Scanner</button>
  </div>

  <div id="scanner-wrap" style="display:none;">
    <div class="stat-cards">
      <div class="card stat-card">
        <p class="stat-number" id="scan-total">0</p>
        <p class="stat-label">Checked In</p>
      </div>
      <div class="card stat-card">
        <p class="stat-number" id="scan-registered">0</p>
        <p class="stat-label">Registered</p>
      </div>
    </div>

    <div id="scan-result" class="scan-result" style="display:none;" aria-live="polite"></div>

    <div id="reader" class="qr-reader" aria-label="QR code scanner viewfinder"></div>

    <div class="manual-entry">
      <h3>Manual Entry</h3>
      <div class="manual-entry-form">
        <input type="text" id="manual-code" placeholder="Ticket code">
        <button id="manual-checkin-btn" type="button">Check In</button>
      </div>
    </div>

    <h3 class="scan-log-title">Recent Scans</h3>
    <div id="scan-log" aria-live="polite"></div>
  </div>
</div>

<script src="https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js" integrity="sha384-c9d8RFSL+u3exBOJ4Yp3HUJXS4znl9f+z66d1y54ig+ea249SpqR+w1wyvXz/lk+" crossorigin="anonymous"></script>
<script src="/js/scanner.js"></script>
