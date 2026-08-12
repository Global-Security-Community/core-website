const {
  getAuthUser,
  getAdminChapterSlugs,
  hasRole,
  isSuperAdmin,
  resolveEmail,
  unauthorised,
  forbidden
} = require('../helpers/auth');
const { getScannerEventIdsByEmail, listEvents } = require('../helpers/tableStorage');

/**
 * GET /api/scannerEvents
 * Lists events the current organiser or volunteer is authorised to scan.
 */
module.exports = async function (request, context) {
  try {
    const user = getAuthUser(request);
    if (!user) return unauthorised();
    if (!hasRole(user, 'admin') && !hasRole(user, 'volunteer')) {
      return forbidden('Only event organisers and volunteers can access scanner events');
    }

    const email = await resolveEmail(user);
    if (!email) return forbidden('Your account email could not be resolved');

    const [allEvents, assignedEventIds, adminChapterSlugs] = await Promise.all([
      listEvents(),
      getScannerEventIdsByEmail(email),
      hasRole(user, 'admin') ? getAdminChapterSlugs(email) : Promise.resolve([])
    ]);
    const assignmentSet = new Set(assignedEventIds);
    const superAdmin = hasRole(user, 'admin') && isSuperAdmin(email);

    const events = allEvents
      .filter(event => event.status !== 'completed')
      .filter(event => {
        const chapterSlug = String(event.chapterSlug || event.partitionKey || '').toLowerCase();
        return superAdmin || assignmentSet.has(event.rowKey) || adminChapterSlugs.includes(chapterSlug);
      })
      .map(event => ({
        id: event.rowKey,
        title: event.title,
        date: event.date || '',
        location: event.location || '',
        chapterSlug: event.chapterSlug || event.partitionKey || ''
      }))
      .sort((a, b) => String(a.date).localeCompare(String(b.date)) || a.title.localeCompare(b.title));

    return { status: 200, jsonBody: { events } };
  } catch (error) {
    context.log(`scannerEvents error: ${error.message}`);
    return { status: 500, jsonBody: { error: 'Internal server error' } };
  }
};
