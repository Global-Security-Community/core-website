---
layout: base.njk
title: Home
description: "Join the Global Security Community — connecting cybersecurity professionals worldwide through local chapters, events, and knowledge sharing."
templateEngineOverride: njk
---

<div class="container">
  {% set upcoming = [] %}
  {% set nowTs = "" | nowMs %}
  {% for event in events %}
    {% set eventDateStr = event.date %}
    {% if eventDateStr %}
      {% set eventTs = eventDateStr | dateToMs %}
      {% if eventTs >= nowTs %}
        {% set upcoming = (upcoming.push(event), upcoming) %}
      {% endif %}
    {% else %}
      {% set upcoming = (upcoming.push(event), upcoming) %}
    {% endif %}
  {% endfor %}

  <div class="hero">
    <div class="hero-content">
      <h1>Connecting Cybersecurity Professionals Worldwide</h1>
      <p>Building a worldwide network of cybersecurity professionals committed to advancing global security practices and knowledge sharing.</p>
      <div class="hero-actions">
        <a href="/events/" class="hero-btn hero-btn-primary">View Events</a>
        <a href="/chapters/" class="hero-btn hero-btn-secondary">Find Your Chapter</a>
      </div>
    </div>
    <div class="hero-visual" aria-hidden="true">
      <img src="/assets/GSC-Shield-Transparent.png" alt="" class="hero-shield">
    </div>
  </div>

  <section class="home-section" aria-labelledby="home-events-heading">
    <div class="home-section-header">
      <div>
        <h2 id="home-events-heading">Upcoming Community Events</h2>
        <p class="home-section-intro">Find talks, workshops, bootcamps, and networking opportunities hosted by regional chapters.</p>
      </div>
      <a href="/events/" class="btn-secondary">View All Events</a>
    </div>

    <div id="home-events-list">
      {% if upcoming.length > 0 %}
      <div class="events-grid home-events-grid">
        {% for e in upcoming %}
        {% if loop.index0 < 3 %}
        <a href="/events/{{ e.slug }}/" class="event-card">
          <div class="event-card-header">
            <div class="event-card-date"><span class="icon" aria-hidden="true"><svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg></span> {{ e.date | humanDate }}</div>
            <h3 class="event-card-title">{{ e.title }}</h3>
          </div>
          <div class="event-card-body">
            <div class="event-card-location"><span class="icon" aria-hidden="true"><svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 1118 0z"/><circle cx="12" cy="10" r="3"/></svg></span> {{ e.location }}</div>
          </div>
          <div class="event-card-footer">
            <span class="event-card-btn">View Event</span>
          </div>
        </a>
        {% endif %}
        {% endfor %}
      </div>
      {% else %}
      <div class="card events-empty">
        <h3>Events Coming Soon</h3>
        <p>We are planning future community events. Explore local chapters to stay connected and get notified when new events are announced.</p>
        <a href="/chapters/" class="btn-primary">Find a Chapter</a>
      </div>
      {% endif %}
    </div>
    <script src="/js/events-list.js?v={{ cacheBust }}"></script>
  </section>

  <section class="home-section reveal-on-scroll" aria-labelledby="offer-heading">
    <h2 id="offer-heading" class="sr-only">Community at a Glance</h2>
    <div class="stats-bar">
      <div class="stat-item">
        <span class="stat-value">8</span>
        <span class="stat-desc">Chapters worldwide</span>
      </div>
      <div class="stat-item">
        <span class="stat-value">3</span>
        <span class="stat-desc">Events hosted</span>
      </div>
      <div class="stat-item">
        <span class="stat-value">5</span>
        <span class="stat-desc">Countries represented</span>
      </div>
    </div>
  </section>

  <section class="home-section home-feature reveal-on-scroll" aria-labelledby="chapter-discovery-heading">
    <div class="home-feature-content">
      <p class="page-kicker">Global network, local community</p>
      <h2 id="chapter-discovery-heading">Find security people near you</h2>
      <p>Regional chapters make the global community practical: local organisers, local events, and local relationships backed by a wider network of security professionals.</p>
      <div class="home-feature-actions">
        <a href="/chapters/" class="btn-primary">Explore Chapters</a>
        <a href="/chapters/#start-chapter" class="btn-secondary">No Chapter Nearby?</a>
      </div>
    </div>
    <div class="home-feature-panel" aria-label="Community focus areas">
      <div class="home-feature-item">
        <strong>Regional chapters</strong>
        <span>Connect with security professionals in your city or region.</span>
      </div>
      <div class="home-feature-item">
        <strong>Community-led events</strong>
        <span>Learn from practitioners through talks, workshops, and bootcamps.</span>
      </div>
      <div class="home-feature-item">
        <strong>Shared security practice</strong>
        <span>Exchange practical knowledge that strengthens teams and organisations.</span>
      </div>
    </div>
  </section>

  <section class="home-section reveal-on-scroll" aria-labelledby="involvement-heading">
    <div class="home-section-header">
      <div>
        <h2 id="involvement-heading">Get Involved</h2>
        <p class="home-section-intro">Choose the level of participation that fits where you are now, then grow with the community.</p>
      </div>
    </div>
    <ol class="involvement-steps">
      <li class="involvement-step">
        <a href="/events/" class="involvement-step-link">
          <span class="involvement-step-label">Attend</span>
          <strong>Join an Event</strong>
          <span class="involvement-step-desc">Meet practitioners, learn from real-world experience, and build your local security network.</span>
        </a>
      </li>
      <li class="involvement-step">
        <a href="https://discord.gg/qVRPXJuEYb" class="involvement-step-link" target="_blank" rel="noopener noreferrer">
          <span class="involvement-step-label">Contribute</span>
          <strong>Speak or Volunteer</strong>
          <span class="involvement-step-desc">Join the Discord community to share a talk idea, help run events, or contribute practical security knowledge.</span>
        </a>
      </li>
      <li class="involvement-step">
        <a href="/chapters/#start-chapter" class="involvement-step-link">
          <span class="involvement-step-label">Lead</span>
          <strong>Find or Start a Chapter</strong>
          <span class="involvement-step-desc">Check whether your region already has a chapter, then apply to start one if there is not a local community yet.</span>
        </a>
      </li>
    </ol>
  </section>

  <script src="/js/scroll-reveal.js?v={{ cacheBust }}"></script>
</div>
