# Digital Badges

GSC issues digital badges to recognise participation in events.

## Badge Types

| Badge | Issued To | Description |
|-------|-----------|-------------|
| **Attendee** | Event attendees | Awarded to registered attendees who checked in at the event |
| **Speaker** | Event speakers | Awarded to presenters and session leaders |
| **Organiser** | Chapter leads & volunteers | Awarded to event organisers and volunteers |

## Badge Design

Badges are generated as SVG images with GSC branding:

- GSC logo and colours (teal, navy)
- Badge type (Attendee / Speaker / Organiser)
- Event title
- Event date
- Recipient's name

## How Badges Are Issued

1. After an event is completed, the chapter lead opens the [Dashboard](/dashboard/)
2. They select the event and click "Issue Badges"
3. The system generates personalised SVG badges for each recipient
4. Badges are emailed to recipients from `DoNotReply@globalsecurity.community`
5. Recipients can also download their badge from the website at any time

## Downloading Your Badge

Badges are available for download at:

`/api/badge?eventSlug={event-slug}`

You must be logged in to download your badge. Only badge recipients and admins can access badge downloads.

## Related Pages

- [Dashboard](dashboard.md) — Where chapter leads issue badges
- [Scanner](scanner.md) — Check-in data determines who receives attendee badges
- [Events](events.md) — Browse events
