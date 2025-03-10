/**
 * Map Controller
 * Manages the Leaflet map instance and base layers
 */
class MapController {
    constructor(mapElementId = 'map') {
        this.mapElementId = mapElementId;
        this.map = this.initializeMap();
        this.baseLayers = {};
        this.overlayLayers = {};
        this.layerControl = null;
        
        // Initialize base layers
        this.initializeBaseLayers();
        
        // Initialize layer control
        this.initializeLayerControl();
    }
    
    /**
     * Initialize the Leaflet map
     * @returns {Object} Leaflet map instance
     */
    initializeMap() {
        const map = L.map(this.mapElementId, {
            center: [39.8283, -98.5795], // Center of US
            zoom: 4,
            zoomControl: true,
            attributionControl: true
        });
        
        return map;
    }
    
    /**
     * Get the map instance
     * @returns {Object} Leaflet map instance
     */
    getMap() {
        return this.map;
    }
    
    /**
     * Initialize base map layers
     */
    initializeBaseLayers() {
        // Dark theme (CartoDB Dark)
        this.baseLayers.dark = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
            subdomains: 'abcd',
            maxZoom: 19
        });
        
        // Light theme (CartoDB Light)
        this.baseLayers.light = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
            subdomains: 'abcd',
            maxZoom: 19
        });
        
        // Satellite (Esri World Imagery)
        this.baseLayers.satellite = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
            attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
            maxZoom: 19
        });
        
        // Terrain (Stamen Terrain)
        this.baseLayers.terrain = L.tileLayer('https://stamen-tiles-{s}.a.ssl.fastly.net/terrain/{z}/{x}/{y}{r}.png', {
            attribution: 'Map tiles by <a href="http://stamen.com">Stamen Design</a>, <a href="http://creativecommons.org/licenses/by/3.0">CC BY 3.0</a> &mdash; Map data &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            subdomains: 'abcd',
            maxZoom: 18
        });
        
        // OpenStreetMap
        this.baseLayers.osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors',
            maxZoom: 19,
            subdomains: 'abc'
        });
        
        // Set the default base layer from localStorage or use dark as default
        const defaultStyle = localStorage.getItem('mapStyle') || 'dark';
        this.setMapStyle(defaultStyle);
    }
    
    /**
     * Initialize layer control
     */
    initializeLayerControl() {
        // Create layer control if it doesn't exist
        if (!this.layerControl) {
            this.layerControl = L.control.layers(
                {
                    'Dark': this.baseLayers.dark,
                    'Light': this.baseLayers.light,
                    'Satellite': this.baseLayers.satellite,
                    'Terrain': this.baseLayers.terrain,
                    'OpenStreetMap': this.baseLayers.osm
                },
                this.overlayLayers,
                { collapsed: true }
            ).addTo(this.map);
        }
    }
    
    /**
     * Set the map style (base layer)
     * @param {string} style - Style name ('dark', 'light', 'satellite', 'terrain', 'osm')
     */
    setMapStyle(style) {
        // Remove all base layers
        Object.values(this.baseLayers).forEach(layer => {
            if (this.map.hasLayer(layer)) {
                this.map.removeLayer(layer);
            }
        });
        
        // Add the selected base layer
        if (this.baseLayers[style]) {
            this.baseLayers[style].addTo(this.map);
            console.log(`Map style set to ${style}`);
        } else {
            // Default to dark if style not found
            this.baseLayers.dark.addTo(this.map);
            console.log(`Map style ${style} not found, defaulting to dark`);
        }
        
        // Save preference
        localStorage.setItem('mapStyle', style);
    }
    
    /**
     * Add an overlay layer to the map
     * @param {Object} layer - Leaflet layer
     * @param {string} name - Layer name
     * @returns {Object} The added layer
     */
    addOverlayLayer(layer, name) {
        // Add to overlay layers
        this.overlayLayers[name] = layer;
        
        // Update layer control
        if (this.layerControl) {
            this.layerControl.remove();
            this.layerControl = null;
            this.initializeLayerControl();
        }
        
        return layer;
    }
    
    /**
     * Remove an overlay layer from the map
     * @param {string} name - Layer name
     */
    removeOverlayLayer(name) {
        if (this.overlayLayers[name]) {
            if (this.map.hasLayer(this.overlayLayers[name])) {
                this.map.removeLayer(this.overlayLayers[name]);
            }
            
            delete this.overlayLayers[name];
            
            // Update layer control
            if (this.layerControl) {
                this.layerControl.remove();
                this.layerControl = null;
                this.initializeLayerControl();
            }
        }
    }
    
    /**
     * Set the map view to a specific location
     * @param {Array} center - [lat, lng] coordinates
     * @param {number} zoom - Zoom level
     */
    setView(center, zoom) {
        this.map.setView(center, zoom);
    }
    
    /**
     * Fit the map to bounds
     * @param {Object} bounds - Leaflet bounds object
     */
    fitBounds(bounds) {
        this.map.fitBounds(bounds);
    }
}

module.exports = MapController;