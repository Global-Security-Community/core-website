# UX Action Plan — Implementation Guide

This document provides step-by-step implementation instructions for every item in the UX review action plan. Each item includes the exact files to change, what to change, and in what order.

---

## P0-1: Fix Primary Teal Colour Contrast

**Effort:** 5 minutes | **Files:** 1

The brand teal `#20b2aa` fails WCAG AA (2.62:1 against white). Every link, button, heading, and badge on the site is affected. This is the single highest-impact change.

### Steps

1. **Edit `src/css/style.css` line 2** — change the CSS variable:
   ```css
   /* Before */
   --color-primary-teal: #20b2aa;
   /* After */
   --color-primary-teal: #0e8c84;
   ```
   This achieves 4.56:1 contrast (WCAG AA pass). The variable cascades to every usage site-wide — no other CSS changes needed.

2. **Fix one hardcoded teal hover** — `src/css/style.css:1428`:
   ```css
   /* Before */
   .event-card-btn:hover { background-color: #178a84; }
   /* After — use the variable */
   .event-card-btn:hover { background-color: var(--color-primary-navy); }
   ```

3. **Verify** — build the site (`npx @11ty/eleventy`) and visually check the homepage, chapters, events, and buttons.

---

## P0-2: Fix Secondary Colour Contrast

**Effort:** 15 minutes | **Files:** 3 (CSS + 2 JS)

Several secondary colours fail WCAG AA. Fix all of them in one pass.

### Colour mapping

| Old       | New       | Ratio  | Usage                                    |
|-----------|-----------|--------|------------------------------------------|
| `#888`    | `#666`    | 5.74:1 | Char hints, flip hints, muted text       |
| `#999`    | `#767676` | 4.54:1 | Status badges, pending text, muted text  |
| `#ffa500` | `#c47600` | 3.27:1 | Volunteer/warning badge (large text pass) |

### CSS changes (`src/css/style.css`)

| Line | Old | New |
|------|-----|-----|
| 483  | `color: #888;` | `color: #666;` |
| 490  | `color: #888;` | `color: #666;` |
| 1088 | `color: #888;` | `color: #666;` |
| 1218 | `color: #888;` | `color: #666;` |
| 705  | `.status-badge--default { background-color: #999; }` | `background-color: #767676;` |
| 1248 | `color: #999;` | `color: #767676;` |
| 1336 | `color: #999;` | `color: #767676;` |
| 1542 | `.ticket-status--pending { color: #999; }` | `color: #767676;` |
| 4    | `--color-accent-orange: #ffa500;` | `--color-accent-orange: #c47600;` |

### JS changes

These files use hardcoded `#999` in inline styles:

- **`src/js/event-page.js`** lines 37, 45 — `btn.style.backgroundColor = '#999'` → `'#767676'`
- **`src/js/scanner.js`** line 113 — `color:#999` → `color:#767676`
- **`src/js/dashboard.js`** lines 146, 346 — `color:#888` → `color:#666`

---

## P1-1: Add Homepage H1 Headline

**Effort:** 5 minutes | **Files:** 1

### Steps

1. **Edit `src/index.md`** — add an `<h1>` inside the hero-content div:
   ```html
   <div class="hero-content">
     <h1>Connecting Cybersecurity Professionals Worldwide</h1>
     <p>Building a worldwide network...</p>
   ```

2. The `<h1>` will inherit styles from `style.css:151-156` (`.hero h1`): 3rem, navy, left-aligned. On mobile it centres and shrinks to 2rem. No CSS changes needed.

---

## P1-2: Add `role="alert"` to Form Messages

**Effort:** 15 minutes | **Files:** 5 templates

Every form has a message `<div>` that shows success/error feedback. These need `role="alert"` so screen readers announce them.

### Template changes

| File | Line | Element ID | Add |
|------|------|------------|-----|
| `src/contact/index.md` | 12 | `#form-message` | `role="alert"` |
| `src/chapters/apply/index.md` | 12 | `#form-message` | `role="alert"` |
| `src/register/index.md` | 11 | `#reg-message` | `role="alert"` |
| `src/dashboard/index.md` | 25 | `#create-message` | `role="alert"` |
| `src/dashboard/index.md` | 147 | `#edit-event-message` | `role="alert"` |
| `src/dashboard/index.md` | 202 | `#chapter-edit-message` | `role="alert"` |

