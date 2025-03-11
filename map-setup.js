// Initialize the map
const map = L.map('map', {
    center: [39.8283, -98.5795],
    zoom: 4,
    zoomControl: true,
    attributionControl: true
});

// Use dark map style by default
L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    subdomains: 'abcd',
    maxZoom: 19
}).addTo(map);

// Save the default style preference
localStorage.setItem('mapStyle', 'dark');

// Ensure base tile layer is properly loaded
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors',
    maxZoom: 19,
    subdomains: 'abc'
}).addTo(map);

export default map;