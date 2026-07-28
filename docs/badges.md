# Digital Badges

GSC issues digital badges to recognise participation in events.

## Badge Types

| Badge | Issued To | Description |
|-------|-----------|-------------|
| **Attendee** | Event attendees | Awarded to registered attendees who checked in at the event |
| **Volunteer** | Event volunteers | Awarded to volunteers who helped run the event |
| **Speaker** | Event speakers | Awarded to presenters and session leaders |
| **Sponsor** | Event sponsors | Awarded to community partners supporting the event |
| **Organiser** | Chapter leads | Awarded to event organisers |

## Badge Design

Badges are generated as PNG images (with SVG fallback) featuring GSC branding:

- AI-generated event background image (when enabled) or gradient fallback
- GSC logo and colours (teal, navy)
- Badge type pill (Attendee / Volunteer / Speaker / Sponsor / Organiser)
- Event title, date, and location
- Recipient's name
- "Verified by Global Security Community" footer

## How Badge Artwork is Generated

The dashboard's badge artwork button generates the shared event artwork used as the background for badge emails. The current artwork generation flow creates and saves three event artwork variants:

- **Attendee artwork** → saved to the event as `badgeImageUrl`
- **Speaker artwork** → saved to the event as `speakerBadgeImageUrl`
- **Organiser artwork** → saved to the event as `organiserBadgeImageUrl`

These artwork files are then downloaded and composited into the final badge PNGs when badges are issued.

## How Badges Are Issued

1. After an event is completed, an admin opens the [Dashboard](/dashboard/)
2. They select the event and click "Mark Complete"
3. The system generates personalised badges for each checked-in attendee
4. Badges are emailed to recipients from `DoNotReply@globalsecurity.community`
5. Recipients can also download their badge via the API

## Role to artwork mapping

| Registration role | Final badge type emailed | Artwork used |
|-------------------|--------------------------|--------------|
| `attendee` | Attendee | `badgeImageUrl` / Attendee artwork |
| `volunteer` | Volunteer | `badgeImageUrl` / Attendee artwork |
| `speaker` | Speaker | `speakerBadgeImageUrl` / Speaker artwork |
| `organiser` | Organiser | `organiserBadgeImageUrl` / Organiser artwork |
| `sponsor` | Sponsor | `badgeImageUrl` / Attendee artwork |

In other words, the system can email Volunteer and Sponsor badges, but those roles currently reuse the attendee artwork background rather than having their own dedicated generated artwork variant.

## AI Image Generation

Badge background images can be AI-generated using city landmarks and cybersecurity visual elements. This feature is currently enabled in the badge artwork workflow.

The implementation uses the configured AI provider in `api/src/helpers/aiProvider.js`.

## Related Pages

- [Dashboard](dashboard.md) — Where admins issue badges
- [Scanner](scanner.md) — Check-in data determines who receives attendee badges
- [Events](events.md) — Browse events
