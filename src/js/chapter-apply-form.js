// Live character counters
document.querySelectorAll('.char-count').forEach(function(counter) {
  var field = document.getElementById(counter.getAttribute('data-for'));
  if (!field) return;
  var max = field.maxLength;
  field.addEventListener('input', function() {
    var len = field.value.length;
    counter.textContent = len + ' / ' + max;
    counter.classList.remove('near-limit', 'at-limit');
    if (len >= max) counter.classList.add('at-limit');
    else if (len >= max * 0.85) counter.classList.add('near-limit');
  });
});

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
      github: document.getElementById('github').value,
      secondLeadName: document.getElementById('secondLeadName').value,
      secondLeadEmail: document.getElementById('secondLeadEmail').value,
      secondLeadLinkedIn: document.getElementById('secondLeadLinkedIn').value,
      secondLeadGitHub: document.getElementById('secondLeadGitHub').value,
      city: document.getElementById('city').value,
      country: document.getElementById('country').value,
      whyLead: document.getElementById('whyLead').value,
      existingCommunity: document.getElementById('existingCommunity').value
    };

    var turnstileResponse = document.querySelector('[name="cf-turnstile-response"]');
    formData.turnstileToken = turnstileResponse ? turnstileResponse.value : '';

    if (!formData.turnstileToken) {
      GSC.showMessage(formMessage, 'error', 'Security verification not ready — please wait a moment and try again. If this persists, check that ad blockers are not blocking the verification widget.');
      formMessage.style.display = 'block';
      return;
    }

    var response = await GSC.fetch('/api/chapterApplication', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData)
    });

    var data = await response.json();

    if (response.ok) {
      GSC.showMessage(formMessage, 'success', data.message || 'Application submitted successfully!');
      document.getElementById('chapter-apply-form').reset();
      if (typeof turnstile !== 'undefined') turnstile.reset();
      document.querySelectorAll('.char-count').forEach(function(c) {
        var f = document.getElementById(c.getAttribute('data-for'));
        c.textContent = '0 / ' + f.maxLength;
        c.classList.remove('near-limit', 'at-limit');
      });
    } else {
      GSC.showMessage(formMessage, 'error', data.error || 'Error submitting application. Please try again.');
    }

    formMessage.style.display = 'block';
  } catch (error) {
    console.error('Chapter application error:', error);
    var detail = error.message || '';
    GSC.showMessage(formMessage, 'error', 'Error submitting application. Please try again later.' + (detail ? ' (' + detail + ')' : ''));
    formMessage.style.display = 'block';
  } finally {
    button.disabled = false;
    button.textContent = originalText;
  }
});
