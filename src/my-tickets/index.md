---
layout: base.njk
title: My Tickets
description: "View your Global Security Community event tickets and registration details."
---

<div class="container">
  <h1>My Tickets</h1>
  <div id="tickets-list" aria-live="polite">
    <div class="skeleton skeleton-card" style="max-width:420px;margin:0 auto;"></div>
  </div>
</div>

<script src="/js/my-tickets.js?v={{ cacheBust }}"></script>