Example:
```html
<!-- Before -->
<div id="form-message" style="display: none; ..."></div>
<!-- After -->
<div id="form-message" role="alert" style="display: none; ..."></div>
```

---

## P1-3: Add Active Navigation State

**Effort:** 30 minutes | **Files:** 2 (layout + CSS)

### Steps

1. **Edit `src/_includes/layouts/base.njk`** — add conditional `aria-current` to each nav link:
   ```html
   <li><a href="/" class="nav-link{% if page.url == '/' %} nav-link--active{% endif %}"{% if page.url == '/' %} aria-current="page"{% endif %}>Home</a></li>
   <li><a href="/about/" class="nav-link{% if page.url == '/about/' %} nav-link--active{% endif %}"{% if page.url == '/about/' %} aria-current="page"{% endif %}>About Us</a></li>
   <li><a href="/chapters/" class="nav-link{% if '/chapters/' in page.url %} nav-link--active{% endif %}"{% if '/chapters/' in page.url %} aria-current="page"{% endif %}>Chapters</a></li>
   <li><a href="/events/" class="nav-link{% if '/events/' in page.url %} nav-link--active{% endif %}"{% if '/events/' in page.url %} aria-current="page"{% endif %}>Events</a></li>
   <li><a href="/contact/" class="nav-link{% if page.url == '/contact/' %} nav-link--active{% endif %}"{% if page.url == '/contact/' %} aria-current="page"{% endif %}>Contact</a></li>
   ```

2. **Add CSS** to `src/css/style.css` after `.nav-link:hover` (line 86):
   ```css
   .nav-link--active {
     color: var(--color-primary-teal);
     border-bottom: 2px solid var(--color-primary-teal);
     padding-bottom: 2px;
   }
   ```

---

## P1-4: Add Privacy Policy and Terms of Service

**Effort:** 1-2 hours | **Files:** 3 new + 1 edit

### Steps

1. **Create `src/privacy/index.md`** with `layout: base.njk`, `title: Privacy Policy`. Content should cover:
   - What data is collected (name, email, company, job title, industry, experience level via registration forms)
   - How it's stored (Azure Table Storage)
   - How it's used (event management, community communications)
   - Third-party services (Cloudflare Turnstile, Gravatar, Azure AD B2C, Azure Communication Services)
   - Data retention and deletion (how to request deletion)
   - Contact information

2. **Create `src/terms/index.md`** with `layout: base.njk`, `title: Terms of Service`. Cover:
   - Acceptable use
   - Community code of conduct reference
   - Account responsibilities
   - Event registration and cancellation policy

3. **Add links to footer** in `src/_includes/layouts/base.njk`:
   ```html
   <footer class="footer">
     <div class="container">
       <p>&copy; 2026 Global Security Community. All rights reserved.</p>
       <p><a href="/privacy/">Privacy Policy</a> · <a href="/terms/">Terms of Service</a></p>
     </div>
   </footer>
   ```

4. Note: the content of these pages is a legal/policy decision — draft templates and have the team review before publishing.

---

## P2-1: Expand Footer Content

**Effort:** 30 minutes | **Files:** 2 (layout + CSS)

### Steps

1. **Edit `src/_includes/layouts/base.njk`** — replace the minimal footer:
   ```html
   <footer class="footer">
     <div class="container">
       <div class="footer-grid">
         <div class="footer-section">
           <h4>Global Security Community</h4>
           <p>Connecting cybersecurity professionals worldwide through local chapters and events.</p>
         </div>
         <div class="footer-section">
           <h4>Quick Links</h4>
           <ul class="footer-links">
             <li><a href="/about/">About Us</a></li>
             <li><a href="/chapters/">Chapters</a></li>
             <li><a href="/events/">Events</a></li>
             <li><a href="/contact/">Contact</a></li>
           </ul>
         </div>
         <div class="footer-section">
           <h4>Legal</h4>
           <ul class="footer-links">
             <li><a href="/privacy/">Privacy Policy</a></li>
             <li><a href="/terms/">Terms of Service</a></li>
           </ul>
         </div>
       </div>
       <p class="footer-copyright">&copy; 2026 Global Security Community. All rights reserved.</p>
     </div>
   </footer>
   ```

