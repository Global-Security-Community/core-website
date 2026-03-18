(function() {
  var el = document.getElementById('chapter-events');
  if (!el) return;
  var chapterSlug = el.getAttribute('data-chapter-slug');
  if (!chapterSlug) return;

  fetch('/api/getCommunityPartners?chapterSlug=' + encodeURIComponent(chapterSlug))
    .then(function(r) { return r.ok ? r.json() : null; })
    .then(function(data) {
      if (!data || !data.partners) return;
      var tiers = data.partners;
      var tierNames = Object.keys(tiers);
      if (tierNames.length === 0) return;

      var section = document.getElementById('chapter-partners');
      var content = document.getElementById('chapter-partners-content');
      if (!section || !content) return;

      var html = '';
      tierNames.forEach(function(tierName) {
        html += '<div class="partners-tier">';
        html += '<h3>' + esc(tierName) + '</h3>';
        html += '<div class="partners-grid">';
        tiers[tierName].forEach(function(p) {
          html += '<div class="chapter-partner-card">';
          if (p.logoDataUrl) html += '<img src="' + p.logoDataUrl + '" alt="' + esc(p.name) + '">';
          html += '<div><strong>' + esc(p.name) + '</strong></div>';
          if (p.eventTitle) html += '<div class="partner-event">' + esc(p.eventTitle) + '</div>';
          if (p.website) html += '<a href="' + esc(p.website) + '" target="_blank" rel="noopener noreferrer" style="font-size:0.75rem;color:var(--color-primary-teal);">Website →</a>';
          html += '</div>';
        });
        html += '</div></div>';
      });

      content.innerHTML = html;
      section.style.display = 'block';
    })
    .catch(function() {});

  function esc(str) {
    if (!str) return '';
    var d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }
})();
