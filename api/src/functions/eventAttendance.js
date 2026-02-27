const { getAuthUser, hasRole, unauthorised, forbidden } = require('../helpers/auth');
const { getRegistrationsByEvent, countRegistrations, getEvent, listEvents, updateEvent } = require('../helpers/tableStorage');

/**
 * GET /api/eventAttendance?eventId={eventId}&chapterSlug={chapterSlug}
 * Admin-only: get attendance list for export.
 *
 * GET /api/eventAttendance?action=list&chapterSlug={chapterSlug}
 * Admin-only: list events for a chapter (used by dashboard).
 *
 * POST /api/eventAttendance
 * Admin-only: update event status (close registration, mark completed).
 */
module.exports = async function (request, context) {
  try {
    const user = getAuthUser(request);
    if (!user) return unauthorised();
    if (!hasRole(user, 'admin')) return forbidden('Only event organisers can access attendance');

    const url = new URL(request.url);

    if (request.method === 'POST') {
      // Update event status
      let body;
      try { body = await request.json(); } catch {
        return { status: 400, headers: { 'Content-Type': 'application/json' },
                 body: JSON.stringify({ error: 'Invalid JSON' }) };
      }
      const { eventId, chapterSlug, status } = body;
      if (!eventId || !chapterSlug || !status) {
        return { status: 400, headers: { 'Content-Type': 'application/json' },
                 body: JSON.stringify({ error: 'Missing eventId, chapterSlug, or status' }) };
      }
      if (!['published', 'closed', 'completed'].includes(status)) {
        return { status: 400, headers: { 'Content-Type': 'application/json' },
                 body: JSON.stringify({ error: 'Invalid status. Must be published, closed, or completed' }) };
      }
      const updated = await updateEvent(chapterSlug, eventId, { status });
      return { status: 200, headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify({ success: true, event: { id: eventId, status: updated.status } }) };
    }

    // GET requests
    const action = url.searchParams.get('action');
    const chapterSlug = url.searchParams.get('chapterSlug');

    if (action === 'list') {
      // List events for dashboard
      const events = await listEvents(chapterSlug || undefined);
      const enriched = [];
      for (const ev of events) {
        const count = await countRegistrations(ev.rowKey);
        enriched.push({
          id: ev.rowKey,
          title: ev.title,
          slug: ev.slug,
          chapterSlug: ev.chapterSlug || ev.partitionKey,
          date: ev.date,
          location: ev.location,
          status: ev.status,
          registrationCap: ev.registrationCap || 0,
          registrationCount: count
        });
      }
      return { status: 200, headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify({ events: enriched }) };
    }

    // Attendance detail
    const eventId = url.searchParams.get('eventId');
    if (!eventId) {
      return { status: 400, headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify({ error: 'Missing eventId parameter' }) };
    }

    const registrations = await getRegistrationsByEvent(eventId);
    const total = registrations.length;
    const checkedIn = registrations.filter(r => r.checkedIn).length;

    const format = url.searchParams.get('format');
    if (format === 'csv') {
      const header = 'Name,Email,Ticket Code,Checked In,Checked In At,Registered At\n';
      const rows = registrations.map(r =>
        `"${(r.fullName || '').replace(/"/g, '""')}","${r.email || ''}","${r.ticketCode}","${r.checkedIn ? 'Yes' : 'No'}","${r.checkedInAt || ''}","${r.registeredAt || ''}"`
      ).join('\n');
      return {
        status: 200,
        headers: { 'Content-Type': 'text/csv', 'Content-Disposition': `attachment; filename="attendance-${eventId}.csv"` },
        body: header + rows
      };
    }

    return {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventId,
        total,
        checkedIn,
        attendees: registrations.map(r => ({
          name: r.fullName,
          email: r.email,
          ticketCode: r.ticketCode,
          checkedIn: r.checkedIn || false,
          checkedInAt: r.checkedInAt || '',
          registeredAt: r.registeredAt
        }))
      })
    };
  } catch (error) {
    context.log(`eventAttendance error: ${error.message}`);
    return { status: 500, headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify({ error: 'Internal server error' }) };
  }
};
