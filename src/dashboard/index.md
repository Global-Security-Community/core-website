---
layout: base.njk
title: Dashboard
---

<div class="container">
  <h1>Chapter Lead Dashboard</h1>
  <p id="dash-user">Loading...</p>

  <div style="display:flex; gap:1rem; margin-bottom:2rem; flex-wrap:wrap;">
    <button onclick="showSection('events')" id="btn-events" style="background-color:var(--color-primary-teal);">My Events</button>
    <button onclick="showSection('create')" id="btn-create" style="background-color:var(--color-primary-navy);">Create Event</button>
  </div>

  <!-- Events List -->
  <div id="section-events">
    <h2>Your Events</h2>
    <div id="events-list"><p>Loading events...</p></div>
  </div>

  <!-- Create Event Form -->
  <div id="section-create" style="display:none;">
    <h2>Create New Event</h2>
    <div id="create-message" style="display:none; margin-bottom:1rem; padding:1rem; border-radius:4px;"></div>
    <div style="max-width:600px;">
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
        <label for="ev-location">Location *</label>
        <input type="text" id="ev-location" maxlength="300" placeholder="Venue name, City">
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
    <div style="margin-bottom:1rem;">
      <button onclick="showSection('events')" style="background:none; color:var(--color-primary-teal); border:1px solid var(--color-primary-teal);">&larr; Back to Events</button>
    </div>
    <h2 id="detail-title">Event Details</h2>
    <div id="detail-stats" style="display:flex; gap:1rem; margin-bottom:1rem;"></div>
    <div id="detail-actions" style="margin-bottom:1rem;"></div>
    <h3>Attendees</h3>
    <div id="detail-attendees"></div>
  </div>
</div>

<script src="/js/dashboard.js"></script>
