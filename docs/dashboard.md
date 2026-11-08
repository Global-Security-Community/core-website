# Chapter Lead Dashboard

The Dashboard is the management hub for chapter leads to create and manage events.

## URL

`/dashboard/`

## Access

Requires the **admin** role. Only approved chapter leads are automatically assigned this role. Other users will receive a 403 Forbidden response.

> **How admin role works:** When a user logs in, the system checks if their email matches an approved chapter lead in the database. If it does, they are automatically assigned the admin role.

## Features

### Event Management

- **Create Event** — Form to create a new bootcamp event with:
  - Event title
  - Start and end dates
  - Location
  - Description
  - Registration capacity (0 = unlimited)
  - Sessionize API ID (optional, for agenda/speaker integration)
  - Chapter association

- **Event List** — View all events you've created with current registration counts

- **Event Status** — Update event status (open, closed, completed)

### Volunteers / Committee

- **Add Volunteers** — Assign volunteers or committee members to an event by entering their name and email
- **Volunteer Access** — Volunteers get access to the QR check-in scanner for the event without full admin privileges
- **Remove Volunteers** — Remove volunteer access at any time from the event detail view

> **Note:** Volunteers must have a GSC account (signed up via the website). When they log in, the system automatically detects their email and grants them the volunteer role.

### Attendance

- **Attendance Dashboard** — Real-time view of check-ins for an event:
  - Total registered vs checked-in count
  - Individual attendee check-in status
- **CSV Export** — Download a CSV of all registrations for reporting
- **Scanner Link** — Quick link to the QR scanner page for event-day check-in

### Badges

- **Issue Badges** — After an event, generate and email digital badges to:
  - Attendees (who checked in)
  - Speakers
  - Sponsors
  - Organisers / Volunteers

> **Note:** AI-generated badge background images are currently disabled. Badges use a gradient fallback. See [Badges](badges.md) for details.

## Event Creation Flow

1. Fill in the event details on the dashboard
2. Click "Create Event"
3. The system saves a draft and queues a GitHub Action to generate and test the event page
4. The generated page merges into `main`, then is copied alone into a protected production pull request
5. After all required checks and production deployment succeed, the system verifies the event-specific page content
6. The event becomes published and notification emails are sent to chapter subscribers

The progress panel reflects confirmed stages rather than elapsed time or an HTTP 200 response.
Missing event URLs can return the homepage, so status alone is not proof of publication.
Publication takes several minutes, and you can return to the draft event and choose
**View publication progress** while it is running.

If publication fails, the event remains saved. Use **Retry publication** in the progress panel
or **Publish Event** on the draft to retry the same event. The workflow link identifies failed
checks or deployment. **Check progress** refreshes a delayed or unavailable status without
starting another workflow. Subscriber delivery failures are shown separately from publication.

## Related Pages

- [Events](events.md) — Public event listings
- [Scanner](scanner.md) — QR code check-in tool
- [Badges](badges.md) — Digital badge system
- [Chapter Lead Application](chapter-application.md) — How to become a chapter lead
