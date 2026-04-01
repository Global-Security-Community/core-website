document.getElementById('contact-form').addEventListener('submit', async function(e) {
  e.preventDefault();
  
  var formMessage = document.getElementById('form-message');
  var button = this.querySelector('button');
  var originalText = button.textContent;

  // Client-side validation
  var name = document.getElementById('name').value.trim();
  var email = document.getElementById('email').value.trim();
  var subject = document.getElementById('subject').value.trim();
  var message = document.getElementById('message').value.trim();

  function showError(msg) {
    GSC.showMessage(formMessage, 'error', msg);
    formMessage.style.display = 'block';
  }

  if (!name || !email || !subject || !message) {
    showError('Please fill in all required fields.');
    return;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    showError('Please enter a valid email address.');
    return;
  }
  if (name.length > 100) { showError('Name must be 100 characters or less.'); return; }
  if (subject.length > 200) { showError('Subject must be 200 characters or less.'); return; }
  if (message.length > 5000) { showError('Message must be 5000 characters or less.'); return; }

  var turnstileResponse = document.querySelector('[name="cf-turnstile-response"]');
  var turnstileToken = turnstileResponse ? turnstileResponse.value : '';

  try {
    button.disabled = true;
    button.textContent = 'Sending...';
    
    var response = await fetch('/api/contactForm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name, email: email, subject: subject, message: message, turnstileToken: turnstileToken })
    });
    
    var data = await response.json();
    
    if (response.ok) {
      GSC.showMessage(formMessage, 'success', data.message || 'Message sent successfully!');
      document.getElementById('contact-form').reset();
      if (typeof turnstile !== 'undefined') turnstile.reset();
    } else {
      showError(data.error || 'Error sending message. Please try again.');
    }
    
    formMessage.style.display = 'block';
  } catch (error) {
    showError('Error sending message. Please try again later.');
  } finally {
    button.disabled = false;
    button.textContent = originalText;
  }
});
