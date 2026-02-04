const { app } = require('@azure/functions');
const contactFormHandler = require('./functions/contactForm');

app.post('contactForm', {
  authLevel: 'anonymous',
  handler: contactFormHandler
});
