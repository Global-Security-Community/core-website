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

// ─── Public endpoints ───
app.post('contactForm', { authLevel: 'anonymous', handler: contactFormHandler });
app.post('chapterApplication', { authLevel: 'anonymous', handler: chapterApplicationHandler });
app.get('chapterApproval', { authLevel: 'anonymous', handler: chapterApprovalHandler });
app.get('getEvent', { authLevel: 'anonymous', handler: getEventHandler });
app.get('getSessionizeData', { authLevel: 'anonymous', handler: getSessionizeDataHandler });
app.get('getCommunityPartners', { authLevel: 'anonymous', handler: getCommunityPartnersHandler });

// ─── Auth: role assignment ───
app.post('roles', { authLevel: 'anonymous', handler: rolesHandler });

// ─── Authenticated endpoints ───
app.post('registerEvent', { authLevel: 'anonymous', handler: registerEventHandler });
app.post('cancelRegistration', { authLevel: 'anonymous', handler: cancelRegistrationHandler });
app.get('myTickets', { authLevel: 'anonymous', handler: myTicketsHandler });
app.get('badge', { authLevel: 'anonymous', handler: badgeDownloadHandler });
app.post('chapterSubscribe', { authLevel: 'anonymous', handler: chapterSubscribeHandler });

// ─── Admin endpoints ───
app.post('createEvent', { authLevel: 'anonymous', handler: createEventHandler });
app.post('checkIn', { authLevel: 'anonymous', handler: checkInHandler });
app.post('issueBadges', { authLevel: 'anonymous', handler: issueBadgesHandler });
app.http('eventAttendance', { methods: ['GET', 'POST'], authLevel: 'anonymous', handler: eventAttendanceHandler });
app.post('updateRegistrationRole', { authLevel: 'anonymous', handler: updateRegistrationRoleHandler });
app.post('registerAdmin', { authLevel: 'anonymous', route: 'manualRegister', handler: adminRegisterHandler });
app.post('updateChapter', { authLevel: 'anonymous', handler: updateChapterHandler });
app.get('getChapter', { authLevel: 'anonymous', handler: getChapterHandler });
app.post('refreshSessionize', { authLevel: 'anonymous', handler: refreshSessionizeHandler });
app.post('communityPartner', { authLevel: 'anonymous', handler: communityPartnerHandler });
app.post('regenerateImage', { authLevel: 'anonymous', handler: regenerateImageHandler });
app.post('updateEvent', { authLevel: 'anonymous', handler: updateEventHandler });
