const { app } = require('@azure/functions');
const contactFormHandler = require('./functions/contactForm');
const chapterApplicationHandler = require('./functions/chapterApplication');
const chapterApprovalHandler = require('./functions/chapterApproval');

app.post('contactForm', {
  authLevel: 'anonymous',
  handler: contactFormHandler
});

app.post('chapterApplication', {
  authLevel: 'anonymous',
  handler: chapterApplicationHandler
});

app.get('chapterApproval', {
  authLevel: 'anonymous',
  handler: chapterApprovalHandler
});