2. **Add CSS** to `src/css/style.css` — add after the existing `.footer` block (line 525):
   ```css
   .footer-grid {
     display: grid;
     grid-template-columns: 2fr 1fr 1fr;
     gap: 2rem;
     text-align: left;
     margin-bottom: 2rem;
   }
   .footer h4 {
     color: var(--color-primary-teal);
     margin-bottom: 0.75rem;
     font-size: 1rem;
   }
   .footer p, .footer a { color: rgba(255, 255, 255, 0.8); font-size: 0.9rem; }
   .footer a:hover { color: white; }
   .footer-links { list-style: none; }
   .footer-links li { margin-bottom: 0.5rem; }
   .footer-copyright {
     border-top: 1px solid rgba(255, 255, 255, 0.15);
     padding-top: 1rem;
     font-size: 0.85rem;
     opacity: 0.7;
   }
   @media (max-width: 768px) {
     .footer-grid { grid-template-columns: 1fr; text-align: center; }
   }
   ```

---

## P2-2: Make Event Cards Fully Clickable

**Effort:** 15 minutes | **Files:** 2 JS + 1 CSS

### Steps

1. **Edit `src/js/events-list.js`** — in `renderEventCard()`, wrap the card in `<a>` instead of `<div>`:
   ```js
   // Before
   return '<div class="event-card"' + opacity + '>' + ...
   // After
   return '<a href="/events/' + e.slug + '/" class="event-card"' + opacity + '>' +
     // ...keep inner structure, but change footer link to <span>
     '<div class="event-card-footer">' +
       '<span class="event-card-btn">' + btnText + '</span>' +
     '</div>' +
   '</a>';
   ```

2. **Do the same in `src/js/chapter-events.js`** (line 42).

3. **Add CSS** to `src/css/style.css`:
   ```css
   a.event-card { text-decoration: none; color: inherit; display: flex; flex-direction: column; }
   a.event-card:hover { color: inherit; }
   ```

---

## P2-3: Add Keyboard Support to Speaker Flip Cards

**Effort:** 20 minutes | **Files:** 1

### Steps

1. **Edit `src/js/event-page.js`** — add `tabindex` and `role` to speaker cards:
   ```js
   // Line ~150, change:
   html += '<div class="speaker-card">';
   // To:
   html += '<div class="speaker-card" tabindex="0" role="button" aria-label="' + esc(s.fullName) + ' — click to see bio">';
   ```

2. **Add front-face hint** before closing `speaker-card-front`:
   ```js
   html += '<p class="speaker-flip-hint">Click to see bio</p>';
   ```

3. **Add keyboard handler** after the click handler loop (line ~175):
   ```js
   for (var i = 0; i < cards.length; i++) {
     cards[i].addEventListener('keydown', function(e) {
       if (e.key === 'Enter' || e.key === ' ') {
         e.preventDefault();
         this.classList.toggle('flipped');
       }
     });
   }
   ```

---

## P2-4: Move Turnstile Script to Form Pages Only

**Effort:** 15 minutes | **Files:** 4

### Steps

1. **Remove** from `src/_includes/layouts/base.njk` line 56:
   ```html
   <!-- Delete this line -->
   <script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>
   ```

2. **Add to form pages only** — insert before the page's own `<script>` tag in:
   - `src/contact/index.md`
   - `src/register/index.md`
   - `src/chapters/apply/index.md`

   ```html
   <script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>
   ```

---

## P3-1: Replace Inline Styles With CSS Classes

**Effort:** 2-3 hours | **Files:** 8 templates + 1 CSS

### Phase 1: Add utility classes to `src/css/style.css`

