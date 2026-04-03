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
        html += '<h3>' + GSC.esc(tierName) + '</h3>';
        html += '<div class="partners-grid">';
        tiers[tierName].forEach(function(p) {
          html += '<div class="chapter-partner-card">';
          if (p.logoDataUrl) html += '<img src="' + p.logoDataUrl + '" alt="' + GSC.esc(p.name) + '">';
          html += '<div><strong>' + GSC.esc(p.name) + '</strong></div>';
          if (p.eventTitle) html += '<div class="partner-event">' + GSC.esc(p.eventTitle) + '</div>';
          if (p.website) html += '<a href="' + GSC.esc(GSC.safeUrl(p.website)) + '" target="_blank" rel="noopener noreferrer" class="partner-website-link">Website →</a>';
          html += '</div>';
        });
        html += '</div></div>';
      });

      content.innerHTML = html;
      section.style.display = 'block';
    })
    .catch(function() {});
})();
