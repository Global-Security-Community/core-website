---
layout: base.njk
title: Events
---

<div class="container">
  <h1>Events</h1>

  <p>Join us at upcoming events where security professionals gather to learn, network, and share insights.</p>

  <h2>Upcoming Events</h2>
  <div class="cards" id="events-dynamic">
    {% set eventPages = collections.all | selectattr("data.layout", "equalto", "event.njk") %}
    {% set hasEvents = false %}
    {% for event in eventPages %}
      {% set hasEvents = true %}
      <div class="card">
        <h3 style="margin-top:0;"><a href="{{ event.url }}">{{ event.data.title }}</a></h3>
        <p>📅 {{ event.data.date }}{% if event.data.endDate %} – {{ event.data.endDate }}{% endif %}</p>
        <p>📍 {{ event.data.location }}</p>
        <p><a href="{{ event.url }}">View Event &rarr;</a></p>
      </div>
    {% endfor %}
    {% if not hasEvents %}
    <div class="card">
      <h3>Events Coming Soon</h3>
      <p>We're planning exciting events for 2026. Check back here for announcements about our global summit, regional meetups, and training workshops.</p>
    </div>
    {% endif %}
  </div>

  <h2>Host an Event</h2>
  <p>Is your chapter planning an event? Chapter leads can create events from the <a href="/dashboard/">Dashboard</a>.</p>
</div>