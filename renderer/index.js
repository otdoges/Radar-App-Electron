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

// Initialize the radar data handler with Level 2 as default
const radarDataHandler = new RadarDataHandler(mapController, threddsConnector);
radarDataHandler.defaultLevel = 2; // Set default radar level to 2
radarDataHandler.initialize();
window.radarDataHandler = radarDataHandler;

// Initialize the radar controller with Level 2 as default
const radarController = new RadarController(mapController, threddsConnector);
radarController.defaultLevel = 2; // Set default radar level to 2
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
                // For Level 2, we use different product names
                radarDataHandler.loadRadarData(selectedStation, selectedProduct, 2);
            }
        });
    }
    
    // Set up radar level toggle
    const level2Toggle = document.getElementById('level2-toggle');
    const level3Toggle = document.getElementById('level3-toggle');
    
    if (level2Toggle) {
        level2Toggle.addEventListener('change', () => {
            if (level2Toggle.checked) {
                radarController.defaultLevel = 2;
                radarDataHandler.defaultLevel = 2;
                
                // Reload current station with Level 2 data
                const selectedStation = stationSelect.value;
                if (selectedStation) {
                    radarController.loadRadarData(selectedStation, 'Reflectivity', 2);
                }
                
                // Update product select options for Level 2
                updateProductOptions(2);
            }
        });
    }
    
    if (level3Toggle) {
        level3Toggle.addEventListener('change', () => {
            if (level3Toggle.checked) {
                radarController.defaultLevel = 3;
                radarDataHandler.defaultLevel = 3;
                
                // Reload current station with Level 3 data
                const selectedStation = stationSelect.value;
                if (selectedStation) {
                    radarController.loadRadarData(selectedStation, 'N0Q', 3);
                }
                
                // Update product select options for Level 3
                updateProductOptions(3);
            }
        });
    }
    
    // Function to update product options based on radar level
    function updateProductOptions(level) {
        if (!productSelect) return;
        
        // Clear existing options
        productSelect.innerHTML = '';
        
        if (level === 2) {
            // Level 2 products
            const level2Products = [
                { code: 'Reflectivity', name: 'Reflectivity' },
                { code: 'RadialVelocity', name: 'Radial Velocity' },
                { code: 'SpectrumWidth', name: 'Spectrum Width' }
            ];
            
            level2Products.forEach(product => {
                const option = document.createElement('option');
                option.value = product.code;
                option.textContent = product.name;
                productSelect.appendChild(option);
            });
        } else {
            // Level 3 products
            const level3Products = [
                { code: 'N0Q', name: 'Base Reflectivity (0.5°)' },
                { code: 'N1Q', name: 'Base Reflectivity (1.5°)' },
                { code: 'N0U', name: 'Base Velocity (0.5°)' },
                { code: 'N1U', name: 'Base Velocity (1.5°)' },
                { code: 'NCR', name: 'Composite Reflectivity' },
                { code: 'NTP', name: 'Storm Total Precipitation' }
            ];
            
            level3Products.forEach(product => {
                const option = document.createElement('option');
                option.value = product.code;
                option.textContent = product.name;
                productSelect.appendChild(option);
            });
        }
    }
    
    // Initialize product options based on default level
    updateProductOptions(radarController.defaultLevel);
    
    // Set up refresh button
    const refreshBtn = document.getElementById('refresh-btn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
            const selectedStation = stationSelect.value;
            const selectedProduct = productSelect.value;
            if (selectedStation) {
                radarDataHandler.loadRadarData(
                    selectedStation, 
                    selectedProduct || (radarDataHandler.defaultLevel === 2 ? 'Reflectivity' : 'N0Q'),
                    radarDataHandler.defaultLevel
                );
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