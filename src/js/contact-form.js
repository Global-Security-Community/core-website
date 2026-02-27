document.getElementById('contact-form').addEventListener('submit', async function(e) {
  e.preventDefault();
  
  var formMessage = document.getElementById('form-message');
  var button = this.querySelector('button');
  var originalText = button.textContent;
  
  try {
    button.disabled = true;
    button.textContent = 'Sending...';
    
    var formData = {
      name: document.getElementById('name').value,
      email: document.getElementById('email').value,
      subject: document.getElementById('subject').value,
      message: document.getElementById('message').value
    };
    
    var response = await fetch('/api/contactForm', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(formData)
    });
    
    var data = await response.json();
    
    if (response.ok) {
      formMessage.style.backgroundColor = '#d4edda';
      formMessage.style.color = '#155724';
      formMessage.style.borderLeft = '4px solid #28a745';
      formMessage.textContent = data.message || 'Message sent successfully!';
      document.getElementById('contact-form').reset();
    } else {
      formMessage.style.backgroundColor = '#f8d7da';
      formMessage.style.color = '#721c24';
      formMessage.style.borderLeft = '4px solid #f5c6cb';
      formMessage.textContent = data.error || 'Error sending message. Please try again.';
    }
    
    formMessage.style.display = 'block';
  } catch (error) {
    formMessage.style.backgroundColor = '#f8d7da';
    formMessage.style.color = '#721c24';
    formMessage.style.borderLeft = '4px solid #f5c6cb';
    formMessage.textContent = 'Error sending message. Please try again later.';
    formMessage.style.display = 'block';
  } finally {
    button.disabled = false;
    button.textContent = originalText;
  }
});
