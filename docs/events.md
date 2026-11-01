# Events

The Events page lists all upcoming and past bootcamp events hosted by GSC chapters worldwide.

## URL

`/events/`

## Features

- **Event listing** — Automatically displays all published events with title, date, location, and chapter
- **Status indicators** — Events show whether registration is open, closed, or the event is completed
- **Direct links** — Each event card links to its dedicated event page with full details

## How Events Are Created

Events are created by chapter leads (admin users) through the [Dashboard](/dashboard/). When a new event is created:

1. The chapter lead fills in the event details (title, date, location, capacity, Sessionize API ID)
2. The system stores the event as a draft in Azure Table Storage and queues page publication
3. A GitHub Action generates and tests the page, then squash-merges it into `main`
4. An isolated production pull request releases only that event page after required checks pass
5. The system confirms production deployment and verifies that the URL contains this event's page, not the homepage fallback
6. The event is marked published and chapter subscribers are emailed

Publication takes several minutes. The dashboard shows actual generation and deployment
progress, with a workflow link and retry action if publication fails or stops reporting.
Retrying publication reuses the saved event rather than creating a duplicate. A subscriber
email failure does not undo a verified publication and is reported separately.

## Event Detail Pages

Each event has its own page at `/events/{slug}/` which includes:

- **Event information** — Title, date, location, description
- **Registration count** — Live count of registered attendees vs capacity
- **Register button** — Links to the registration page (requires login)
- **Sessionize integration** — If a Sessionize API ID is configured, the page automatically fetches and displays:
  - Session agenda / schedule
  - Speaker profiles and bios

## Related Pages

- [Registration](registration.md) — How attendees register for events
- [Dashboard](dashboard.md) — How chapter leads manage events
- [Scanner](scanner.md) — QR code check-in on event day
