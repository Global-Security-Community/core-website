(function() {
  // Register service worker for PWA support
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(function() {});
  }

  var container = document.getElementById('nav-auth');
  if (!container) return;

  fetch('/.auth/me')
    .then(function(res) { return res.json(); })
    .then(function(data) {
      var principal = data.clientPrincipal;
      if (principal) {
        var name = principal.userDetails || 'Account';
        var isAdmin = (principal.userRoles || []).indexOf('admin') !== -1;
        var html = '';
        if (isAdmin) {
          html += '<a href="/dashboard/" class="nav-link" style="margin-right:0.5rem;">Dashboard</a> ';
        }
        html += '<a href="/my-tickets/" class="nav-link" style="margin-right:0.5rem;">' + escNav(name) + '</a>';
        html += '<a href="/.auth/logout" class="nav-link">Logout</a>';
        container.innerHTML = html;
      } else {
        container.innerHTML = '<a href="/.auth/login/ciam" class="nav-link">Login</a>';
      }
    })
    .catch(function() {
      container.innerHTML = '<a href="/.auth/login/ciam" class="nav-link">Login</a>';
    });

  function escNav(str) {
    var d = document.createElement('span');
    d.textContent = str;
    return d.innerHTML;
  }
})();
