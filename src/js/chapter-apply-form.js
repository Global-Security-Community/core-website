document.getElementById('chapter-apply-form').addEventListener('submit', async function(e) {
  e.preventDefault();

  var formMessage = document.getElementById('form-message');
  var button = this.querySelector('button');
  var originalText = button.textContent;

  try {
    button.disabled = true;
    button.textContent = 'Submitting...';

    var formData = {
      fullName: document.getElementById('fullName').value,
      email: document.getElementById('email').value,
      linkedIn: document.getElementById('linkedIn').value,
      aboutYou: document.getElementById('aboutYou').value,
      secondLeadName: document.getElementById('secondLeadName').value,
      secondLeadEmail: document.getElementById('secondLeadEmail').value,
      secondLeadLinkedIn: document.getElementById('secondLeadLinkedIn').value,
      secondLeadAbout: document.getElementById('secondLeadAbout').value,
      city: document.getElementById('city').value,
      country: document.getElementById('country').value,
      whyLead: document.getElementById('whyLead').value,
      existingCommunity: document.getElementById('existingCommunity').value,
      website: document.getElementById('website').value
    };

    var response = await fetch('/api/chapterApplication', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData)
    });

    var data = await response.json();

    if (response.ok) {
      formMessage.style.backgroundColor = '#d4edda';
      formMessage.style.color = '#155724';
      formMessage.style.borderLeft = '4px solid #28a745';
      formMessage.textContent = data.message || 'Application submitted successfully!';
      document.getElementById('chapter-apply-form').reset();
    } else {
      formMessage.style.backgroundColor = '#f8d7da';
      formMessage.style.color = '#721c24';
      formMessage.style.borderLeft = '4px solid #f5c6cb';
      formMessage.textContent = data.error || 'Error submitting application. Please try again.';
    }

    formMessage.style.display = 'block';
  } catch (error) {
    formMessage.style.backgroundColor = '#f8d7da';
    formMessage.style.color = '#721c24';
    formMessage.style.borderLeft = '4px solid #f5c6cb';
    formMessage.textContent = 'Error submitting application. Please try again later.';
    formMessage.style.display = 'block';
  } finally {
    button.disabled = false;
    button.textContent = originalText;
  }
});
