/**
 * Map Controller
 * Handles the map initialization and base layer management
 */
class MapController {
    constructor() {
        this.map = L.map('map', {
            center: [39.8283, -98.5795],
            zoom: 4,
            zoomControl: true,
            attributionControl: true
        });
        
        this.initializeMapLayers();
    }
    
    initializeMapLayers() {
        // Use dark map style by default
        this.darkLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
            subdomains: 'abcd',
            maxZoom: 19
        }).addTo(this.map);
        
        // Save the default style preference
        localStorage.setItem('mapStyle', 'dark');
        
        // Create light layer but don't add it by default
        this.lightLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors',
            maxZoom: 19,
            subdomains: 'abc'
        });
    }
    
    toggleMapStyle(style) {
        if (style === 'light') {
            this.map.removeLayer(this.darkLayer);
            this.map.addLayer(this.lightLayer);
            localStorage.setItem('mapStyle', 'light');
        } else {
            this.map.removeLayer(this.lightLayer);
            this.map.addLayer(this.darkLayer);
            localStorage.setItem('mapStyle', 'dark');
        }
    }
    
    getMap() {
        return this.map;
    }
}

// Export the MapController
window.MapController = MapController;