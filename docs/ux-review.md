# UX/UI Expert Review — Global Security Community Website

**Review date:** 1 April 2026  
**Reviewer:** Senior UX/UI Audit (AI-assisted)  
**Scope:** Full codebase inspection — templates, CSS, JavaScript, config, accessibility, responsiveness

---

## Scores

| Dimension              | Score | Notes |
|------------------------|-------|-------|
| **Overall UX**         | 6/10  | Functional and clear purpose, but lacks polish, has significant accessibility failures, and relies heavily on inline styles instead of a design system |
| **Visual polish**      | 5/10  | Clean skeleton, but sparse — minimal visual richness, no illustrations beyond logo, inconsistent spacing, heavy use of emoji as icons |
| **Accessibility maturity** | 4/10 | Good foundations (skip-link, focus-visible, reduced-motion, aria-live) but the primary brand colour *completely fails* WCAG contrast on every surface it's used on |

---

## Top 3 Changes With the Biggest Likely Impact

1. **Fix the teal colour contrast** — your primary brand colour `#20b2aa` fails WCAG AA at 2.62:1 against white. Every link, every CTA button, every h3, and every card action on the site is inaccessible. Darkening teal to ~`#0e8c84` (4.56:1) fixes the entire site in one CSS variable change.

2. **Add a hero headline to the homepage** — the homepage has no `<h1>` visible text. The hero section is just a logo + a paragraph + two buttons. First-time visitors cannot instantly understand "what is this?". Add a clear headline like "Connecting Cybersecurity Professionals Worldwide".

3. **Replace inline styles with CSS classes** — 49+ inline `style=""` attributes across templates make the UI inconsistent, unmaintainable, and impossible to theme. Moving them to `style.css` gives you a single source of truth for spacing, layout, and component appearance.

---

## Executive Summary

The GSC website is a functional, early-stage community platform that gets the basics right: clear navigation, logical page hierarchy, fast static-site architecture, and a sensible colour palette in concept. The codebase shows intentional accessibility effort (skip-link, focus indicators, `aria-live`, `prefers-reduced-motion`) which is commendable.

However, the site has **critical accessibility failures** (primary teal colour fails WCAG contrast everywhere), a **sparse homepage that doesn't communicate purpose** (no h1 headline), heavy reliance on **inline styles instead of a design system**, and several UX patterns that reduce trust and polish (emoji as icons, no loading skeletons, no error boundaries, "Loading..." text everywhere).

The site feels like a **competent MVP that hasn't had a design pass** — it works, but it doesn't yet feel like a polished, trustworthy professional community platform. The good news: the architecture is clean and most issues are fixable with CSS changes and template tweaks, not rewrites.

---

## Top 10 Highest-Value Improvements

