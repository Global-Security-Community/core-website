---
target: "https://globalsecurity.community/events/global-security-bootcamp-perth-2026/"
total_score: 22
p0_count: 0
p1_count: 2
timestamp: 2026-07-03T13-29-26Z
slug: mmunity-events-global-security-bootcamp-perth-2026
---
## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2 | "Loading..." text with no skeleton/spinner for registration count, agenda, and speakers |
| 2 | Match System / Real World | 3 | Date displays raw 2026-08-01 instead of human-readable format |
| 3 | User Control and Freedom | 3 | Good breadcrumbs, but no add-to-calendar or share |
| 4 | Consistency and Standards | 3 | Info cards follow platform conventions |
| 5 | Error Prevention | 1 | No indication of registration capacity status before clicking Register Now |
| 6 | Recognition Rather Than Recall | 3 | Good labelling on info cards; breadcrumbs help orientation |
| 7 | Flexibility and Efficiency | 1 | No add-to-calendar, copy-link, or quick share |
| 8 | Aesthetic and Minimalist Design | 3 | Clean layout; description renders as raw comma-separated string |
| 9 | Error Recovery | 1 | Loading states with no timeout, retry, or fallback |
| 10 | Help and Documentation | 2 | No explanation of bootcamp format, no post-registration guidance |
| **Total** | | **22/40** | **Acceptable (low end)** |

## Anti-Patterns Verdict

LLM assessment: No absolute-ban patterns detected. The page does not look AI-generated. The page-kicker eyebrow is borderline acceptable as a functional differentiator.

Deterministic scan: 0 findings on both source files.

## Priority Issues

**[P1] Event description renders as broken plaintext on SSR**
- Frontmatter description shows commas as literal characters where line breaks should be
- Fix: Parse separators or show skeleton until JS loads rich text
- Suggested command: /impeccable harden src/_includes/layouts/event.njk

**[P1] Loading states with no timeout or failure handling**
- Registration count, agenda, speakers show "Loading..." indefinitely on failure
- Fix: Add skeleton states and 10-second timeout with fallback message
- Suggested command: /impeccable harden src/js/event-page.js

**[P2] Date displayed as raw ISO string**
- Users expect human-readable dates
- Fix: Format with Eleventy filter or JS
- Suggested command: /impeccable clarify src/_includes/layouts/event.njk

**[P2] No Add to Calendar or sharing affordance**
- Core functionality missing for driving attendance
- Fix: Add .ics generation and share/copy-link button
- Suggested command: /impeccable craft add-to-calendar

**[P3] No registration status indication before clicking CTA**
- User discovers full/closed only after navigating away
- Fix: Show X of Y spots with progress indicator
- Suggested command: /impeccable harden src/js/event-page.js

## Persona Red Flags

**Jordan (First-Timer)**: Description is incomprehensible in comma-separated format. No explanation of what to expect at a bootcamp.

**Casey (Mobile User)**: Register Now button at top may leave thumb zone after scrolling. No repeated CTA lower on page.

**Sam (Accessibility-Dependent)**: Breadcrumb uses ← arrow entity instead of semantic "Back to" label. Dynamic Sessionize content may not announce properly.

## Minor Observations

- og:url points to root instead of specific event URL
- og:description contains comma-mangled text (bad social previews)
- Location repeated 3 times on page
- Event Team section hidden by JS — invisible if JS fails
- Two uppercase tracked eyebrows on same template (page-kicker + section-kicker)