```css
/* Utility: hidden by default, shown via JS */
.is-hidden { display: none; }

/* Utility: text variants */
.text-semibold { margin: 0; font-weight: 600; }
.text-muted-sm { color: #666; font-size: 0.9rem; margin: 0; }
.help-text { font-size: 0.85em; color: #666; }
.help-text-block { display: block; color: #666; margin-bottom: 0.25rem; font-size: 0.85rem; }
.subtitle-muted { margin: -0.5rem 0 1rem 0; color: #666; }

/* Utility: spacing */
.mt-0 { margin-top: 0; }
.mt-section { margin-top: 1.5rem; }
.mb-section { margin-bottom: 2rem; }

/* Utility: layout */
.narrow-content { max-width: 600px; }
.two-col-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }

/* Component: icon in info card */
.icon-xl { font-size: 2rem; margin: 0; }

/* Component: breadcrumb row */
.breadcrumb-row {
  display: flex; gap: 0.5rem; align-items: center;
  margin-bottom: 1rem; font-size: 0.9rem;
}
.breadcrumb-divider { color: #ccc; }

/* Component: event info cards — 3 columns */
.cards--info { grid-template-columns: 1fr 1fr 1fr; margin-bottom: 2rem; }
.card--centered { text-align: center; }

/* Component: form message states */
.form-message--success { display: block; background-color: #d4edda; color: #155724; border-left: 4px solid #28a745; }
.form-message--error { display: block; background-color: #f8d7da; color: #721c24; border-left: 4px solid #f5c6cb; }
.form-message--warning { display: block; background-color: #fff3cd; color: #856404; border-left: 4px solid #ffc107; }

/* Responsive: info cards stack on mobile */
@media (max-width: 600px) {
  .cards--info { grid-template-columns: 1fr; }
}
```

### Phase 2: Replace inline styles in templates

The audit found 60 inline styles. Key patterns:

| Inline pattern | Replace with | Count |
|----------------|-------------|-------|
| `style="display:none;"` | `class="is-hidden"` | 18 |
| `style="max-width: 600px;"` | `class="narrow-content"` | 2 |
| `style="text-align:center;"` | `class="card--centered"` | 3 |
| `style="font-size:2rem; margin:0;"` | `class="icon-xl"` | 3 |
| `style="margin:0; font-weight:600;"` | `class="text-semibold"` | 3 |
| `style="display:grid; grid-template-columns:1fr 1fr; gap:1rem;"` | `class="two-col-grid"` | 2 |
| `style="color:#666;font-size:0.9rem;margin:0;"` | `class="text-muted-sm"` | 1 |
| Full inline button (event.njk:30) | `class="btn-cta btn-cta--lg"` | 1 |

### Phase 3: Replace inline styles in JS

In JS files, replace form message styling patterns:
```js
// Before
msg.style.backgroundColor = '#f8d7da';
msg.style.color = '#721c24';
msg.style.display = 'block';
// After
msg.className = 'form-message form-message--error';
msg.textContent = 'Error message here';
```

Files to update: `contact-form.js`, `chapter-apply-form.js`, `register.js`, `dashboard.js`, `scanner.js`.

---

## P3-2: Replace Emoji With SVG Icons

**Effort:** 2-3 hours | **Files:** 6 templates + 6 JS + 1 new JS + 1 CSS

### Steps

1. **Create `src/js/icons.js`** — shared SVG icon strings:
   ```js
   var GSCIcons = {
     calendar: '<svg viewBox="0 0 24 24" width="1em" height="1em" ...>...</svg>',
     mapPin: '<svg ...>...</svg>',
     ticket: '<svg ...>...</svg>',
     // ... 21 icons total (see emoji mapping below)
   };
   ```

2. **Add to `base.njk`** before page scripts:
   ```html
   <script src="/js/icons.js?v={{ cacheBust }}"></script>
   ```

3. **Replace emoji in templates and JS** — full mapping:

   | Emoji | Icon name | Files |
   |-------|-----------|-------|
   | 📅 | `calendar` | event.njk, dashboard.js, chapter-events.js, events-list.js, my-tickets.js, register.js |
   | 📍 | `mapPin` | event.njk, chapters/index.md, dashboard.js, chapter-events.js, events-list.js, register.js |
   | 🎟️ | `ticket` | event.njk, dashboard.js, register.js |
   | 💬 | `messageCircle` | chapter.njk |
   | 📬 | `mailOpen` | chapter.njk |
   | ✅ | `checkCircle` | chapter-subscribe.js, dashboard.js, my-tickets.js, scanner.js |
   | ❌ | `xCircle` | chapter-subscribe.js, dashboard.js, scanner.js |
   | ⚠️ | `alertTriangle` | dashboard.js, scanner.js |
   | ✏️ | `pencil` | dashboard/index.md |
   | ⏳ | `hourglass` | dashboard/index.md, dashboard.js |
   | 📷 | `camera` | scanner.js |
   | 🙏 | `heart` | register/index.md |
   | 🎉 | `partyPopper` | register/index.md |
   | 📧 | `mail` | register/index.md, my-tickets.js |
   | 🔔 | `bell` | chapter-subscribe.js |
   | 🎤 | `mic` | dashboard.js |
   | 🎨 | `image` | dashboard.js |
   | 🤝 | `handshake` | dashboard.js |
   | 🙋 | `handRaised` | dashboard.js |
   | ✕ | `x` | dashboard.js |
   | 🔄 | `refreshCw` | dashboard.js |

