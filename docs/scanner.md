# Event Check-In Scanner

The Scanner page provides a QR code scanning tool for checking in attendees at events.

## URL

`/scanner/?event={event-slug}`

## Access

Requires the **admin** or **volunteer** role. Chapter leads and assigned volunteers can access the scanner.

## Features

- **Camera scanning** — Uses the device camera to scan QR codes from attendee tickets
- **Manual entry** — Fallback text input for entering ticket codes manually (e.g. if QR code won't scan)
- **Duplicate detection** — If a ticket has already been scanned, displays a warning instead of checking in again
- **Live statistics** — Shows real-time count of checked-in vs registered attendees
- **Scan debounce** — 5-second cooldown after scanning the same code to prevent accidental double-scans

## How Volunteers Access the Scanner

1. A chapter lead adds the volunteer's email to the event via the [Dashboard](/dashboard/) (under "Volunteers / Committee")
2. The volunteer logs in to the GSC website
3. They see a **Scanner** link in the navigation bar
4. They open the scanner, select the event, and begin checking in attendees

> **Note:** Volunteers can only scan tickets — they cannot create events, view attendance reports, or manage other settings.

## How to Use

1. Open the Scanner page on your phone or tablet
2. Select the event from the dropdown (or navigate from the Dashboard)
3. Grant camera permission when prompted
4. Point the camera at the attendee's QR code
5. The system validates the ticket and confirms check-in
6. If the QR code won't scan, use the manual entry field to type the 8-character ticket code

## Camera Permissions

The scanner requires camera access. The website is configured with the appropriate permissions policy to allow this. If the browser asks for camera permission, tap "Allow".

> **Tip:** For the best experience, use the scanner in a well-lit area and hold the camera steady about 15-20cm from the QR code.

## PWA Support

The scanner works as a Progressive Web App. Add the website to your home screen for a full-screen scanning experience without browser chrome.

## Related Pages

- [Dashboard](dashboard.md) — Event management and attendance overview
- [My Tickets](my-tickets.md) — Where attendees find their QR codes
- [Registration](registration.md) — How attendees get their tickets