### 1. Fix Primary Colour Contrast (Critical)
- **Severity:** Critical
- **Why it matters:** The primary teal `#20b2aa` is used for *all* links, h3 headings, CTA buttons, badges, and interactive elements. It achieves only **2.62:1** contrast against white — far below the WCAG AA minimum of 4.5:1. This affects every single page.
- **Evidence:**
  - `style.css:2` — `--color-primary-teal: #20b2aa`
  - Used for: links (line 193), h3 (line 183), `.btn-cta` (line 247), `.hero-btn-primary` (line 131), `.chapter-card-btn` (line 344), `.event-card-btn` (line 1419), white-on-teal buttons everywhere
  - Contrast calculation: 2.62:1 (white on teal), 2.40:1 (teal on #f5f5f5)
- **Recommendation:** Change `--color-primary-teal` to `#0e8c84` (4.56:1) or `#0d847d` (4.85:1). One variable change fixes the entire site.
- **Quick win:** Yes — single line CSS change

### 2. Add Homepage Headline (High)
- **Severity:** High
- **Why it matters:** The homepage hero has no `<h1>` text. The only content is a logo image, a paragraph, and two buttons. A first-time visitor must *read a paragraph* to understand what the site is about. This violates the "5-second test" — users should understand the site's purpose instantly.
- **Evidence:** `src/index.md:6-18` — hero section contains `<img>`, `<p>`, and buttons, but no headline. The `<h1>` from `base.njk` is suppressed because the homepage content doesn't include one (the first heading is `<h2>Our Mission`).
- **Recommendation:** Add a clear `<h1>` in the hero: "Connecting Cybersecurity Professionals Worldwide" or "The Global Cybersecurity Community".
- **Quick win:** Yes — one line of HTML

### 3. Eliminate Inline Styles (High)
- **Severity:** High
- **Why it matters:** There are 49+ inline `style=""` attributes across templates (`event.njk`: 19, `dashboard/index.md`: 15, `chapter.njk`: 7, `chapters/apply/index.md`: 8). This creates visual inconsistency, prevents theming, makes maintenance painful, and is a code smell.
- **Evidence:**
  - `event.njk:6` — `style="display:flex; gap:0.5rem; align-items:center; margin-bottom:1rem;"`
  - `event.njk:14` — `style="grid-template-columns: 1fr 1fr 1fr; margin-bottom: 2rem;"`
  - `event.njk:30` — full button styles inline instead of using `.btn-cta`
  - `dashboard/index.md:108` — `style="margin:-0.5rem 0 1rem 0;color:#666;"`
  - `chapters/apply/index.md:69` — duplicates the `select` styles already in CSS
- **Recommendation:** Extract all inline styles into named CSS classes in `style.css`. Create utility classes for common patterns (`.flex-row`, `.text-center`, `.mb-1`, etc.) or component-specific classes.
- **Larger redesign item:** Medium effort — systematic but straightforward

### 4. Replace Emoji Icons With SVG Icons (Medium)
- **Severity:** Medium
- **Why it matters:** Emoji (📅, 📍, 🎟️, 💬, 📬, 📷, 🙏) are used as icons throughout the site. Emoji render differently across platforms (some are colourful, some are monochrome), they can't be styled with CSS, they contribute to an unprofessional appearance, and they break visual consistency.
- **Evidence:**
  - `event.njk:17` — `📅`, `📍`, `🎟️` in info cards
  - `chapter.njk:57` — `📬` for notifications
  - `events-list.js:48` — `📅` and `📍` in event cards
  - `scanner.js:29` — `📷` for camera status
  - Chapter page: `💬` for Discord
- **Recommendation:** Use inline SVGs (you already do this excellently for social icons in `chapter.njk` — GitHub, LinkedIn, Twitter, Website). Apply the same pattern for calendar, location, ticket, mail, etc. icons.
- **Larger redesign item:** Medium effort — but big polish payoff

### 5. Add Loading States and Skeletons (Medium)
- **Severity:** Medium
- **Why it matters:** Every dynamically-loaded section shows plain text "Loading..." or "Loading events..." with no visual feedback. This feels cheap and creates layout shift when content arrives. Users on slow connections see a bare page with scattered "Loading..." text.
- **Evidence:**
  - `events/index.md:12` — `<p>Loading events...</p>`
  - `my-tickets/index.md:8` — `<p>Loading your tickets...</p>`
  - `chapter.njk:49` — `<p>Loading events...</p>`
  - `event.njk:26` — `Loading...` for registration count
  - `dashboard/index.md:8` — `Loading...` for user info
  - `event.njk:42-45` — `Loading agenda...`, `Loading speakers...`
- **Recommendation:** Replace with CSS skeleton placeholders (pulsing grey rectangles). This is a well-established pattern that communicates "content is coming" and prevents layout shift.
- **Larger redesign item:** Medium effort

### 6. Improve Footer Content (Medium)
- **Severity:** Medium
- **Why it matters:** The footer contains only `© 2026 Global Security Community. All rights reserved.` This is a missed opportunity for navigation, social links, legal links, and trust signals.
- **Evidence:** `base.njk:49-53` — minimal footer with only copyright
- **Recommendation:** Add: key navigation links (About, Chapters, Events, Contact), social media links (Discord, LinkedIn), privacy/terms links, and the organisation's tagline.
- **Quick win:** Yes — template change only

### 7. Add Active Navigation State (Medium)
- **Severity:** Medium
- **Why it matters:** There is no visual indicator showing which page the user is currently on. All nav links look identical regardless of the active page. This is a basic wayfinding issue.
- **Evidence:** `base.njk:30-35` — all nav links use the same `.nav-link` class with no active/current state. No `aria-current="page"` attribute.
- **Recommendation:** Add `aria-current="page"` and a `.nav-link--active` class (e.g., underline or teal colour) to the current page's nav link. In Eleventy, compare `page.url` against link hrefs.
- **Quick win:** Yes — template + CSS change

### 8. Fix Form Accessibility (Medium)
- **Severity:** Medium
- **Why it matters:** Forms have inconsistent validation feedback. Error/success messages use colour alone (red/green backgrounds) with no icons or role="alert". The registration form pre-fills email from auth but doesn't indicate it's pre-filled. Required fields only use `*` without an explanation.
- **Evidence:**
  - `contact-form.js:14-20` — error messages use only colour (red bg)
  - `register/index.md:15` — required fields marked with `*` but no legend explaining the convention
  - `register.js:127-128` — inline `style.backgroundColor` and `style.color` for messages
  - No `role="alert"` on form messages
  - `register/index.md:11` — message div has no ARIA attributes
- **Recommendation:**
  - Add `role="alert"` to all form message elements
  - Add icons (✓ for success, ⚠ for errors) alongside colour
  - Add "* Required field" legend at top of forms
  - Use CSS classes instead of inline style changes in JS
- **Quick win for `role="alert"`:** Yes

### 9. Improve Event Card Clickability (Medium)
- **Severity:** Medium
- **Why it matters:** Event cards on the events listing page look clickable (hover effects, cursor) but the actual click target is only the small "View Event →" link in the footer. The entire card should be clickable. This creates a frustrating experience where users click the card body and nothing happens.
- **Evidence:**
  - `events-list.js:40-58` — renders cards as `<div class="event-card">` with a link only in the footer
  - `style.css:1361` — `.event-card:hover` has transform/shadow effects suggesting clickability
  - Contrast: chapter cards (`chapters/index.md:14`) are rendered as `<a>` tags wrapping the entire card — good pattern — but event cards don't follow this
- **Recommendation:** Wrap the entire event card in an `<a>` tag (like chapter cards do), or add a JS click handler that navigates to the event page.
- **Quick win:** Yes — JS change in `events-list.js`

### 10. Add Meta Description per Page (Low)
- **Severity:** Low
- **Why it matters:** All pages share the same generic meta description from `base.njk:7`. This hurts SEO and social sharing. Event pages and chapter pages should have unique descriptions.
- **Evidence:** `base.njk:7` — fallback description used everywhere: `"Global Security Community — connecting cybersecurity professionals worldwide..."`
- **Recommendation:** Set `description` in the front matter of each page/template. For events, use the event description. For chapters, describe the chapter location.
- **Quick win:** Yes — front matter additions

---

## Detailed Findings by Category

### 1. Overall Visual Design and First Impression

**What works:**
- Clean, minimal aesthetic with good use of whitespace
- Navy + teal colour scheme is professional and appropriate for cybersecurity
- Consistent card-based layout across different content types
- Good responsive grid system for chapters and events

**What needs work:**
- Homepage feels sparse — hero has a large logo but no headline text
- No visual richness beyond the logo (no illustrations, patterns, or visual interest)
- Emoji used as icons throughout (📅📍🎟️💬📬) look unprofessional and render inconsistently
- `#f5f5f5` card backgrounds on a `#fff` page create very low contrast borders — cards barely stand out
- Footer is a single line — feels unfinished

### 2. Navigation and Information Architecture

**What works:**
- Logical top-level IA: Home, About, Chapters, Events, Contact
- Dynamic nav items based on auth state (Dashboard/Scanner/My Tickets/Wiki/Logout)
- Sticky navbar with hamburger menu on mobile
- Breadcrumb-style back links on event pages

**What needs work:**
- **No active nav state** — users can't tell which page they're on
- **Auth-dependent nav flickers** — `auth-nav.js` runs after page load, so nav items appear asynchronously. On slow connections, the Login link appears then potentially changes to Dashboard/Tickets/Logout.
- **Nav item ordering**: Wiki link only appears when logged in, but it's a public resource. Consider always showing it.
- **No search functionality** — as the event/chapter count grows, users will need search
- **Hamburger button has no accessible label text** — `aria-label="Toggle menu"` is present (good), but the visual is just three CSS lines with no fallback

### 3. Layout Consistency and Spacing

**What works:**
- `.container` with max-width 1200px and 20px padding is consistent
- Card grid system uses `repeat(auto-fit, minmax(300px, 1fr))` — sensible

**What needs work:**
- **Massive inline style usage** — 49+ inline `style=""` attributes override CSS and create inconsistency
- **Inconsistent spacing** between sections — some use `margin-top: 2rem`, some use `4rem`, some rely on `<h2>` default margin
- **Event page info cards** use `style="grid-template-columns: 1fr 1fr 1fr"` inline — will break on narrow screens (no responsive override for 3-col grid at mobile)
- **Registration form** has demographic fields after required fields with no visual separation — the form feels very long
- **Dashboard** uses show/hide sections instead of URL-based routing — losing context on refresh

### 4. Typography, Readability, and Content Scanning

**What works:**
- System font stack is a good choice (fast, native feel)
- `line-height: 1.8` on paragraphs is generous and readable
- Font size hierarchy is generally logical (h1: 2.5rem → h2: 1.8rem → h3: default)

**What needs work:**
- **Hero paragraph has no heading** — scanning users skip right past the value proposition
- **About page values section**: 5 cards all look identical with no visual differentiation — hard to scan
- **Event description** is a single `<p>` tag — long descriptions become a wall of text with no formatting
- **Registration form** has 9 form fields with "About You" fields that feel mandatory despite being optional — no visual distinction between required and demographic
- **Dashboard text**: `"Loading..."` and `"Welcome, admin@example.com"` provide minimal context

### 5. Colour Usage, Contrast, and Visual Hierarchy

**Critical failures:**

| Combination | Ratio | WCAG AA | Usage |
|-------------|-------|---------|-------|
| Teal `#20b2aa` on white | 2.62:1 | ❌ FAIL | All links, h3s, card titles |
| White on teal `#20b2aa` | 2.62:1 | ❌ FAIL | All CTA buttons, badges |
| Teal on `#f5f5f5` | 2.40:1 | ❌ FAIL | Card h3 headings |
| Orange `#ffa500` on white | 1.97:1 | ❌ FAIL | Volunteer role badge |
| `#888` on white | 3.54:1 | ❌ FAIL | Char hints, flip hints |
| `#999` on white | 2.85:1 | ❌ FAIL | Status badges, muted text |

**Passing:**

| Combination | Ratio | WCAG AA |
|-------------|-------|---------|
| Navy `#001f3f` on white | 16.56:1 | ✅ PASS |
| `#333` on white | 12.63:1 | ✅ PASS |
| `#666` on white | 5.74:1 | ✅ PASS |
| White on navy | 16.56:1 | ✅ PASS |

**Recommendation:** Darken teal to `#0e8c84` or darker. Darken orange to `#c47600`. Replace `#888` with `#666`, `#999` with `#767676` (the lightest WCAG AA grey on white).

### 6. Calls to Action and Conversion Clarity

**What works:**
- Hero has two clear CTAs: "View Events" (primary) and "Find Your Chapter" (secondary)
- Event pages have a prominent "Register Now" button
- Chapter pages have "Apply to Lead a Chapter" CTA

**What needs work:**
- **Hero CTAs compete** — "View Events" and "Find Your Chapter" have equal visual weight. Consider making one clearly primary.
- **Event registration requires login** — but the page doesn't explain this upfront. Users click "Register Now", get redirected to login, then must navigate back. Add a note or handle the redirect loop gracefully.
- **"Register Now" button is styled entirely with inline CSS** (`event.njk:30`) — it should use `.btn-cta` or `.hero-btn-primary`
- **Chapter "View Chapter" button** is inside an `<a>` tag that wraps the whole card — the button is redundant (the whole card is a link)
- **Contact form "Send Message"** button has no visual distinction from other buttons — it's the same teal style used everywhere
- **No social proof or urgency signals** — registration count is shown but there's no "X spots remaining" messaging

### 7. Mobile and Tablet Responsiveness

**What works:**
- Hamburger menu with proper `aria-expanded` toggle
- Chapter grid goes 3 → 2 → 1 column at breakpoints
- Event grid has responsive breakpoints at 900px and 600px
- Hero stacks vertically on mobile
- Agenda table converts to card layout on mobile (excellent)

**What needs work:**
- **Event page info cards** use inline `grid-template-columns: 1fr 1fr 1fr` with no responsive breakpoint — three cards will squish on mobile screens
- **Dashboard detail panel** only has a 768px breakpoint (4→2 cols) but no 1-column mobile fallback
- **Registration form demographic selects** don't have consistent widths on mobile
- **"Apply to Lead a Chapter" form**: the country `<select>` has inline styles duplicating what's already in CSS — fragile on mobile
- **Nav menu on mobile**: links have `gap: 0` but `padding: 0.75rem 0` — touch targets may be smaller than 44px
- **Speaker flip cards** at 2-column on mobile (`600px`) may be too small for comfortable interaction
- **No `<meta name="viewport">` issues** — correctly set (good)

### 8. Accessibility Issues

**Good foundations already present:**
- `<html lang="en">` ✅
- Skip-link to `#main-content` ✅
- `:focus-visible` outlines ✅
- `prefers-reduced-motion` ✅
- `aria-live="polite"` on dynamic content ✅
- `aria-label` on hamburger toggle ✅
- `aria-expanded` on nav toggle ✅
- `aria-hidden="true"` on honeypot ✅

**Issues to fix:**

| Issue | Severity | Location |
|-------|----------|----------|
| Primary teal colour fails WCAG AA contrast everywhere | Critical | `style.css:2` |
| Orange, #888, #999 colours fail WCAG AA | High | `style.css:4`, various |
| No `aria-current="page"` on active nav link | Medium | `base.njk:30-35` |
| Form error messages lack `role="alert"` | Medium | All form JS files |
| Speaker flip cards: keyboard inaccessible (click-only, no Enter/Space handler) | Medium | `event-page.js:174` |
| Speaker flip cards: no `role="button"` or `tabindex="0"` | Medium | `event-page.js:149-166` |
| Event cards in listings are not keyboard-navigable (only the inner link is) | Low | `events-list.js:56` |
| QR code images: `alt="QR Code"` is insufficient — should include the ticket code | Low | `my-tickets.js:24` |
| Dashboard show/hide sections: no focus management when switching views | Low | `dashboard.js:7-12` |
| `<img>` in hero has alt="Global Security Community Logo" — decorative, should be `alt=""` if h1 text is added | Low | `index.md:9` |

### 9. Interaction Patterns, Affordances, and States

**What works:**
- Card hover effects (lift + shadow) provide good affordance
- Button disabled states during form submission
- QR scanner with manual fallback
- Ticket cancel confirmation dialog
- Character counters on textareas with colour feedback

**What needs work:**
- **Speaker flip cards** — clever interaction but: (a) no keyboard support, (b) "Tap to flip back" hint only on back, (c) no hint on front that cards are interactive, (d) on mobile touch targets are small
- **Event registration closed state** — the button text changes to "Registration Closed" with grey background and `pointer-events: none`. This removes the button from the interaction entirely but doesn't explain *why* registration is closed. Use a disabled state with a tooltip/text explanation.
- **No confirmation on destructive actions** — ticket cancellation has `confirm()` (good), but there's no undo. The ticket element is removed after 2 seconds (fragile UX).
- **Dashboard section switching** — uses JS show/hide with no URL state. Pressing browser Back doesn't go to the previous section — it leaves the page entirely.
- **Form message styling done in JS** — `register.js:127-128` sets `backgroundColor` and `color` via JS instead of toggling CSS classes. This makes styling inconsistent and harder to maintain.

### 10. Performance Issues Affecting UX

**What works:**
- Static site generation — pages are pre-built HTML, very fast
- Cache-busting via `?v={{ cacheBust }}` query params
- Service worker registered (even though currently gutted)
- Single CSS file — no render-blocking framework CSS
- No JavaScript frameworks — vanilla JS is fast

**What needs work:**
- **html5-qrcode loaded from unpkg CDN** (`scanner/index.md:44`) — this is a 200KB+ library loaded from a third-party CDN on every scanner page load. Consider self-hosting or lazy-loading.
- **Turnstile script loaded on every page** (`base.njk:56`) — `challenges.cloudflare.com/turnstile/v0/api.js` is loaded globally even on pages with no forms. Move it to only the pages that need it (contact, register, chapter-apply).
- **No image optimisation** — logo PNGs are used at various sizes without `srcset` or `<picture>`. The hero logo loads at full resolution even on mobile.
- **PWA manifest declares two icons of the same source image** with different `sizes` (192x192 and 512x512 in `manifest.json:10-18`) — the actual PNG may not match these declared sizes.
- **Client-side rendering for critical content** — events list, chapter events, tickets, and dashboard all render via JavaScript `fetch()` calls. If the API is slow, users see blank pages with "Loading..." text. Consider pre-rendering upcoming events at build time using Eleventy data files.

### 11. Trust Signals, Credibility, and Professionalism

**What works:**
- Professional domain name (globalsecurity.community)
- Microsoft affiliation mentioned in content
- Clear organisational structure (chapters with named leads)
- Gravatar integration for lead photos
- Social links for chapter leads (GitHub, LinkedIn)
- Community Partners section

**What needs work:**
- **No privacy policy or terms of service** links anywhere on the site (despite collecting PII via forms)
- **Minimal footer** — looks unfinished, reduces trust
- **Emoji as icons** — reduces perceived professionalism
- **"Founded in 2025"** on the About page — the organisation is very new. Consider leading with impact metrics (number of chapters, events, attendees) instead of founding date.
- **No testimonials, attendee quotes, or social proof** — the site tells you what GSC does but doesn't show evidence of community activity
- **Event page volunteer cards** appear/disappear dynamically — this can feel jarring
- **"All rights reserved"** in footer — unusual for a nonprofit community; consider a Creative Commons or similar licence if applicable

### 12. Consistency of Components, Patterns, and Page Structure

**What works:**
- Consistent use of `.card`, `.cards`, `.btn-cta` classes across pages
- Event cards have a consistent structure (header/body/footer)
- Chapter cards follow the same pattern
- Form groups use consistent `.form-group` class

**What needs work:**
- **Button styles are inconsistent** — there are 7+ different ways buttons are styled:
  - `.btn-cta` (link-style button)
  - `.btn-link` (another link-style button — nearly identical to `.btn-cta`)
  - `.btn-navy`, `.btn-outline`, `.btn-danger`, `.btn-warning`
  - `.hero-btn-primary`, `.hero-btn-secondary`
  - `.btn-discord`
  - `.event-card-btn`, `.chapter-card-btn`
  - Inline-styled buttons in `event.njk`
  - `button:not(.nav-toggle)` global style
  - Some buttons are `<button>`, some are `<a>` with button classes — no consistent pattern
- **Success/error message styling** is done differently in every form JS file — some use inline styles, some use CSS classes, patterns vary
- **`esc()` function duplicated** in 5 separate JS files — should be a shared utility
- **Date formatting** duplicated across 4 JS files — should be a shared utility
- **Two near-identical button classes**: `.btn-cta` and `.btn-link` have nearly identical styles (both are teal background, white text, 4px radius, 600 weight)

---

## Quick Wins (Implement This Week)

| # | Change | Effort | Impact |
|---|--------|--------|--------|
| 1 | Darken `--color-primary-teal` to `#0e8c84` | 5 min | Critical — fixes contrast across entire site |
| 2 | Add `<h1>` to homepage hero | 5 min | High — communicates purpose instantly |
| 3 | Add `role="alert"` to all form message divs | 15 min | Medium — screen reader accessibility |
| 4 | Add active nav state with `aria-current="page"` | 30 min | Medium — wayfinding |
| 5 | Expand footer with nav links, social links, legal links | 30 min | Medium — trust and navigation |
| 6 | Move Turnstile script to only pages with forms | 15 min | Low — performance |
| 7 | Make event cards fully clickable in events-list.js | 15 min | Medium — usability |
| 8 | Add keyboard support to speaker flip cards | 20 min | Medium — accessibility |
| 9 | Add `* Required field` legend to all forms | 10 min | Low — form clarity |
| 10 | Darken `#888`→`#666`, `#999`→`#767676` for contrast | 10 min | Medium — accessibility |

---

## Longer-Term Improvements

| # | Change | Effort | Impact |
|---|--------|--------|--------|
| 1 | Replace all inline styles with CSS classes | 2-3 hours | High — maintainability + consistency |
| 2 | Replace emoji icons with inline SVGs | 2-3 hours | Medium — visual polish |
| 3 | Add loading skeleton components | 2-3 hours | Medium — perceived performance |
| 4 | Create a shared JS utility module (esc, formatDate, showMessage) | 1-2 hours | Medium — DRY code |
| 5 | Add privacy policy and terms of service pages | 1-2 hours | High — legal/trust requirement |
| 6 | Pre-render events listing at build time | 2-4 hours | Medium — performance + SEO |
| 7 | Add social proof section to homepage (event stats, testimonials) | 2-3 hours | Medium — trust |
| 8 | Implement URL-based routing for dashboard sections | 3-4 hours | Medium — UX |
| 9 | Unify button component system (reduce 7+ variants to 3-4) | 2-3 hours | Medium — consistency |
| 10 | Self-host html5-qrcode library | 30 min | Low — performance + reliability |

---

## Prioritised Action Plan

| Priority | Item | Category | Effort | Impact | Type |
|----------|------|----------|--------|--------|------|
| **P0** | Fix teal colour contrast (`#20b2aa` → `#0e8c84`) | Accessibility | 5 min | Critical | Quick win |
| **P0** | Fix secondary colour contrast (#888, #999, orange) | Accessibility | 15 min | High | Quick win |
| **P1** | Add homepage `<h1>` headline | UX / First impression | 5 min | High | Quick win |
| **P1** | Add `role="alert"` to form messages | Accessibility | 15 min | Medium | Quick win |
| **P1** | Add active nav state + `aria-current` | Navigation / A11y | 30 min | Medium | Quick win |
| **P1** | Add privacy policy / terms of service | Trust / Legal | 1-2 hours | High | New pages |
| **P2** | Expand footer content | Trust / Navigation | 30 min | Medium | Quick win |
| **P2** | Make event cards fully clickable | Usability | 15 min | Medium | Quick win |
| **P2** | Add keyboard support to speaker cards | Accessibility | 20 min | Medium | Quick win |
| **P2** | Move Turnstile to form pages only | Performance | 15 min | Low | Quick win |
| **P3** | Replace inline styles with CSS classes | Maintainability | 2-3 hours | High | Refactor |
| **P3** | Replace emoji with SVG icons | Visual polish | 2-3 hours | Medium | Redesign |
| **P3** | Add loading skeletons | Perceived perf | 2-3 hours | Medium | Enhancement |
| **P3** | Shared JS utility module | Code quality | 1-2 hours | Medium | Refactor |
| **P3** | Unify button component system | Consistency | 2-3 hours | Medium | Refactor |
| **P4** | Pre-render events at build time | Performance / SEO | 2-4 hours | Medium | Architecture |
| **P4** | Add social proof to homepage | Trust / Conversion | 2-3 hours | Medium | Content |
| **P4** | Dashboard URL-based routing | UX | 3-4 hours | Medium | Enhancement |
| **P4** | Self-host QR code library | Performance | 30 min | Low | Quick win |
| **P4** | Per-page meta descriptions | SEO | 30 min | Low | Quick win |

---

## Additional Notes

### What the site does well
- **Security-first approach**: CSP headers are comprehensive and well-configured. HSTS, X-Frame-Options, Referrer-Policy all set correctly. Turnstile bot protection on forms. Input sanitisation on the backend. This is a cybersecurity community site that practices what it preaches.
- **Accessibility foundations**: Skip link, focus-visible, prefers-reduced-motion, aria-live, aria-expanded — the intent is clearly there, which makes the colour contrast failure all the more fixable.
- **Clean architecture**: Static site + serverless API is the right choice. No unnecessary JavaScript frameworks. Fast page loads. Sensible caching strategy.
- **Event lifecycle management**: Published → Closed → Completed status flow. Registration caps. QR check-in. Ticket management. This is well-thought-out.

### Does the homepage communicate purpose quickly?
**No.** The hero has a large logo and a paragraph, but no headline. A user must read the paragraph to understand what GSC is. The logo alone doesn't communicate "cybersecurity community". Adding a single `<h1>` line solves this.

### Does the design feel dated, cluttered, sparse, inconsistent, or confusing?
**Sparse and slightly inconsistent.** The design is clean but lacks visual richness. It feels like a well-structured wireframe that hasn't received a visual design pass. The inconsistency comes primarily from inline styles overriding the CSS system and emoji icons mixed with SVG icons.

### Does the content structure support how real users scan pages?
**Mostly yes, with gaps.** Cards and grids work well for scanning. However, the homepage lacks a clear visual hierarchy (no h1), event descriptions are unformatted single paragraphs, and the registration form's optional demographic fields feel mandatory because they're visually identical to required fields.

### Does the UI feel cohesive or assembled by committee?
**Slightly assembled** — the core design system (cards, buttons, colour palette) is cohesive, but the inline styles, emoji icons, and inconsistent button patterns suggest different features were added at different times without a full design review. The underlying system is solid; it just needs a consistency pass.
