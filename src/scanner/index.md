---
layout: base.njk
title: Check-in Scanner
---

<div class="container">
  <h1>Check-in Scanner</h1>

  <div class="form-group" style="max-width:400px;">
    <label for="scanner-event-id">Event ID *</label>
    <input type="text" id="scanner-event-id" placeholder="Paste the event ID from your dashboard">
    <button id="start-scanner-btn" type="button" style="margin-top:0.5rem;">Start Scanner</button>
  </div>

  <div id="scanner-wrap" style="display:none;">
    <div style="display:flex; gap:1rem; margin-bottom:1rem; flex-wrap:wrap;">
      <div class="card" style="text-align:center; flex:1; min-width:120px;">
        <p style="font-size:2rem; margin:0;" id="scan-total">0</p>
        <p style="margin:0;">Checked In</p>
      </div>
      <div class="card" style="text-align:center; flex:1; min-width:120px;">
        <p style="font-size:2rem; margin:0;" id="scan-registered">0</p>
        <p style="margin:0;">Registered</p>
      </div>
    </div>

    <div id="scan-result" style="display:none; padding:1rem; border-radius:8px; margin-bottom:1rem; text-align:center; font-size:1.2rem;"></div>

    <div id="reader" style="max-width:400px; margin:0 auto;"></div>

    <div style="margin-top:1rem;">
      <h3>Manual Entry</h3>
      <div style="display:flex; gap:0.5rem;">
        <input type="text" id="manual-code" placeholder="Ticket code" style="flex:1;">
        <button id="manual-checkin-btn" type="button">Check In</button>
      </div>
    </div>

    <h3 style="margin-top:2rem;">Recent Scans</h3>
    <div id="scan-log"></div>
  </div>
</div>

<script src="https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js"></script>
<script src="/js/scanner.js"></script>
