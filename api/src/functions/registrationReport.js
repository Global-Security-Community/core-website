const { getAuthUser, hasRole, unauthorised, forbidden, isSuperAdmin, resolveEmail } = require('../helpers/auth');
const { listEvents, getEventById, getRegistrationsByEvent, getDemographicsByEvent } = require('../helpers/tableStorage');

function csvCell(value) {
  const s = String(value || '');
  const safe = /^[=+\-@\t\r]/.test(s) ? "'" + s : s;
  return `"${safe.replace(/"/g, '""')}"`;
}

function boolLabel(value) {
  return value === true || value === 'true' ? 'Yes' : 'No';
}

async function buildRows(events) {
  const rows = [];

  for (const event of events) {
    const eventId = event.rowKey;
    const [registrations, demographics] = await Promise.all([
      getRegistrationsByEvent(eventId),
      getDemographicsByEvent(eventId)
    ]);
    const demographicsByRegistration = new Map(demographics.map(d => [d.rowKey, d]));

    registrations.forEach(registration => {
      const demo = demographicsByRegistration.get(registration.rowKey) || {};
      rows.push({
        eventId,
        eventTitle: event.title || '',
        eventDate: event.date || '',
        chapterSlug: event.chapterSlug || event.partitionKey || '',
        registrationId: registration.rowKey,
        fullName: registration.fullName || '',
        email: registration.email || '',
        company: registration.company || '',
        role: registration.role || 'attendee',
        volunteerInterest: registration.volunteerInterest === true || registration.volunteerInterest === 'true',
        checkedIn: registration.checkedIn === true || registration.checkedIn === 'true',
        checkedInAt: registration.checkedInAt || '',
        registeredAt: registration.registeredAt || '',
        employmentStatus: demo.employmentStatus || '',
        industry: demo.industry || '',
        jobTitle: demo.jobTitle || registration.jobTitle || '',
        companySize: demo.companySize || '',
        experienceLevel: demo.experienceLevel || ''
      });
    });
  }

  return rows.sort((a, b) => (b.registeredAt || '').localeCompare(a.registeredAt || ''));
}

async function buildEventSummaries(events) {
  const summaries = [];

  for (const event of events) {
    const registrations = await getRegistrationsByEvent(event.rowKey);
    summaries.push({
      id: event.rowKey,
      title: event.title || '',
      date: event.date || '',
      chapterSlug: event.chapterSlug || event.partitionKey || '',
      registrationCount: registrations.length
    });
  }

  return summaries.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
}

/**
 * GET /api/registrationReport?action=events
 * GET /api/registrationReport?eventId={eventId}&format=csv
 * Community-organiser-only report of event registration profile and demographics fields.
 */
module.exports = async function registrationReport(request, context) {
  try {
    const user = getAuthUser(request);
    if (!user) return unauthorised();
    if (!hasRole(user, 'admin')) return forbidden('Only community organisers can access reports');

    const email = await resolveEmail(user);
    if (!isSuperAdmin(email)) {
      return forbidden('Only community organisers can access reports');
    }

    const url = new URL(request.url);
    const eventId = url.searchParams.get('eventId');
    let events;

    if (eventId) {
      const event = await getEventById(eventId);
      if (!event) {
        return {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'Event not found' })
        };
      }
      events = [event];
    } else {
      events = await listEvents();
    }

    if (url.searchParams.get('action') === 'events') {
      const summaries = await buildEventSummaries(events);
      return {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          events: summaries,
          totalEvents: summaries.length,
          totalRegistrations: summaries.reduce((sum, event) => sum + event.registrationCount, 0)
        })
      };
    }

    const rows = await buildRows(events);

    if (url.searchParams.get('format') === 'csv') {
      const header = [
        'Event Title',
        'Event Date',
        'Chapter',
        'Name',
        'Email',
        'Company',
        'Role',
        'Volunteer Interest',
        'Checked In',
        'Checked In At',
        'Registered At',
        'Employment Status',
        'Industry',
        'Job Title',
        'Company Size',
        'Experience Level'
      ];
      const body = header.map(csvCell).join(',') + '\n' + rows.map(row => [
        row.eventTitle,
        row.eventDate,
        row.chapterSlug,
        row.fullName,
        row.email,
        row.company,
        row.role,
        boolLabel(row.volunteerInterest),
        boolLabel(row.checkedIn),
        row.checkedInAt,
        row.registeredAt,
        row.employmentStatus,
        row.industry,
        row.jobTitle,
        row.companySize,
        row.experienceLevel
      ].map(csvCell).join(',')).join('\n');

      return {
        status: 200,
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="${eventId ? `registration-report-${eventId}` : 'registration-report-all-events'}.csv"`
        },
        body
      };
    }

    return {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        totalRegistrations: rows.length,
        totalEvents: new Set(rows.map(row => row.eventId)).size,
        totalChapters: new Set(rows.map(row => row.chapterSlug).filter(Boolean)).size,
        latestRegisteredAt: rows[0] ? rows[0].registeredAt : '',
        rows
      })
    };
  } catch (error) {
    context.log(`registrationReport error: ${error.message}`);
    return {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
};
