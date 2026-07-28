(function () {
  'use strict';

  var button = document.getElementById('approve-release');
  var status = document.getElementById('release-status');
  if (!button || !status) return;

  button.addEventListener('click', async function () {
    button.disabled = true;
    status.textContent = 'Starting the protected production release...';

    try {
      var response = await fetch('/api/releaseApproval', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'fetch'
        },
        body: JSON.stringify({
          sha: button.dataset.sha,
          chapterSlug: button.dataset.chapter
        })
      });
      var result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Release approval failed');

      status.textContent = result.message;
      button.textContent = 'Release approved';
    } catch (error) {
      status.textContent = error.message;
      button.disabled = false;
    }
  });
}());
