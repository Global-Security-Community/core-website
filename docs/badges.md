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

## How Badges Are Issued

1. After an event is completed, an admin opens the [Dashboard](/dashboard/)
2. They select the event and click "Mark Complete"
3. The system generates personalised badges for each checked-in attendee
4. Badges are emailed to recipients from `DoNotReply@globalsecurity.community`
5. Recipients can also download their badge via the API

## Downloading Your Badge

Badges are available for download at:

`/api/badge?eventId={event-id}&badgeId={badge-id}`

You must be logged in to download your badge. Only badge recipients and admins can access badge downloads.

## AI Image Generation (Currently Disabled)

Badge background images can be AI-generated using city landmarks and cybersecurity visual elements. This feature is **temporarily disabled** while the workflow is being improved.

When re-enabled, the system supports multiple AI providers via `api/src/helpers/aiProvider.js`:

| Provider | Env Var | Description |
|----------|---------|-------------|
| `openai` (default) | `OPENAI_API_KEY` | OpenAI API platform (gpt-image-1, DALL-E) |
| `azure` | `AZURE_AI_ENDPOINT` + `AZURE_AI_KEY` | Azure AI Foundry (FLUX, custom deployments) |

Set `AI_PROVIDER` env var to switch between providers. See `api/src/helpers/aiProvider.js` for configuration details.

## Related Pages

- [Dashboard](dashboard.md) — Where admins issue badges
- [Scanner](scanner.md) — Check-in data determines who receives attendee badges
- [Events](events.md) — Browse events
