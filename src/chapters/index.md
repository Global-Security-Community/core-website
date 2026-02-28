---
layout: base.njk
title: Chapters
---

<div class="container">
  <h1>Global Chapters</h1>

  <p>Our chapters are the foundation of the Global Security Community. Find your local chapter or start one in your city.</p>

  {% if collections.chapter and collections.chapter.length > 0 %}
  <div class="cards">
    {% for chapter in collections.chapter %}
    <a href="{{ chapter.url }}" class="card" style="text-decoration: none; color: inherit;">
      <h3 style="margin-top: 0;">📍 {{ chapter.data.city }}, {{ chapter.data.country }}</h3>
      <p>{{ chapter.data.leads.length }} Chapter Lead{% if chapter.data.leads.length > 1 %}s{% endif %}</p>
    </a>
    {% endfor %}
  </div>
  {% else %}
  <p>We're currently building our global chapter network. Our first chapters are launching soon.</p>
  {% endif %}

  <h2>Interested in Starting a Chapter?</h2>
  <p>If you're passionate about building a security community in your city, we'd love to hear from you. We provide resources, guidance, and support to help your chapter thrive.</p>
  <p style="margin-top: 1.5rem;">
    <a href="/chapters/apply/" style="display: inline-block; background-color: var(--color-primary-teal); color: white; padding: 0.75rem 1.5rem; border-radius: 4px; font-weight: 600; text-decoration: none; transition: background-color 0.3s ease;">Apply to Lead a Chapter</a>
  </p>
</div>