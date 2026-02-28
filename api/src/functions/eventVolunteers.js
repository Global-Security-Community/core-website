const { getAuthUser, hasRole, unauthorised, forbidden } = require('../helpers/auth');
const { storeVolunteer, getVolunteersByEvent, removeVolunteer } = require('../helpers/tableStorage');
const { stripHtml } = require('../helpers/sanitise');
const crypto = require('crypto');

/**
 * GET /api/eventVolunteers?eventId={eventId}
 * Admin-only: list volunteers for an event.
 *
 * POST /api/eventVolunteers
 * Admin-only: add a volunteer to an event.
 *
 * DELETE /api/eventVolunteers
 * Admin-only: remove a volunteer from an event.
 */
module.exports = async function (request, context) {
  try {
    const user = getAuthUser(request);
    if (!user) return unauthorised();
    if (!hasRole(user, 'admin')) return forbidden('Only chapter leads can manage volunteers');

    if (request.method === 'GET') {
      const url = new URL(request.url);
      const eventId = url.searchParams.get('eventId');
      if (!eventId) {
        return { status: 400, headers: { 'Content-Type': 'application/json' },
                 body: JSON.stringify({ error: 'Missing eventId' }) };
      }
      const volunteers = await getVolunteersByEvent(eventId);
      return {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          volunteers: volunteers.map(v => ({
            id: v.rowKey,
            email: v.email,
            name: v.name,
            addedAt: v.addedAt
          }))
        })
      };
    }

    if (request.method === 'POST') {
      let body;
      try { body = await request.json(); } catch {
        return { status: 400, headers: { 'Content-Type': 'application/json' },
                 body: JSON.stringify({ error: 'Invalid JSON' }) };
      }
      const { eventId, email, name } = body;
      if (!eventId || !email) {
        return { status: 400, headers: { 'Content-Type': 'application/json' },
                 body: JSON.stringify({ error: 'Missing eventId or email' }) };
      }

      const volunteer = await storeVolunteer({
        id: crypto.randomUUID(),
        eventId,
        email: stripHtml(email),
        name: stripHtml(name || ''),
        addedBy: user.userDetails
      });

      context.log(`Volunteer ${email} added to event ${eventId} by ${user.userDetails}`);
      return {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: true, volunteer: { id: volunteer.rowKey, email: volunteer.email, name: volunteer.name } })
      };
    }

    if (request.method === 'DELETE') {
      let body;
      try { body = await request.json(); } catch {
        return { status: 400, headers: { 'Content-Type': 'application/json' },
                 body: JSON.stringify({ error: 'Invalid JSON' }) };
      }
      const { eventId, volunteerId } = body;
      if (!eventId || !volunteerId) {
        return { status: 400, headers: { 'Content-Type': 'application/json' },
                 body: JSON.stringify({ error: 'Missing eventId or volunteerId' }) };
      }
      await removeVolunteer(eventId, volunteerId);
      context.log(`Volunteer ${volunteerId} removed from event ${eventId} by ${user.userDetails}`);
      return {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: true })
      };
    }

    return { status: 405, headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify({ error: 'Method not allowed' }) };
  } catch (error) {
    context.log(`eventVolunteers error: ${error.message}`);
    return { status: 500, headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify({ error: 'Internal server error' }) };
  }
};
