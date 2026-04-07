const { app } = require('@azure/functions');
const { verifyCsrfHeader } = require('./helpers/auth');
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
const cancelRegistrationHandler = require('./functions/cancelRegistration');
const updateRegistrationRoleHandler = require('./functions/updateRegistrationRole');
const adminRegisterHandler = require('./functions/adminRegister');
const updateChapterHandler = require('./functions/updateChapter');
const getChapterHandler = require('./functions/getChapter');
const refreshSessionizeHandler = require('./functions/refreshSessionize');
const getSessionizeDataHandler = require('./functions/getSessionizeData');
const chapterSubscribeHandler = require('./functions/chapterSubscribe');
const communityPartnerHandler = require('./functions/communityPartner');
const getCommunityPartnersHandler = require('./functions/getCommunityPartners');
const regenerateImageHandler = require('./functions/regenerateImage');
const updateEventHandler = require('./functions/updateEvent');
const fixEventChapterHandler = require('./functions/fixEventChapter');
const deleteEventHandler = require('./functions/deleteEvent');
const resendTicketEmailHandler = require('./functions/resendTicketEmail');

/**
 * Wraps a POST handler with CSRF header verification.
 * Rejects requests missing the X-Requested-With: fetch header.
 */
function withCsrf(handler) {
  return async function(request, context) {
    const csrfError = verifyCsrfHeader(request);
    if (csrfError) return csrfError;
    return handler(request, context);
  };
}

// ─── Public endpoints ───
app.post('contactForm', { authLevel: 'anonymous', handler: withCsrf(contactFormHandler) });
app.post('chapterApplication', { authLevel: 'anonymous', handler: withCsrf(chapterApplicationHandler) });
app.get('chapterApproval', { authLevel: 'anonymous', handler: chapterApprovalHandler });
app.get('getEvent', { authLevel: 'anonymous', handler: getEventHandler });
app.get('getSessionizeData', { authLevel: 'anonymous', handler: getSessionizeDataHandler });
app.get('getCommunityPartners', { authLevel: 'anonymous', handler: getCommunityPartnersHandler });

// ─── Auth: role assignment (called by SWA platform — no CSRF check) ───
app.post('roles', { authLevel: 'anonymous', handler: rolesHandler });

// ─── Authenticated endpoints ───
app.post('registerEvent', { authLevel: 'anonymous', handler: withCsrf(registerEventHandler) });
app.post('cancelRegistration', { authLevel: 'anonymous', handler: withCsrf(cancelRegistrationHandler) });
app.get('myTickets', { authLevel: 'anonymous', handler: myTicketsHandler });
app.get('badge', { authLevel: 'anonymous', handler: badgeDownloadHandler });
app.post('chapterSubscribe', { authLevel: 'anonymous', handler: withCsrf(chapterSubscribeHandler) });

// ─── Admin endpoints ───
app.post('createEvent', { authLevel: 'anonymous', handler: withCsrf(createEventHandler) });
app.post('checkIn', { authLevel: 'anonymous', handler: withCsrf(checkInHandler) });
app.post('issueBadges', { authLevel: 'anonymous', handler: withCsrf(issueBadgesHandler) });
app.http('eventAttendance', { methods: ['GET', 'POST'], authLevel: 'anonymous', handler: eventAttendanceHandler });
app.post('updateRegistrationRole', { authLevel: 'anonymous', handler: withCsrf(updateRegistrationRoleHandler) });
app.post('registerAdmin', { authLevel: 'anonymous', route: 'manualRegister', handler: withCsrf(adminRegisterHandler) });
app.post('updateChapter', { authLevel: 'anonymous', handler: withCsrf(updateChapterHandler) });
app.get('getChapter', { authLevel: 'anonymous', handler: getChapterHandler });
app.post('refreshSessionize', { authLevel: 'anonymous', handler: withCsrf(refreshSessionizeHandler) });
app.post('communityPartner', { authLevel: 'anonymous', handler: withCsrf(communityPartnerHandler) });
app.post('regenerateImage', { authLevel: 'anonymous', handler: withCsrf(regenerateImageHandler) });
app.post('updateEvent', { authLevel: 'anonymous', handler: withCsrf(updateEventHandler) });
app.post('fixEventChapter', { authLevel: 'anonymous', handler: withCsrf(fixEventChapterHandler) });
app.post('deleteEvent', { authLevel: 'anonymous', handler: withCsrf(deleteEventHandler) });
app.post('resendTicketEmail', { authLevel: 'anonymous', handler: withCsrf(resendTicketEmailHandler) });