4. **Add icon CSS**:
   ```css
   .icon { display: inline-flex; vertical-align: middle; }
   .icon--lg svg { width: 2rem; height: 2rem; }
   .icon--sm svg { width: 1rem; height: 1rem; }
   ```

---

## P3-3: Add Loading Skeleton Components

**Effort:** 2-3 hours | **Files:** 7 templates + 1 CSS

### Steps

1. **Add skeleton CSS** to `src/css/style.css`:
   ```css
   .skeleton {
     background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
     background-size: 200% 100%;
     animation: skeleton-pulse 1.5s ease-in-out infinite;
     border-radius: 4px;
   }
   .skeleton-text { height: 1rem; margin-bottom: 0.5rem; }
   .skeleton-card { height: 200px; border-radius: 12px; }
   .skeleton-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 2rem; }
   @keyframes skeleton-pulse {
     0% { background-position: 200% 0; }
     100% { background-position: -200% 0; }
   }
   @media (max-width: 900px) { .skeleton-grid { grid-template-columns: repeat(2, 1fr); } }
   @media (max-width: 600px) { .skeleton-grid { grid-template-columns: 1fr; } }
   ```

2. **Replace loading text** — e.g. `src/events/index.md:12`:
   ```html
   <div id="events-list">
     <div class="skeleton-grid">
       <div class="skeleton skeleton-card"></div>
       <div class="skeleton skeleton-card"></div>
       <div class="skeleton skeleton-card"></div>
     </div>
   </div>
   ```
   Apply to: events listing, my-tickets, chapter events, event page agenda/speakers, dashboard.

3. **Also fix one silent error** — `src/js/event-page.js:67` has an empty `.catch()` for the reg-count fetch. If it fails, `#reg-count` stays as "Loading..." forever. Add:
   ```js
   .catch(function() {
     var el = document.getElementById('reg-count');
     if (el) el.textContent = '—';
   });
   ```

---

## P3-4: Create Shared JS Utility Module

**Effort:** 1-2 hours | **Files:** 1 new + 7 edits

### Steps

1. **Create `src/js/utils.js`**:
   ```js
   var GSC = window.GSC || {};
   GSC.esc = function(str) { ... };
   GSC.formatDate = function(dateStr) { ... };
   GSC.formatLocation = function(loc) { ... };
   GSC.showMessage = function(el, type, text) { ... };
   window.GSC = GSC;
   ```

2. **Add to `base.njk`** before page scripts.

3. **Remove duplicated functions** from 7 JS files:
   - `esc()` — remove from: event-page.js, events-list.js (if present), my-tickets.js, register.js, scanner.js, dashboard.js, chapter-partners.js
   - `formatDate()` — remove from: my-tickets.js, register.js
   - `formatLocation()` — remove from: my-tickets.js, register.js

---

## P3-5: Unify Button Component System

**Effort:** 2-3 hours | **Files:** 1 CSS + 8 templates/JS

### Proposed system

Consolidate 12+ button classes to: `.btn` base + `.btn--primary`, `.btn--navy`, `.btn--outline`, `.btn--danger`, `.btn--discord` modifiers + `.btn--sm`, `.btn--lg` sizes + `.btn--hero` for lift effect.

### Migration mapping

