---
target: src/events/global-security-bootcamp-perth-2026/index.md
total_score: 30
p0_count: 0
p1_count: 0
timestamp: 2026-07-03T13-42-47Z
slug: vents-global-security-bootcamp-perth-2026-index-md
---
## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Skeleton loaders show activity; timeout → error state |
| 2 | Match System / Real World | 4 | Human-readable date, familiar event page patterns |
| 3 | User Control and Freedom | 3 | Breadcrumbs for escape; no back-to-top on long pages |
| 4 | Consistency and Standards | 3 | Info cards, CTA placement follow conventions |
| 5 | Error Prevention | 3 | Login redirect preserves intent; timeout prevents zombie states |
| 6 | Recognition Rather Than Recall | 3 | Icons + labels on info cards; calendar button labeled clearly |
| 7 | Flexibility and Efficiency | 3 | Add to Calendar shortcut; no share affordance yet |
| 8 | Aesthetic and Minimalist Design | 3 | Clean layout, content-focused, no excess chrome |
| 9 | Error Recovery | 3 | Retry button on failed loads; graceful fallback |
| 10 | Help and Documentation | 2 | No contextual help; no FAQ for event questions |
| **Total** | | **30/40** | **Good** |

## Anti-Patterns Verdict

LLM assessment: The page does not look AI-generated. Follows GSC design system faithfully. No gradient text, no side-stripes, no identical card grids.

Deterministic scan: Clean — 0 findings on event page template and markdown.

## What's Working

1. Progressive enhancement done right: SSR renders readable content immediately; JS hydrates with rich data. Timeout protects against API failures.
2. Add to Calendar: practical utility saving users from manually typing event details.
3. Registration status indicators: "X spots left" and "Full" badges communicate urgency proactively.

## Priority Issues

[P2] No share/social affordance — community events grow through word-of-mouth. No share button, no copy-link.
[P2] Long location string overflows on mobile — "Microsoft Perth ENEX 100 Building, 10/100 St Georges Terrace, Perth WA" wraps awkwardly at 320px.
[P3] No contextual help or FAQ — first-time attendees have unanswered questions.
[P3] Hidden sections show nothing on SSR — Event Team/Partners invisible if JS fails.

## Persona Red Flags

Jordan (First-Timer): No issues — clear date, location, description, prominent CTA.
Sam (Chapter Lead sharing): No share button. Must manually copy URL.
Riley (Mobile user): Location card text too long on mobile; Leaflet heavy for single marker.

## Minor Observations

- onclick="location.reload()" on retry buttons should use event listener (CSP compliance)
- community-partners uses style.display='block' — should use is-hidden class toggle
- Map loads Leaflet even for 0,0 coordinates (geocoding failure)
