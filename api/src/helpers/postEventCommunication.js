const ROLES = ['attendee', 'volunteer', 'speaker', 'organiser', 'sponsor'];
const SUPPORTED_PLACEHOLDERS = new Set([
  'firstName',
  'eventTitle',
  'eventDate',
  'chapterName'
]);

const ROLE_LABELS = {
  attendee: 'Attendees',
  volunteer: 'Volunteers',
  speaker: 'Speakers',
  organiser: 'Organisers',
  sponsor: 'Community Partners'
};

function getDefaultTemplates() {
  return {
    attendee: {
      subject: 'Thank you for joining {eventTitle}',
      message: 'Hi {firstName},\n\nThank you for joining us at {eventTitle}. Your participation and support helped make the event a success, and we hope you found the day valuable.\n\nWe have attached your community badge, which you are welcome to share on LinkedIn.'
    },
    volunteer: {
      subject: 'Thank you for volunteering at {eventTitle}',
      message: 'Hi {firstName},\n\nThank you for giving your time and energy to help deliver {eventTitle}. Your contribution behind the scenes made a real difference to the experience of everyone who attended.\n\nWe have attached your community badge, which you are welcome to share on LinkedIn.'
    },
    speaker: {
      subject: 'Thank you for speaking at {eventTitle}',
      message: 'Hi {firstName},\n\nThank you for sharing your expertise at {eventTitle}. Your preparation, knowledge, and willingness to contribute made a meaningful difference to our community.\n\nWe have attached your Speaker badge, which you are welcome to share on LinkedIn.'
    },
    organiser: {
      subject: 'Thank you for organising {eventTitle}',
      message: 'Hi {firstName},\n\nThank you for the leadership, care, and work you put into delivering {eventTitle}. Events like this are only possible because organisers invest their time in bringing the community together.\n\nWe have attached your Organiser badge, which you are welcome to share on LinkedIn.'
    },
    sponsor: {
      subject: 'Thank you for supporting {eventTitle}',
      message: 'Hi {firstName},\n\nThank you for supporting {eventTitle} as a Community Partner. Your contribution helped make the event possible and enabled us to bring the security community together.\n\nWe have attached your community badge, which you are welcome to share on LinkedIn.'
    }
  };
}

function normaliseRole(role) {
  return ROLES.includes(role) ? role : 'attendee';
}

function badgeTypeForRole(role) {
  if (role === 'speaker') return 'Speaker';
  if (role === 'organiser') return 'Organiser';
  return 'Attendee';
}

function validateTemplates(templates) {
  if (!templates || typeof templates !== 'object') {
    return { valid: false, error: 'Message templates are required' };
  }
  const clean = {};
  for (const role of ROLES) {
    const template = templates[role];
    if (!template || typeof template.subject !== 'string' || typeof template.message !== 'string') {
      return { valid: false, error: `A subject and message are required for ${ROLE_LABELS[role]}` };
    }
    const subject = template.subject.replace(/[\r\n]+/g, ' ').trim();
    const message = template.message.trim();
    if (!subject || !message) {
      return { valid: false, error: `A subject and message are required for ${ROLE_LABELS[role]}` };
    }
    if (subject.length > 150 || message.length > 5000) {
      return { valid: false, error: `${ROLE_LABELS[role]} exceeds the 150-character subject or 5,000-character message limit` };
    }
    const unknown = [...`${subject} ${message}`.matchAll(/\{([A-Za-z0-9]+)\}/g)]
      .map(match => match[1])
      .find(name => !SUPPORTED_PLACEHOLDERS.has(name));
    if (unknown) {
      return { valid: false, error: `Unsupported placeholder {${unknown}}` };
    }
    clean[role] = { subject, message };
  }
  return { valid: true, templates: clean };
}

function renderTemplate(template, recipient, event) {
  const firstName = String(recipient.fullName || recipient.name || '').trim().split(/\s+/)[0] || 'there';
  const chapterName = String(event.chapterName || event.chapterSlug || event.partitionKey || '')
    .replace(/-/g, ' ')
    .replace(/\b\w/g, character => character.toUpperCase());
  const values = {
    firstName,
    eventTitle: event.title || '',
    eventDate: formatEventDate(event.date),
    chapterName
  };
  return String(template).replace(/\{([A-Za-z0-9]+)\}/g, (match, name) => (
    Object.prototype.hasOwnProperty.call(values, name) ? values[name] : match
  ));
}

function formatEventDate(value) {
  if (!value) return '';
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC'
  });
}

function checkedInRegistrations(registrations) {
  const seen = new Set();
  return registrations.filter(registration => {
    const checkedIn = registration.checkedIn === true || registration.checkedIn === 'true';
    const email = String(registration.email || '').trim().toLowerCase();
    if (!checkedIn || !email || seen.has(email)) return false;
    seen.add(email);
    return true;
  });
}

function summariseRecipients(registrations) {
  const counts = Object.fromEntries(ROLES.map(role => [role, 0]));
  checkedInRegistrations(registrations).forEach(registration => {
    counts[normaliseRole(registration.role)]++;
  });
  return {
    total: Object.values(counts).reduce((sum, count) => sum + count, 0),
    roles: counts
  };
}

module.exports = {
  ROLES,
  ROLE_LABELS,
  getDefaultTemplates,
  normaliseRole,
  badgeTypeForRole,
  validateTemplates,
  renderTemplate,
  formatEventDate,
  checkedInRegistrations,
  summariseRecipients
};
