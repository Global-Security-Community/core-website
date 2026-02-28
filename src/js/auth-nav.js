(function() {
  // Hamburger menu toggle
  var toggle = document.getElementById('nav-toggle');
  var menu = document.getElementById('nav-menu');
  if (toggle && menu) {
    toggle.addEventListener('click', function() {
      var expanded = toggle.getAttribute('aria-expanded') === 'true';
      toggle.setAttribute('aria-expanded', String(!expanded));
      menu.classList.toggle('open');
    });
    // Close menu when a link is clicked
    menu.addEventListener('click', function(e) {
      if (e.target.classList.contains('nav-link')) {
        menu.classList.remove('open');
        toggle.setAttribute('aria-expanded', 'false');
      }
    });
  }

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
        var isAdmin = (principal.userRoles || []).indexOf('admin') !== -1;
        var isVolunteer = (principal.userRoles || []).indexOf('volunteer') !== -1;
        var items = [];
        if (isAdmin) {
          items.push('<li><a href="/dashboard/" class="nav-link">Dashboard</a></li>');
        } else if (isVolunteer) {
          items.push('<li><a href="/scanner/" class="nav-link">Scanner</a></li>');
        }
        items.push('<li><a href="/my-tickets/" class="nav-link">My Tickets</a></li>');
        items.push('<li><a href="https://wiki.globalsecurity.community" class="nav-link" target="_blank" rel="noopener noreferrer">Wiki</a></li>');
        items.push('<li><a href="/.auth/logout" class="nav-link">Logout</a></li>');
        // Replace the single auth <li> with multiple <li> elements
        container.outerHTML = items.join('');
      } else {
        container.innerHTML = '<a href="/.auth/login/ciam" class="nav-link">Login</a>';
      }
    })
    .catch(function() {
      container.innerHTML = '<a href="/.auth/login/ciam" class="nav-link">Login</a>';
    });
})();
