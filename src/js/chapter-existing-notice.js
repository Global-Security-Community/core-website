(function() {
  var params = new URLSearchParams(window.location.search);
  if (params.get('application') !== 'existing') return;

  var notice = document.getElementById('existing-chapter-notice');
  if (!notice) return;

  GSC.showMessage(notice, 'warning', 'This chapter already exists. Please reach out to one of the chapter leads below if you would like to get involved.');
  notice.classList.remove('is-hidden');

  params.delete('application');
  var query = params.toString();
  window.history.replaceState({}, '', window.location.pathname + (query ? '?' + query : '') + window.location.hash);
})();