| Old class | New class | Files |
|-----------|-----------|-------|
| `.btn-cta` | `.btn .btn--primary` | chapters/index.md |
| `.btn-link` | `.btn .btn--primary` | dashboard.js |
| `.hero-btn .hero-btn-primary` | `.btn .btn--primary .btn--hero` | index.md |
| `.hero-btn .hero-btn-secondary` | `.btn .btn--outline .btn--hero` | index.md |
| `.btn-navy` | `.btn .btn--navy` | dashboard/index.md |
| `.btn-outline` | `.btn .btn--outline` | dashboard/index.md, dashboard.js |
| `.btn-danger` | `.btn .btn--danger` | dashboard.js |
| `.btn-discord` | `.btn .btn--discord` | chapter.njk |
| `.event-card-btn` | `.btn .btn--primary .btn--sm` | events-list.js, chapter-events.js |
| `.chapter-card-btn` | `.btn .btn--primary .btn--sm` | chapters/index.md |
| Inline button (event.njk:30) | `.btn .btn--primary .btn--lg` | event.njk |

Keep old classes as aliases during migration, then remove after all templates are updated.

---

## P4-1: Pre-Render Events Listing at Build Time

**Effort:** 2-4 hours | **Files:** 2 new + 1 edit

1. **Create `src/_data/events.js`** — Eleventy global data file that fetches from the API at build time.
2. **Edit `src/events/index.md`** — render from data file with JS progressive enhancement fallback.
3. **Keep `events-list.js`** as a hydration/fallback layer.

Considerations: API must be accessible at build time; data will be stale between deploys.

---

## P4-2: Add Social Proof to Homepage

**Effort:** 2-3 hours | **Files:** 1 template + 1 CSS

Add a stats bar to `src/index.md` showing chapter count, events held, and community members. Hardcode initially, update as the community grows.

---

## P4-3: Dashboard URL-Based Routing

**Effort:** 3-4 hours | **Files:** 1

Use `location.hash` to persist dashboard section state. Modify `showSection()` to update hash, read hash on page load, listen for `popstate`.

---

## P4-4: Self-Host QR Code Library

**Effort:** 30 minutes | **Files:** 2

1. Download `html5-qrcode.min.js` to `src/js/vendor/`.
2. Update `src/scanner/index.md` to reference the local copy.
3. Optionally remove `https://unpkg.com` from CSP `script-src`.

---

## P4-5: Per-Page Meta Descriptions

**Effort:** 30 minutes | **Files:** 6

Add `description` front matter to: index.md, about/index.md, contact/index.md, chapters/index.md, events/index.md, chapters/apply/index.md. The `base.njk` layout already supports `{{ description }}`.

---

## Dependency Graph

```
P0-1 (Fix teal) ─── standalone, do first
P0-2 (Fix secondary colours) ─── standalone, do with P0-1
P1-1 (Homepage h1) ─── standalone
P1-2 (role="alert") ─── standalone
P1-3 (Active nav) ─── standalone
P1-4 (Privacy/Terms) ──┐
P2-1 (Footer)  ────────┘ do together (footer links to privacy/terms)
P2-2 (Clickable cards) ─── standalone
P2-3 (Speaker keyboard) ─── standalone
P2-4 (Turnstile) ─── standalone
P3-1 (Inline styles) ──┐
P3-4 (Shared utils)  ──┤ do together — both touch same JS files
P3-5 (Button system) ──┘
P3-2 (SVG icons) ─── depends on P3-1 (replace inline icon styles first)
P3-3 (Loading skeletons) ─── depends on P3-1 (need skeleton CSS classes)
P4-1 (Pre-render events) ─── standalone
P4-2 (Social proof) ─── standalone
P4-3 (Dashboard routing) ─── standalone
P4-4 (Self-host QR) ─── standalone
P4-5 (Meta descriptions) ─── standalone
```

## Suggested Implementation Batches

1. **Batch 1 — Quick wins (P0 + P1):** Fix colours, add h1, add role="alert", add active nav, add meta descriptions
2. **Batch 2 — Navigation & trust (P1-4 + P2-1):** Privacy/terms pages + expanded footer
3. **Batch 3 — Interaction fixes (P2):** Clickable event cards, speaker keyboard support, move Turnstile
4. **Batch 4 — Design system foundation (P3-1 + P3-4 + P3-5):** Inline styles → CSS, shared utils, button consolidation
5. **Batch 5 — Visual polish (P3-2 + P3-3):** SVG icons, loading skeletons
6. **Batch 6 — Architecture (P4):** Pre-render events, social proof, dashboard routing, self-host QR
