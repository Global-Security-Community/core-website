---
layout: base.njk
title: Dashboard
---

<div class="container">
  <h1 id="dash-title">Chapter Lead Dashboard</h1>
  <p id="dash-user" aria-live="polite">Loading...</p>

  <div class="dash-actions">
    <button id="btn-events">My Events</button>
    <button id="btn-create" class="btn-navy">Create Event</button>
  </div>

  <!-- Events List -->
  <div id="section-events">
    <h2>Your Events</h2>
    <div id="events-list" aria-live="polite"><p>Loading events...</p></div>
  </div>

  <!-- Create Event Form -->
  <div id="section-create" style="display:none;">
    <h2>Create New Event</h2>
    <div id="create-message" class="form-message" style="display:none;"></div>
    <div class="reg-form-wrap">
      <div class="form-group">
        <label for="ev-title">Event Title *</label>
        <input type="text" id="ev-title" maxlength="200" placeholder="e.g. Global Security Bootcamp Perth 2026">
      </div>
      <div class="form-group">
        <label for="ev-date">Start Date *</label>
        <input type="date" id="ev-date">
      </div>
      <div class="form-group">
        <label for="ev-enddate">End Date</label>
        <input type="date" id="ev-enddate">
      </div>
      <div class="form-group">
        <label for="ev-building">Building / Venue Name</label>
        <input type="text" id="ev-building" maxlength="200" placeholder="e.g. Microsoft Office">
      </div>
      <div class="form-group">
        <label for="ev-address1">Address Line 1 *</label>
        <input type="text" id="ev-address1" maxlength="200" placeholder="e.g. 10/100 St Georges Terrace">
      </div>
      <div class="form-group">
        <label for="ev-address2">Address Line 2</label>
        <input type="text" id="ev-address2" maxlength="200" placeholder="">
      </div>
      <div class="form-group" style="display:grid; grid-template-columns:1fr 1fr; gap:1rem;">
        <div>
          <label for="ev-city">City *</label>
          <input type="text" id="ev-city" maxlength="100" placeholder="e.g. Perth">
        </div>
        <div>
          <label for="ev-state">State</label>
          <input type="text" id="ev-state" maxlength="100" placeholder="e.g. WA">
        </div>
      </div>
      <div class="form-group">
        <label for="ev-description">Description *</label>
        <textarea id="ev-description" rows="5" maxlength="5000" placeholder="Describe the event..."></textarea>
      </div>
      <div class="form-group">
        <label for="ev-sessionize">Sessionize API ID</label>
        <input type="text" id="ev-sessionize" placeholder="e.g. abc123 (from your Sessionize event URL)">
      </div>
      <div class="form-group">
        <label for="ev-cap">Registration Cap (0 = unlimited)</label>
        <input type="number" id="ev-cap" value="0" min="0">
      </div>
      <div class="form-group">
        <label for="ev-chapter">Chapter Slug *</label>
        <input type="text" id="ev-chapter" placeholder="e.g. perth">
      </div>
      <button id="create-btn" type="button">Create Event</button>
    </div>
  </div>

  <!-- Event Detail (attendance) -->
  <div id="section-detail" style="display:none;">
    <div class="detail-actions">
      <button id="btn-back-events" class="btn-outline">&larr; Back to Events</button>
    </div>
    <h2 id="detail-title">Event Details</h2>
    <div id="detail-stats" class="stat-cards"></div>
    <div id="detail-actions" class="detail-actions"></div>
    <h3>Volunteers / Committee</h3>
    <p class="text-muted">Volunteers can access the check-in scanner for this event. They must have a GSC account.</p>
    <div class="volunteer-add-form">
      <input type="text" id="vol-name" placeholder="Name">
      <input type="email" id="vol-email" placeholder="Email">
      <button id="vol-add-btn" type="button">Add Volunteer</button>
    </div>
    <div id="volunteer-list"></div>
    <h3>Attendees</h3>
    <div id="detail-attendees"></div>
  </div>
</div>

<script src="/js/dashboard.js"></script>
