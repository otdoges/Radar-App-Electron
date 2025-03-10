/**
 * Main renderer entry point
 * Initializes the application components and UI
 */

// Import required modules
const MapController = require('./map-controller');
const RadarController = require('./radar-controller');
const ThreddsConnector = require('../thredds-connector');
const RadarDataHandler = require('../radar-data-module/radar-data-handler');
const AlertsHandler = require('../alerts-handler');

// Initialize the THREDDS connector
const threddsConnector = new ThreddsConnector();
window.threddsConnector = threddsConnector;

// Initialize the map controller
const mapController = new MapController('map');
const map = mapController.getMap();

// Initialize the radar data handler
const radarDataHandler = new RadarDataHandler(mapController, threddsConnector);
radarDataHandler.initialize();
window.radarDataHandler = radarDataHandler;

// Initialize the radar controller
const radarController = new RadarController(mapController, threddsConnector);
window.radarController = radarController;

// Initialize the alerts handler
const alertsHandler = new AlertsHandler(map);
window.alertsHandler = alertsHandler;

// Set up event listeners for UI controls
document.addEventListener('DOMContentLoaded', () => {
    // Set up sidebar toggle
    const sidebarToggle = document.getElementById('sidebar-toggle');
    if (sidebarToggle) {
        sidebarToggle.addEventListener('click', () => {
            document.getElementById('sidebar').classList.toggle('collapsed');
            const icon = sidebarToggle.querySelector('i');
            if (document.getElementById('sidebar').classList.contains('collapsed')) {
                icon.className = 'fas fa-chevron-right';
            } else {
                icon.className = 'fas fa-chevron-left';
            }
        });
    }
    
    // Set up map style selector
    const mapStyleSelect = document.getElementById('map-style');
    if (mapStyleSelect) {
        mapStyleSelect.addEventListener('change', () => {
            mapController.setMapStyle(mapStyleSelect.value);
        });
        
        // Set initial value from localStorage
        const savedStyle = localStorage.getItem('mapStyle') || 'dark';
        mapStyleSelect.value = savedStyle;
    }
    
    // Set up opacity slider
    const opacitySlider = document.getElementById('opacity-slider');
    if (opacitySlider) {
        opacitySlider.addEventListener('input', (e) => {
            const opacity = e.target.value;
            radarController.updateRadarOpacity(opacity);
            localStorage.setItem('radarOpacity', opacity);
        });
        
        // Set initial value from localStorage
        const savedOpacity = localStorage.getItem('radarOpacity') || 70;
        opacitySlider.value = savedOpacity;
    }
    
    // Set up play/pause buttons
    const playBtn = document.getElementById('play');
    const pauseBtn = document.getElementById('pause');
    
    if (playBtn) {
        playBtn.addEventListener('click', () => radarController.play());
    }
    
    if (pauseBtn) {
        pauseBtn.addEventListener('click', () => radarController.pause());
    }
    
    // Set up station select
    const stationSelect = document.getElementById('station-select');
    if (stationSelect) {
        stationSelect.addEventListener('change', () => {
            const selectedStationId = stationSelect.value;
            if (selectedStationId) {
                radarController.selectStation(selectedStationId);
            }
        });
    }
    
    // Set up product select
    const productSelect = document.getElementById('product-select');
    if (productSelect) {
        productSelect.addEventListener('change', () => {
            const selectedProduct = productSelect.value;
            const selectedStation = stationSelect.value;
            if (selectedProduct && selectedStation) {
                radarDataHandler.loadRadarData(selectedStation, selectedProduct);
            }
        });
    }
    
    // Set up refresh button
    const refreshBtn = document.getElementById('refresh-btn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
            const selectedStation = stationSelect.value;
            const selectedProduct = productSelect.value;
            if (selectedStation) {
                radarDataHandler.loadRadarData(selectedStation, selectedProduct || 'N0Q');
            }
        });
    }
    
    // Set up clear button
    const clearBtn = document.getElementById('clear-btn');
    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            radarController.clearRadarData();
            radarDataHandler.removeAllRadarLayers();
        });
    }
    
    // Set up alerts toggle
    const alertsToggle = document.getElementById('alerts-toggle');
    if (alertsToggle) {
        alertsToggle.addEventListener('change', (e) => {
            if (e.target.checked) {
                alertsHandler.enableAlerts();
            } else {
                alertsHandler.disableAlerts();
            }
        });
    }
    
    console.log('UI event listeners initialized');
});

// Create the map-controller.js file