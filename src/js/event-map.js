(function () {
  'use strict';

  var mapEl = document.getElementById('event-map');
  if (!mapEl || typeof L === 'undefined') return;

  var lat = parseFloat(mapEl.dataset.lat);
  var lng = parseFloat(mapEl.dataset.lng);
  if (isNaN(lat) || isNaN(lng)) return;

  var name = mapEl.dataset.name || '';

  var map = L.map('event-map', {
    scrollWheelZoom: false,
    tap: true
  }).setView([lat, lng], 15);

  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 18,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
  }).addTo(map);

  // Custom marker icon matching the GSC teal branding used on the chapters map
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

  var marker = L.marker([lat, lng], { icon: markerIcon }).addTo(map);
  if (name) marker.bindPopup('<strong>' + GSC.esc(name) + '</strong>').openPopup();

  // Enable scroll zoom after first interaction with the map
  map.on('focus', function () {
    map.scrollWheelZoom.enable();
  });
  map.on('blur', function () {
    map.scrollWheelZoom.disable();
  });
})();
