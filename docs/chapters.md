# Chapters

The Chapters page lists all active GSC chapters around the world.

## URL

`/chapters/`

## Features

- **Interactive map** — Leaflet.js map with OpenStreetMap tiles showing all chapter locations as markers. Users can click a marker to highlight and scroll to the corresponding chapter card
- **Chapter listing** — Scrollable card grid below the map, displaying all approved chapters with their city, country, and the GSC shield logo. Clicking/hovering a card highlights its marker on the map
- **Bidirectional interaction** — Map markers and chapter cards are linked: marker click → highlights card + scrolls into view; card hover → highlights marker + shows popup
- **Chapter detail pages** — Each chapter has a dedicated page at `/chapters/{city-slug}/` showing:
  - Chapter banner image (AI-generated, when available)
  - Chapter leads with profile photos (via Gravatar)
  - Upcoming events hosted by the chapter
  - Chapter event notification subscription
  - Community partners across all chapter events
  - Link to the chapter's Discord channel
- **Apply to lead** — Call-to-action for community members to apply to start a new chapter

## Chapter Coordinates

Each chapter's `index.md` frontmatter includes `latitude` and `longitude` fields used by the map:
- **New chapters:** Auto-geocoded via Nominatim API in the `generate-chapter.yml` workflow
- **Existing chapters:** Coordinates preserved when chapter leads are edited via `updateChapter`
- **Fallback:** If geocoding fails, coordinates default to `0, 0` with a workflow warning

## Map Technology

- **Leaflet.js 1.9.4** — loaded from `cdn.jsdelivr.net`
- **OpenStreetMap tiles** — free, no API key required (`tile.openstreetmap.org` in CSP `img-src`)
- **Custom markers** — SVG pins in GSC branding colours (teal/navy)
- **Scroll zoom** — disabled by default to prevent accidental zoom while scrolling; enabled on map focus

## How New Chapters Are Created

Chapters are created through the [Chapter Lead Application](chapter-application.md) process. When an application is approved, a chapter page is automatically generated (with geocoded coordinates) and added to the chapters listing.

## Related Pages

- [Chapter Lead Application](chapter-application.md) — Apply to start a chapter
- [Events](events.md) — Events hosted by chapters
- [Dashboard](dashboard.md) — Chapter lead management tools
