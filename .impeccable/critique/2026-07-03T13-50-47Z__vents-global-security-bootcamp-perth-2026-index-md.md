---
target: src/events/global-security-bootcamp-perth-2026/index.md
total_score: 34
p0_count: 0
p1_count: 0
timestamp: 2026-07-03T13-50-47Z
slug: vents-global-security-bootcamp-perth-2026-index-md
---
## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 4 | Skeleton loaders, timeout fallbacks, urgency indicator |
| 2 | Match System / Real World | 4 | Human date, venue name in card, full address in context |
| 3 | User Control and Freedom | 3 | Breadcrumbs, share/calendar affordances; no back-to-top |
| 4 | Consistency and Standards | 4 | Follows GSC design system tokens; consistent class patterns |
| 5 | Error Prevention | 3 | Login redirect, timeout, skip 0,0 maps |
| 6 | Recognition Rather Than Recall | 4 | Icons + labels, calendar/share clearly labeled |
| 7 | Flexibility and Efficiency | 4 | Add to Calendar, Share (native + fallback), direct chapter link |
| 8 | Aesthetic and Minimalist Design | 3 | Clean, content-focused; needs more visual rhythm |
| 9 | Error Recovery | 3 | Retry button, "Unable to load" states |
| 10 | Help and Documentation | 2 | No FAQ, no "what to expect" guidance |
| **Total** | | **34/40** | **Good (high)** |

## Anti-Patterns Verdict

LLM: No AI slop. Follows GSC design system. Teal for interactivity, navy for headings.
Detector: Clean — 0 findings.

## What's Working

1. Progressive enhancement: SSR → JS hydration → graceful degradation
2. Action density: Register, Share, Add to Calendar in first viewport
3. Information hierarchy: Header → cards → description → agenda → location

## Priority Issues

[P3] No visual rhythm between sections — flat h2 sequence, no spacing variation
[P3] No social proof — "72 registered" is data, not excitement
[P3] Help/Documentation gap — no FAQ for first-timers

## Persona Red Flags

Jordan (First-Timer): Minor — "Is this for me?" requires reading full description
Sam (Chapter Lead): Share button solves key friction
Riley (Mobile): Location truncation prevents card overflow

## Minor Observations

- data-event-date/location attributes unused by JS currently
- og:url hardcoded to root domain, not event URL (pre-existing)
- is-hidden sections: screen readers with CSS disabled see empty headings
