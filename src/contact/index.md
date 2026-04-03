---
layout: base.njk
title: Contact Us
description: "Get in touch with the Global Security Community. Ask questions, suggest partnerships, or apply to start a chapter."
---

<div class="container">
  <h1>Contact Us</h1>

  <p>Have questions, want to start a chapter, or interested in partnering with us? We'd love to hear from you.</p>

  <div class="narrow-content">
    <div id="form-message" role="alert" class="form-message is-hidden"></div>
    <form id="contact-form">
      <div class="form-group">
        <label for="name">Name *</label>
        <input type="text" id="name" name="name" required aria-required="true">
      </div>

      <div class="form-group">
        <label for="email">Email *</label>
        <input type="email" id="email" name="email" required aria-required="true">
      </div>

      <div class="form-group">
        <label for="subject">Subject *</label>
        <input type="text" id="subject" name="subject" required aria-required="true">
      </div>

      <div class="form-group">
        <label for="message">Message *</label>
        <textarea id="message" name="message" rows="5" required aria-required="true"></textarea>
      </div>

      <div class="form-group">
        <div class="cf-turnstile" data-sitekey="{{ turnstileSiteKey }}"></div>
      </div>

      <button type="submit">Send Message</button>
    </form>
  </div>

<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>
<script src="/js/contact-form.js?v={{ cacheBust }}"></script>
</div>
