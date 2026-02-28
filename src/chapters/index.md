---
layout: base.njk
title: Chapters
---

<div class="container">
  <h1>Global Chapters</h1>

  <p>Our chapters are the foundation of the Global Security Community. Find your local chapter or start one in your city.</p>

  {% if collections.chapter and collections.chapter.length > 0 %}
  <div class="chapter-grid">
    {% for chapter in collections.chapter | sort(false, false, "data.city") %}
    <a href="{{ chapter.url }}" class="chapter-tile">
      <h3>{{ chapter.data.city }}</h3>
      <p>{{ chapter.data.country }}</p>
    </a>
    {% endfor %}
  </div>
  {% else %}
  <p>We're currently building our global chapter network. Our first chapters are launching soon.</p>
  {% endif %}

  <h2>Interested in Starting a Chapter?</h2>
  <p>If you're passionate about building a security community in your city, we'd love to hear from you. We provide resources, guidance, and support to help your chapter thrive.</p>
  <p style="margin-top: 1.5rem;">
    <a href="/chapters/apply/" class="btn-navy" style="display: inline-block; padding: 0.75rem 1.5rem; border-radius: 4px; text-decoration: none;">Apply to Lead a Chapter</a>
  </p>
</div>