(function () {
  'use strict';

  var mapEl = document.getElementById('chapter-map');
  if (!mapEl || typeof L === 'undefined') return;

  var cards = document.querySelectorAll('.chapter-card[data-lat][data-lng]');
  if (!cards.length) return;

  var map = L.map('chapter-map', {
    scrollWheelZoom: false,
    tap: true
  });

  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 18,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
  }).addTo(map);

  var markers = [];
  var bounds = L.latLngBounds();
  var activeCard = null;

  // Custom marker icon using GSC teal
  var markerIcon = L.divIcon({
    className: 'chapter-marker',
    html: '<svg xmlns="http://www.w3.org/2000/svg" width="28" height="40" viewBox="0 0 24 36">' +
      '<path d="M12 0C5.4 0 0 5.4 0 12c0 9 12 24 12 24s12-15 12-24C24 5.4 18.6 0 12 0z" fill="#20B2AA"/>' +
      '<circle cx="12" cy="12" r="5" fill="#fff"/>' +
      '</svg>',
    iconSize: [28, 40],
    iconAnchor: [14, 40],
    popupAnchor: [0, -36]
  });

  var activeMarkerIcon = L.divIcon({
    className: 'chapter-marker chapter-marker--active',
    html: '<svg xmlns="http://www.w3.org/2000/svg" width="34" height="48" viewBox="0 0 24 36">' +
      '<path d="M12 0C5.4 0 0 5.4 0 12c0 9 12 24 12 24s12-15 12-24C24 5.4 18.6 0 12 0z" fill="#001f3f"/>' +
      '<circle cx="12" cy="12" r="5" fill="#20B2AA"/>' +
      '</svg>',
    iconSize: [34, 48],
    iconAnchor: [17, 48],
    popupAnchor: [0, -44]
  });

  cards.forEach(function (card) {
    var lat = parseFloat(card.dataset.lat);
    var lng = parseFloat(card.dataset.lng);
    var city = card.dataset.city;

    if (isNaN(lat) || isNaN(lng)) return;

    var latlng = L.latLng(lat, lng);
    bounds.extend(latlng);

    var marker = L.marker(latlng, { icon: markerIcon })
      .bindPopup('<strong>' + city + '</strong>')
      .addTo(map);

    marker._chapterCard = card;
    card._chapterMarker = marker;

    marker.on('click', function () {
      highlightCard(card);
      card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });

    // On card hover, highlight the marker
    card.addEventListener('mouseenter', function () {
      highlightMarker(marker, card);
    });

    card.addEventListener('mouseleave', function () {
      clearHighlight();
    });

    markers.push(marker);
  });

  if (bounds.isValid()) {
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 4 });
  }

  function highlightCard(card) {
    clearHighlight();
    card.classList.add('chapter-card--active');
    activeCard = card;
  }

  function highlightMarker(marker, card) {
    clearHighlight();
    marker.setIcon(activeMarkerIcon);
    marker.openPopup();
    card.classList.add('chapter-card--active');
    activeCard = card;
  }

  function clearHighlight() {
    if (activeCard) {
      activeCard.classList.remove('chapter-card--active');
      var prevMarker = activeCard._chapterMarker;
      if (prevMarker) {
        prevMarker.setIcon(markerIcon);
        prevMarker.closePopup();
      }
      activeCard = null;
    }
  }

  // Enable scroll zoom after first interaction with the map
  map.on('focus', function () {
    map.scrollWheelZoom.enable();
  });
  map.on('blur', function () {
    map.scrollWheelZoom.disable();
  });
})();
