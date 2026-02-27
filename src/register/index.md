---
layout: base.njk
title: Register for Event
---

<div class="container">
  <h1>Register for Event</h1>
  <div id="event-info"><p>Loading event details...</p></div>

  <div id="reg-form-wrap" style="display:none; max-width:600px; margin-top:2rem;">
    <div id="reg-message" style="display:none; margin-bottom:1rem; padding:1rem; border-radius:4px;"></div>
    <form id="reg-form">
      <h2>Your Details</h2>
      <div class="form-group">
        <label for="reg-name">Full Name *</label>
        <input type="text" id="reg-name" required maxlength="100">
      </div>
      <div class="form-group">
        <label for="reg-email">Email *</label>
        <input type="email" id="reg-email" required>
      </div>

      <h2>About You <span style="font-weight:normal; font-size:0.8em; color:#666;">(helps us understand our community)</span></h2>
      <div class="form-group">
        <label for="reg-employment">Employment Status</label>
        <select id="reg-employment" style="width:100%;padding:0.75rem;border:1px solid var(--color-border);border-radius:4px;font-size:1rem;">
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
        <select id="reg-industry" style="width:100%;padding:0.75rem;border:1px solid var(--color-border);border-radius:4px;font-size:1rem;">
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
        <label for="reg-company-size">Company Size</label>
        <select id="reg-company-size" style="width:100%;padding:0.75rem;border:1px solid var(--color-border);border-radius:4px;font-size:1rem;">
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
        <select id="reg-experience" style="width:100%;padding:0.75rem;border:1px solid var(--color-border);border-radius:4px;font-size:1rem;">
          <option value="">Prefer not to say</option>
          <option value="Student">Student</option>
          <option value="Junior">Junior (0-2 years)</option>
          <option value="Mid">Mid (3-5 years)</option>
          <option value="Senior">Senior (6-10 years)</option>
          <option value="Executive">Executive / Leadership (10+ years)</option>
        </select>
      </div>

      <button type="submit">Register</button>
    </form>
  </div>

  <!-- Success state -->
  <div id="reg-success" style="display:none; text-align:center; margin-top:2rem;">
    <h2 style="color:var(--color-primary-teal);">You're Registered! 🎉</h2>
    <p id="success-details"></p>
    <div id="success-qr" style="margin:1rem 0;"></div>
    <p>A confirmation email with your ticket has been sent.</p>
    <p><a href="/my-tickets/">View My Tickets</a></p>
  </div>
</div>

<script src="/js/register.js"></script>
