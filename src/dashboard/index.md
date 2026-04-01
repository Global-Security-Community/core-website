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
    <button id="btn-chapter" class="btn-outline">Edit Chapter</button>
  </div>

  <!-- Events List -->
  <div id="section-events">
    <h2>Your Events</h2>
    <div id="events-list" aria-live="polite"><p>Loading events...</p></div>
  </div>

  <!-- Create Event Form -->
  <div id="section-create" class="is-hidden">
    <h2>Create New Event</h2>
    <div id="create-message" class="form-message is-hidden" role="alert"></div>
    <div id="create-form-wrap" class="reg-form-wrap">
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
      <div class="form-group two-col-grid">
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
    <div id="create-progress" class="pipeline-progress is-hidden">
      <h3 id="create-progress-title"></h3>
      <ul class="pipeline-steps">
        <li id="step-stored" class="pipeline-step pending">
          <span class="step-icon"><span class="icon" aria-hidden="true"><svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 22h14"/><path d="M5 2h14"/><path d="M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22"/><path d="M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2"/></svg></span></span>
          <span class="step-label">Event saved to database</span>
        </li>
        <li id="step-page" class="pipeline-step pending">
          <span class="step-icon"><span class="icon" aria-hidden="true"><svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 22h14"/><path d="M5 2h14"/><path d="M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22"/><path d="M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2"/></svg></span></span>
          <span class="step-label">Event page generation triggered</span>
        </li>
        <li id="step-live" class="pipeline-step pending">
          <span class="step-icon"><span class="icon" aria-hidden="true"><svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 22h14"/><path d="M5 2h14"/><path d="M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22"/><path d="M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2"/></svg></span></span>
          <span class="step-label">Event page deployed &amp; live</span>
        </li>
      </ul>
      <p class="pipeline-note">Page generation typically takes 1–2 minutes. You can navigate away — the pipeline will continue in the background.</p>
      <a id="create-progress-link" href="#" class="btn is-hidden" style="margin-top:1rem;">View Event Page →</a>
      <button id="create-another-btn" type="button" class="is-hidden" style="margin-top:0.5rem;">Create Another Event</button>
    </div>
  </div>

  <!-- Event Detail (attendance) -->
  <div id="section-detail" class="is-hidden">
    <div class="detail-actions">
      <button id="btn-back-events" class="btn-outline">&larr; Back to Events</button>
      <button id="btn-edit-event" class="btn-outline" style="margin-left:0.5rem;"><span class="icon" aria-hidden="true"><svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg></span> Edit Event</button>
    </div>
    <h2 id="detail-title">Event Details</h2>
    <p id="detail-subtitle" class="subtitle-muted"></p>
    <div id="detail-panel" class="detail-panel"></div>
    <div id="detail-actions" class="detail-actions"></div>
    <h3>Register Attendee</h3>
    <p class="text-muted">Manually register someone for this event. Speaker, sponsor, and organiser roles bypass capacity limits.</p>
    <div class="volunteer-add-form">
      <input type="text" id="admin-reg-name" placeholder="Name">
      <input type="email" id="admin-reg-email" placeholder="Email">
      <select id="admin-reg-role">
        <option value="attendee">Attendee</option>
        <option value="volunteer">Volunteer</option>
        <option value="speaker">Speaker</option>
        <option value="sponsor">Sponsor</option>
        <option value="organiser">Organiser</option>
      </select>
      <button id="admin-reg-btn" type="button">Register</button>
    </div>
    <h3>Attendees</h3>
    <div id="role-action-bar" class="role-action-bar is-hidden">
      <span id="role-selected-count">0 selected</span>
      <select id="role-select">
        <option value="">Set Role...</option>
        <option value="attendee">Attendee</option>
        <option value="volunteer">Volunteer</option>
        <option value="speaker">Speaker</option>
        <option value="sponsor">Sponsor</option>
        <option value="organiser">Organiser</option>
      </select>
      <button id="role-apply-btn" type="button">Apply</button>
    </div>
    <div id="detail-attendees"></div>
  </div>

  <!-- Edit Event -->
  <div id="section-edit-event" class="is-hidden">
    <div class="detail-actions">
      <button id="btn-back-detail" class="btn-outline">&larr; Back to Event</button>
    </div>
    <h2>Edit Event</h2>
    <div id="edit-event-message" class="form-message is-hidden" role="alert"></div>
    <div id="edit-event-form" class="reg-form-wrap">
      <div class="form-group">
        <label for="edit-title">Event Title *</label>
        <input type="text" id="edit-title" maxlength="200">
      </div>
      <div class="form-group">
        <label for="edit-date">Start Date *</label>
        <input type="date" id="edit-date">
      </div>
      <div class="form-group">
        <label for="edit-enddate">End Date</label>
        <input type="date" id="edit-enddate">
      </div>
      <div class="form-group">
        <label for="edit-building">Building / Venue Name</label>
        <input type="text" id="edit-building" maxlength="200">
      </div>
      <div class="form-group">
        <label for="edit-address1">Address Line 1 *</label>
        <input type="text" id="edit-address1" maxlength="200">
      </div>
      <div class="form-group">
        <label for="edit-address2">Address Line 2</label>
        <input type="text" id="edit-address2" maxlength="200">
      </div>
      <div class="form-group two-col-grid">
        <div>
          <label for="edit-city">City *</label>
          <input type="text" id="edit-city" maxlength="100">
        </div>
        <div>
          <label for="edit-state">State</label>
          <input type="text" id="edit-state" maxlength="100">
        </div>
      </div>
      <div class="form-group">
        <label for="edit-description">Description *</label>
        <textarea id="edit-description" rows="5" maxlength="5000"></textarea>
      </div>
      <div class="form-group">
        <label for="edit-sessionize">Sessionize API ID</label>
        <input type="text" id="edit-sessionize">
      </div>
      <div class="form-group">
        <label for="edit-cap">Registration Cap (0 = unlimited)</label>
        <input type="number" id="edit-cap" value="0" min="0">
      </div>
      <button id="edit-save-btn" type="button">Save Changes</button>
    </div>
  </div>

  <!-- Edit Chapter -->
  <div id="section-chapter" class="is-hidden">
    <h2>Edit Chapter</h2>
    <div id="chapter-edit-message" class="form-message is-hidden" role="alert"></div>
    <div id="chapter-edit-form" class="reg-form-wrap">
      <p>Loading chapter data...</p>
    </div>
  </div>
</div>

<script src="/js/dashboard.js?v={{ cacheBust }}"></script>
