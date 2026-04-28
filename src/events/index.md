---
layout: base.njk
title: Events
description: "Browse upcoming and past Global Security Community events — workshops, bootcamps, and networking for cybersecurity professionals."
---

<div class="container">
  <h1>Events</h1>

  <p>Join us at upcoming events where security professionals gather to learn, network, and share insights.</p>

  <div id="events-list">
    {% set upcoming = [] %}
    {% set past = [] %}
    {% for event in events %}
      {% set eventDateStr = event.date %}
      {% if eventDateStr %}
        {% set eventTs = eventDateStr | dateToMs %}
        {% set nowTs = "" | nowMs %}
        {% if eventTs >= nowTs %}
          {% set upcoming = (upcoming.push(event), upcoming) %}
        {% else %}
          {% set past = (past.push(event), past) %}
        {% endif %}
      {% else %}
        {% set upcoming = (upcoming.push(event), upcoming) %}
      {% endif %}
    {% endfor %}

    {% if upcoming.length > 0 %}
    <div class="events-grid">
      {% for e in upcoming %}
      <a href="/events/{{ e.slug }}/" class="event-card">
        <div class="event-card-header">
          <div class="event-card-date"><span class="icon" aria-hidden="true"><svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg></span> {{ e.date }}</div>
          <h3 class="event-card-title">{{ e.title }}</h3>
        </div>
        <div class="event-card-body">
          <div class="event-card-location"><span class="icon" aria-hidden="true"><svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 1118 0z"/><circle cx="12" cy="10" r="3"/></svg></span> {{ e.location }}</div>
        </div>
        <div class="event-card-footer">
          <span class="event-card-btn">View Event →</span>
        </div>
      </a>
      {% endfor %}
    </div>
    {% elif events.length == 0 %}
    <div class="skeleton-grid">
      <div class="skeleton skeleton-card"></div>
      <div class="skeleton skeleton-card"></div>
      <div class="skeleton skeleton-card"></div>
    </div>
    {% else %}
    <div class="card card--centered" style="padding:2rem;"><h3>Events Coming Soon</h3><p>We're planning exciting events. Check back soon or <a href="/chapters/">find your chapter</a> to get notified!</p></div>
    {% endif %}

    {% if past.length > 0 %}
    <h2>Past Events</h2>
    <div class="events-grid">
      {% for e in past %}
      <a href="/events/{{ e.slug }}/" class="event-card" style="opacity:0.8;">
        <div class="event-card-header">
          <span class="status-badge status-badge--completed" style="font-size:0.7rem;">Completed</span>
          <div class="event-card-date"><span class="icon" aria-hidden="true"><svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg></span> {{ e.date }}</div>
          <h3 class="event-card-title">{{ e.title }}</h3>
        </div>
        <div class="event-card-body">
          <div class="event-card-location"><span class="icon" aria-hidden="true"><svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 1118 0z"/><circle cx="12" cy="10" r="3"/></svg></span> {{ e.location }}</div>
        </div>
        <div class="event-card-footer">
          <span class="event-card-btn">View Event</span>
        </div>
      </a>
      {% endfor %}
    </div>
    {% endif %}
  </div>

  <h2>Host an Event</h2>
  <p>Is your chapter planning an event? Chapter leads can create events from the <a href="/dashboard/">Dashboard</a>.</p>
</div>

<script src="/js/events-list.js?v={{ cacheBust }}"></script>