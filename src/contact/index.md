---
layout: base.njk
title: Contact Us
---

<div class="container">
  <h1>Contact Us</h1>

  <p>Have questions, want to start a chapter, or interested in partnering with us? We'd love to hear from you.</p>

  <div style="max-width: 600px;">
    <div id="form-message" style="display: none; margin-bottom: 1rem; padding: 1rem; border-radius: 4px;"></div>
    <form id="contact-form">
      <div class="form-group">
        <label for="name">Name *</label>
        <input type="text" id="name" name="name" required>
      </div>

      <div class="form-group">
        <label for="email">Email *</label>
        <input type="email" id="email" name="email" required>
      </div>

      <div class="form-group">
        <label for="subject">Subject *</label>
        <input type="text" id="subject" name="subject" required>
      </div>

      <div class="form-group">
        <label for="message">Message *</label>
        <textarea id="message" name="message" rows="5" required></textarea>
      </div>

      <button type="submit">Send Message</button>
    </form>
  </div>

<script>
  document.getElementById('contact-form').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const formMessage = document.getElementById('form-message');
    const button = this.querySelector('button');
    const originalText = button.textContent;
    
    try {
      button.disabled = true;
      button.textContent = 'Sending...';
      
      const formData = {
        name: document.getElementById('name').value,
        email: document.getElementById('email').value,
        subject: document.getElementById('subject').value,
        message: document.getElementById('message').value
      };
      
      const response = await fetch('/api/contactForm', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });
      
      const data = await response.json();
      
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
</script>

  <h2 style="margin-top: 3rem;">Quick Contact Info</h2>
  <p><strong>Email:</strong> info@globalsecuritycommunity.org</p>
  <p><strong>General Inquiries:</strong> hello@globalsecuritycommunity.org</p>
  <p><strong>Chapter Support:</strong> chapters@globalsecuritycommunity.org</p>
</div>
