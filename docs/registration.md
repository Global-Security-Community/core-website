# Event Registration

The Registration page allows authenticated users to register for GSC events.

## URL

`/register/?event={event-slug}`

## Access

Requires login. Unauthenticated users are redirected to the login page.

## Registration Flow

1. User clicks "Register" on an event page
2. They are taken to the registration form (or prompted to log in first)
3. The form pre-fills their email from their account
4. User completes the demographic information
5. On submission, the system:
   - Validates event capacity and prevents duplicate registrations
   - Generates a unique ticket code and QR code
   - Stores the registration and demographic data separately (for privacy)
   - Sends a confirmation email with the QR ticket to the user's email

## Demographic Information Captured

The following information is collected during registration to help GSC report on community demographics:

| Field | Required | Purpose |
|-------|----------|---------|
| Full Name | Yes | Identification and badge generation |
| Email | Yes | Pre-filled from account, used for ticket delivery |
| Employment Status | Yes | Demographic reporting |
| Industry | Yes | Demographic reporting |
| Job Title | Yes | Demographic reporting |
| Company Size | Yes | Demographic reporting |
| Experience Level | Yes | Demographic reporting |

> **Privacy note:** Demographic data is stored separately from personal information in a dedicated table. This allows GSC to retain anonymised demographic reports while purging personal data when no longer needed.

## Ticket

After successful registration, the user receives:

- **On-screen QR code** — Displayed immediately after registration
- **Email confirmation** — Sent to their registered email with the QR code attached
- **My Tickets page** — All tickets are accessible at `/my-tickets/`

The QR code contains a unique 8-character alphanumeric ticket code used for check-in on event day.

## Capacity Management

- If an event has a registration cap and it's reached, the form displays a "capacity reached" message
- If the event status is "closed" or "completed", the form displays a "registration closed" message
- Duplicate registrations for the same event are blocked

## Related Pages

- [Events](events.md) — Browse and find events
- [My Tickets](my-tickets.md) — View your registered tickets
- [Scanner](scanner.md) — How tickets are scanned on event day
