---
layout: base.njk
title: Chapters
description: "Find your local Global Security Community chapter. Connect with cybersecurity professionals in your city."
---

<div class="container">
  <h1>Global Chapters</h1>

  <p>Our chapters are the foundation of the Global Security Community. Find your local chapter or start one in your city.</p>

  {% if collections.chapter and collections.chapter.length > 0 %}
  <div class="chapter-grid">
    {%- for chapter in collections.chapter | sort(false, false, "data.city") %}
    <a href="{{ chapter.url }}" class="chapter-card">
      <div class="chapter-card-banner">
        <img src="/assets/GSC-Shield-Transparent.png" 
             alt="{{ chapter.data.city }} Chapter" class="chapter-card-logo">
      </div>
      <div class="chapter-card-body">
        <span class="chapter-card-badge">Official Chapter</span>
        <h3 class="chapter-card-title">Global Security Community {{ chapter.data.city }}</h3>
        <p class="chapter-card-location"><span class="icon" aria-hidden="true"><svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg></span> {{ chapter.data.city }} / {{ chapter.data.country }}</p>
      </div>
      <div class="chapter-card-footer">
        <span class="chapter-card-btn">View Chapter</span>
      </div>
    </a>
    {%- endfor %}
  </div>
  {% else %}
  <p>We're currently building our global chapter network. Our first chapters are launching soon.</p>
  {% endif %}

  <h2>Interested in Starting a Chapter?</h2>
  <p>If you're passionate about building a security community in your city, we'd love to hear from you. We provide resources, guidance, and support to help your chapter thrive.</p>
  <p class="mt-section">
    <a href="/chapters/apply/" class="btn-cta">Apply to Lead a Chapter</a>
  </p>
</div>