const { app } = require('@azure/functions');
const contactFormHandler = require('./functions/contactForm');
const chapterApplicationHandler = require('./functions/chapterApplication');
const chapterApprovalHandler = require('./functions/chapterApproval');
const rolesHandler = require('./functions/roles');
const createEventHandler = require('./functions/createEvent');
const getEventHandler = require('./functions/getEvent');
const registerEventHandler = require('./functions/registerEvent');
const myTicketsHandler = require('./functions/myTickets');
const checkInHandler = require('./functions/checkIn');
const issueBadgesHandler = require('./functions/issueBadges');
const badgeDownloadHandler = require('./functions/badgeDownload');
const eventAttendanceHandler = require('./functions/eventAttendance');
const eventVolunteersHandler = require('./functions/eventVolunteers');

// ─── Public endpoints ───
app.post('contactForm', { authLevel: 'anonymous', handler: contactFormHandler });
app.post('chapterApplication', { authLevel: 'anonymous', handler: chapterApplicationHandler });
app.get('chapterApproval', { authLevel: 'anonymous', handler: chapterApprovalHandler });
app.get('getEvent', { authLevel: 'anonymous', handler: getEventHandler });

// ─── Auth: role assignment ───
app.post('roles', { authLevel: 'anonymous', handler: rolesHandler });

// ─── Diagnostic: shows auth state (temporary, remove after debugging) ───
app.get('debugAuth', { authLevel: 'anonymous', handler: async function(request) {
  const header = request.headers.get('x-ms-client-principal');
  if (!header) return { status: 200, headers: {'Content-Type':'application/json'}, body: JSON.stringify({ authenticated: false }) };
  const decoded = Buffer.from(header, 'base64').toString('utf-8');
  return { status: 200, headers: {'Content-Type':'application/json'}, body: decoded };
}});

// ─── Authenticated endpoints ───
app.post('registerEvent', { authLevel: 'anonymous', handler: registerEventHandler });
app.get('myTickets', { authLevel: 'anonymous', handler: myTicketsHandler });
app.get('badge', { authLevel: 'anonymous', handler: badgeDownloadHandler });

// ─── Admin endpoints ───
app.post('createEvent', { authLevel: 'anonymous', handler: createEventHandler });
app.post('checkIn', { authLevel: 'anonymous', handler: checkInHandler });
app.post('issueBadges', { authLevel: 'anonymous', handler: issueBadgesHandler });
app.http('eventAttendance', { methods: ['GET', 'POST'], authLevel: 'anonymous', handler: eventAttendanceHandler });
app.http('eventVolunteers', { methods: ['GET', 'POST', 'DELETE'], authLevel: 'anonymous', handler: eventVolunteersHandler });
