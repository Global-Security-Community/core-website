---
layout: base.njk
title: Register for Event
description: "Register for a Global Security Community event. Join cybersecurity professionals for workshops, talks, and networking."
---

<div class="container">
  <h1>Register for Event</h1>
  <div id="event-info"><p>Loading event details...</p></div>

  <div id="reg-form-wrap" class="reg-form-wrap is-hidden">
    <div id="reg-message" class="form-message is-hidden" role="alert"></div>
    <form id="reg-form">
      <h2>Your Details</h2>
      <div class="form-group">
        <label for="reg-name">Full Name *</label>
        <input type="text" id="reg-name" required aria-required="true" maxlength="100">
      </div>
      <div class="form-group">
        <label for="reg-email">Email *</label>
        <input type="email" id="reg-email" required aria-required="true">
      </div>

      <h2>About You <span class="form-hint">(helps us understand our community)</span></h2>
      <div class="form-group">
        <label for="reg-employment">Employment Status</label>
        <select id="reg-employment">
          <option value="">Prefer not to say</option>
          <option value="Employed">Employed</option>
          <option value="Self-employed">Self-employed</option>
          <option value="Student">Student</option>
          <option value="Unemployed">Unemployed</option>
          <option value="Other">Other</option>
        </select>
      </div>
      <div class="form-group">
        <label for="reg-industry">Industry</label>
        <select id="reg-industry">
          <option value="">Prefer not to say</option>
          <option value="Technology">Technology</option>
          <option value="Finance">Finance / Banking</option>
          <option value="Healthcare">Healthcare</option>
          <option value="Government">Government / Public Sector</option>
          <option value="Education">Education</option>
          <option value="Consulting">Consulting</option>
          <option value="Defence">Defence / Military</option>
          <option value="Retail">Retail / E-commerce</option>
          <option value="Telecommunications">Telecommunications</option>
          <option value="Energy">Energy / Utilities</option>
          <option value="Other">Other</option>
        </select>
      </div>
      <div class="form-group">
        <label for="reg-jobtitle">Job Title</label>
        <input type="text" id="reg-jobtitle" maxlength="100" placeholder="e.g. Security Analyst">
      </div>
      <div class="form-group">
        <label for="reg-company">Company / Organisation</label>
        <input type="text" id="reg-company" maxlength="100" placeholder="e.g. Microsoft">
      </div>
      <div class="form-group">
        <label for="reg-company-size">Company Size</label>
        <select id="reg-company-size">
          <option value="">Prefer not to say</option>
          <option value="1-10">1-10</option>
          <option value="11-50">11-50</option>
          <option value="51-200">51-200</option>
          <option value="201-1000">201-1000</option>
          <option value="1000+">1000+</option>
        </select>
      </div>
      <div class="form-group">
        <label for="reg-experience">Experience Level</label>
        <select id="reg-experience">
          <option value="">Prefer not to say</option>
          <option value="Student">Student</option>
          <option value="Junior">Junior (0-2 years)</option>
          <option value="Mid">Mid (3-5 years)</option>
          <option value="Senior">Senior (6-10 years)</option>
          <option value="Executive">Executive / Leadership (10+ years)</option>
        </select>
      </div>

      <div class="form-group mt-section">
        <label class="checkbox-label">
          <input type="checkbox" id="reg-volunteer-interest">
          I'd like to volunteer at this event
        </label>
      </div>

      <div id="volunteer-confirm" class="volunteer-confirm-box is-hidden">
        <p class="volunteer-thanks"><span class="icon" aria-hidden="true"><svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg></span> Thank you for offering to help — our events wouldn't be possible without volunteers like you!</p>
        <p class="volunteer-note">Please note that volunteer places are limited and not all who apply can be selected. If you're unsure whether volunteering is right for you, please speak to a chapter lead before committing.</p>
        <label class="checkbox-label">
          <input type="checkbox" id="reg-volunteer-confirm">
          I confirm I am available for the full duration of the event and would like to be considered as a volunteer
        </label>
      </div>

      <div class="form-group">
        <div class="cf-turnstile" data-sitekey="{{ turnstileSiteKey }}"></div>
      </div>

      <button type="submit">Register</button>
    </form>
  </div>

  <!-- Success state -->
  <div id="reg-success" class="reg-success is-hidden">
    <h2 class="success-title">You're Registered! <span class="icon" aria-hidden="true"><svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5.8 11.3 2 22l10.7-3.79"/><path d="M4 3h.01"/><path d="M22 8h.01"/><path d="M15 2h.01"/><path d="M22 20h.01"/><path d="m22 2-2.24.75a2.9 2.9 0 0 0-1.96 3.12v0c.1.86-.57 1.63-1.45 1.63h-.38c-.86 0-1.6.6-1.76 1.44L14 10"/><path d="m22 13-.82-.33c-.86-.34-1.82.2-1.98 1.11v0c-.11.7-.72 1.22-1.43 1.22H17"/><path d="m11 2 .33.82c.34.86-.2 1.82-1.11 1.98v0C9.52 4.9 9 5.52 9 6.23V7"/><path d="M11 13c1.93 1.93 2.83 4.17 2 5-.83.83-3.07-.07-5-2-1.93-1.93-2.83-4.17-2-5 .83-.83 3.07.07 5 2Z"/></svg></span></h2>
    <p id="success-details"></p>
    <div id="success-qr" class="success-qr"></div>
    <div id="success-email-status"></div>
    <p><a href="/my-tickets/">View My Tickets</a></p>
  </div>
</div>

<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>
<script src="/js/register.js?v={{ cacheBust }}"></script>
