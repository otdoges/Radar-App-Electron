const map = L.map('map').setView([39.8283, -98.5795], 4);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors'
}).addTo(map);

class RadarController {
    constructor() {
        this.nexradStations = [];
        this.currentStation = null;
        this.isPlaying = false;
        this.currentData = null;
        this.markers = new Map();
        this.radarProcessor = new RadarProcessor();
        this.productSelector = null;
        this.animationInterval = null;
        this.animationFrames = [];
        this.currentFrameIndex = 0;
        this.radarOverlay = null;
        
        this.initializeControls();
        this.loadNexradStations();
        this.crosshair = { x: 0, y: 0 };
        this.measurementOverlay = document.createElement('div');
        this.measurementOverlay.className = 'measurement-overlay';
        document.getElementById('map').appendChild(this.measurementOverlay);
        
        this.initializeCrosshair();
        
        // Initialize alert handler for the current area
        this.initializeAlerts();
    }

    getStateFromCoordinates(lat, lng) {
        // In a real application, you would use a reverse geocoding service
        // or a GeoJSON of state boundaries to determine the state
        
        // For now, we'll use a simple approach based on the map center
        // This is a placeholder - in a real app you'd use proper geocoding
        
        // Get the current map bounds
        const bounds = map.getBounds();
        const ne = bounds.getNorthEast();
        const sw = bounds.getSouthWest();
        
        // Calculate the center of the visible map
        const centerLat = (ne.lat + sw.lat) / 2;
        const centerLng = (ne.lng + sw.lng) / 2;
        
        // If we're zoomed in enough, try to determine the state
        // This is a very simplified approach
        if (map.getZoom() > 6) {
            // These are very rough approximations of state boundaries
            // In a real app, you'd use proper geocoding or GeoJSON boundaries
            if (centerLng < -100 && centerLat > 40) return 'ND,SD,MT,WY,MN';
            if (centerLng < -100 && centerLat < 40) return 'TX,OK,NM,CO,KS';
            if (centerLng > -100 && centerLng < -85 && centerLat > 40) return 'OH,MI,IN,IL,WI';
            if (centerLng > -100 && centerLng < -85 && centerLat < 40) return 'AL,MS,TN,KY,GA';
            if (centerLng > -85 && centerLat > 40) return 'NY,PA,NJ,MA,CT,RI,VT,NH,ME';
            if (centerLng > -85 && centerLat < 40) return 'FL,SC,NC,VA,WV,MD,DE';
        }
        
        return 'US'; // Default to all US alerts
    }

    initializeAlerts() {
        // Get the current map bounds and fetch alerts for that area
        const bounds = map.getBounds();
        const center = bounds.getCenter();
        const state = this.getStateFromCoordinates(center.lat, center.lng);
        
        console.log(`Initializing alerts for region: ${state}`);
        
        if (state) {
            // Make alertsHandler accessible globally
            window.alertsHandler = alertsHandler;
            alertsHandler.fetchActiveAlerts(state);
        }
        
        // Set up event listener for map movement to update alerts
        map.on('moveend', () => {
            // Only update alerts if they're visible
            const alertsCheckbox = document.getElementById('show-alerts');
            if (!alertsCheckbox || !alertsCheckbox.checked) return;
            
            const newBounds = map.getBounds();
            const newCenter = newBounds.getCenter();
            const newState = this.getStateFromCoordinates(newCenter.lat, newCenter.lng);
            
            if (newState) {
                console.log(`Map moved, fetching alerts for: ${newState}`);
                alertsHandler.fetchActiveAlerts(newState);
            }
        });
    }
    
    initializeCrosshair() {
        const mapElement = document.getElementById('map');
        mapElement.addEventListener('mousemove', (e) => {
            const rect = mapElement.getBoundingClientRect();
            this.crosshair = {
                x: e.clientX - rect.left,
                y: e.clientY - rect.top
            };
            this.updateMeasurements();
        });
    }

    updateMeasurements() {
        if (!this.radarProcessor || !this.radarProcessor.nexradData) return;
        
        const measurements = this.radarProcessor.drawCrosshair(
            this.crosshair.x,
            this.crosshair.y
        );

        this.measurementOverlay.innerHTML = `
            <div class="measurements">
                <div class="velocity">
                    Velocity: ${measurements.velocity ? 
                        `${measurements.velocity.ms.toFixed(1)} m/s (${measurements.velocity.mph.toFixed(1)} mph)` : 
                        'N/A'}
                </div>
                <div class="reflectivity">
                    Reflectivity: ${measurements.reflectivity ? 
                        `${measurements.reflectivity.toFixed(1)} dBZ` : 
                        'N/A'}
                </div>
                <div class="temperature">
                    Temperature: ${measurements.temperature ? 
                        `${measurements.temperature.toFixed(1)}°C (${(measurements.temperature * 1.8 + 32).toFixed(1)}°F)` : 
                        'N/A'}
                </div>
            </div>
        `;
    }

    async loadNexradStations() {
        try {
            const response = await fetch('https://api.weather.gov/radar/stations');
            const data = await response.json();
            this.nexradStations = data.features;
            this.populateStationSelect();
            this.addStationMarkers();
            
            // Initialize product selector after stations are loaded
            this.productSelector = new ProductSelector(this);
        } catch (error) {
            console.error('Error loading NEXRAD stations:', error);
        }
    }

    addStationMarkers() {
        this.nexradStations.forEach(station => {
            const coords = station.geometry.coordinates;
            const marker = L.marker([coords[1], coords[0]], {
                icon: L.divIcon({
                    className: 'radar-station-marker',
                    html: `<div class="station-icon"></div>`,
                    iconSize: [12, 12]
                })
            });

            marker.bindPopup(`
                <div class="station-popup">
                    <h3>${station.properties.name}</h3>
                    <p>ID: ${station.properties.id}</p>
                    <button onclick="radarController.selectStation('${station.properties.id}')">
                        Select Station
                    </button>
                </div>
            `);

            marker.addTo(map);
            this.markers.set(station.properties.id, marker);
        });
    }

    selectStation(stationId) {
        if (this.currentStation) {
            this.markers.get(this.currentStation).getElement()
                .classList.remove('active-station');
        }
        
        this.currentStation = stationId;
        this.markers.get(stationId).getElement()
            .classList.add('active-station');
        
        document.getElementById('radar-site').value = stationId;
        
        // Use the current product from the product selector
        const productCode = this.productSelector ? 
            this.productSelector.currentProduct : 'N0Q';
        const tilt = this.productSelector ? 
            this.productSelector.currentTilt : 1;
            
        this.loadRadarData(stationId, productCode, tilt);
    }

    populateStationSelect() {
        const select = document.getElementById('radar-site');
        select.innerHTML = '<option value="">Select a radar station</option>';
        
        this.nexradStations.forEach(station => {
            const option = document.createElement('option');
            option.value = station.properties.id;
            option.textContent = `${station.properties.name} (${station.properties.id})`;
            select.appendChild(option);
        });
    }

    initializeControls() {
        document.getElementById('play').addEventListener('click', () => this.play());
        document.getElementById('pause').addEventListener('click', () => this.pause());
        document.getElementById('radar-site').addEventListener('change', (e) => this.changeStation(e.target.value));
        
        // Layer control checkboxes
        document.getElementById('show-alerts').addEventListener('change', (e) => {
            const alertsPanel = document.getElementById('alerts-panel');
            alertsPanel.style.display = e.target.checked ? 'block' : 'none';
        });
        
        document.getElementById('show-velocity').addEventListener('change', (e) => {
            if (e.target.checked) {
                this.showVelocityLayer();
            } else {
                this.hideVelocityLayer();
            }
        });
        
        document.getElementById('show-temperature').addEventListener('change', (e) => {
            if (e.target.checked) {
                this.showTemperatureLayer();
            } else {
                this.hideTemperatureLayer();
            }
        });
    }

    async loadRadarData(stationId, productCode = 'N0Q', tilt = 1) {
        if (!stationId) return;
        
        this.currentStation = stationId;
        
        // Show loading indicator
        document.getElementById('loading-indicator').style.display = 'block';
        
        try {
            // Clear any existing radar overlay
            if (this.radarOverlay) {
                map.removeLayer(this.radarOverlay);
                this.radarOverlay = null;
            }
            
            // Process the radar data
            const imageUrl = await this.radarProcessor.processNexradData(stationId, productCode, tilt);
            
            if (!imageUrl) {
                console.error('Failed to generate radar image');
                return;
            }
            
            // Get the station coordinates
            const station = this.nexradStations.find(s => s.properties.id === stationId);
            if (!station) {
                console.error('Station not found:', stationId);
                return;
            }
            
            const coords = station.geometry.coordinates;
            
            // Create image overlay bounds (approximately 250km radius)
            // Using proper calculation for radar coverage area
            const latLonPerKm = 1 / 111; // Rough approximation: 1 degree is about 111km
            const radarRange = 250 * latLonPerKm; // 250km radar range
            
            const bounds = [
                [coords[1] - radarRange, coords[0] - radarRange],
                [coords[1] + radarRange, coords[0] + radarRange]
            ];
            
            // Create a new image element to ensure the image is loaded before adding to map
            const img = new Image();
            img.onload = () => {
                // Add the radar image to the map
                this.radarOverlay = L.imageOverlay(imageUrl, bounds, {
                    opacity: 0.7,
                    interactive: true
                }).addTo(map);
                
                // Zoom to the radar station
                map.setView([coords[1], coords[0]], 8);
                
                // Update measurements if crosshair is active
                this.updateMeasurements();
                
                // Add to animation frames if playing
                if (this.isPlaying) {
                    this.animationFrames.push({
                        imageUrl,
                        timestamp: new Date()
                    });
                    
                    // Keep only the last 10 frames
                    if (this.animationFrames.length > 10) {
                        this.animationFrames.shift();
                    }
                }
            };
            
            img.onerror = () => {
                console.error('Failed to load radar image');
                alert('Failed to load radar image. Please try again.');
            };
            
            img.src = imageUrl;
        } catch (error) {
            console.error('Error loading radar data:', error);
            alert(`Error loading radar data: ${error.message}`);
        } finally {
            // Hide loading indicator
            document.getElementById('loading-indicator').style.display = 'none';
        }
    }

    // Fix the play/pause functionality
    play() {
        this.isPlaying = true;
        document.getElementById('play').classList.add('active');
        document.getElementById('pause').classList.remove('active');
        
        // Clear any existing animation interval
        if (this.animationInterval) {
            clearInterval(this.animationInterval);
        }
        
        // Start animation loop with proper frame rate
        const frameRate = this.animationFrameRate || 5 * 60 * 1000; // Default to 5 minutes if not set
        
        this.animationInterval = setInterval(() => {
            if (this.currentStation && this.productSelector) {
                this.loadRadarData(
                    this.currentStation,
                    this.productSelector.currentProduct,
                    this.productSelector.currentTilt
                );
            }
        }, frameRate);
    }

    pause() {
        this.isPlaying = false;
        document.getElementById('play').classList.remove('active');
        document.getElementById('pause').classList.add('active');
        
        if (this.animationInterval) {
            clearInterval(this.animationInterval);
            this.animationInterval = null;
        }
    }

    // Fix the updateRadarOpacity function to properly reference the radarOverlay
    function updateRadarOpacity(opacity) {
        if (window.radarController && window.radarController.radarOverlay) {
            window.radarController.radarOverlay.setOpacity(opacity);
        }
        
        // Save preference
        localStorage.setItem('radarOpacity', opacity);
    }

    showVelocityLayer() {
        if (this.currentStation && this.productSelector) {
            // Switch to velocity product
            const currentProduct = this.productSelector.currentProduct;
            if (currentProduct === 'N0Q') {
                this.productSelector.selectProduct('N0U');
            } else if (currentProduct === 'N0R') {
                this.productSelector.selectProduct('N0V');
            }
        }
    }
    
hideVelocityLayer() {
        if (this.currentStation && this.productSelector) {
            // Switch back to reflectivity product
            const currentProduct = this.productSelector.currentProduct;
            if (currentProduct === 'N0U') {
                this.productSelector.selectProduct('N0Q');
            } else if (currentProduct === 'N0V') {
                this.productSelector.selectProduct('N0R');
            }
        }
    };
    
    showTemperatureLayer() {
        // Implementation for temperature layer
        if (this.currentStation) {
            // Request temperature data from the radar processor
            this.radarProcessor.loadTemperatureData(this.currentStation)
                .then(success => {
                    if (success) {
                        this.updateMeasurements();
                    }
                });
        }
    }
    
    hideTemperatureLayer() {
        // Implementation for hiding temperature layer
        this.radarProcessor.clearTemperatureData();
        this.updateMeasurements();
}
    
    changeStation(stationId) {
        this.currentStation = stationId;
        
        // Use the current product from the product selector
        const productCode = this.productSelector ? 
            this.productSelector.currentProduct : 'N0Q';
        const tilt = this.productSelector ? 
            this.productSelector.currentTilt : 1;
            
        this.loadRadarData(stationId, productCode, tilt);
    }
}

// Initialize the radar controller
const radarController = new RadarController();

// Initialize alerts handler
const alertsHandler = new AlertsHandler();

// Make it globally accessible
window.radarController = radarController;

// Add after the existing initialization code

// Initialize sidebar and settings functionality
function initializeUI() {
    // Sidebar toggle functionality
    const sidebarToggle = document.getElementById('sidebar-toggle');
    const sidebar = document.getElementById('sidebar');
    
    if (sidebarToggle && sidebar) {
        sidebarToggle.addEventListener('click', () => {
            sidebar.classList.toggle('collapsed');
            
            // Update toggle icon
            const icon = sidebarToggle.querySelector('i');
            if (icon) {
                if (sidebar.classList.contains('collapsed')) {
                    icon.classList.remove('fa-chevron-left');
                    icon.classList.add('fa-chevron-right');
                } else {
                    icon.classList.remove('fa-chevron-right');
                    icon.classList.add('fa-chevron-left');
                }
            }
        });
    }
    
    // Section toggles for collapsible sections
    const sectionToggles = document.querySelectorAll('.section-toggle');
    sectionToggles.forEach(toggle => {
        toggle.addEventListener('click', (e) => {
            e.stopPropagation();
            const section = toggle.closest('.control-section');
            const content = section.querySelector('.section-content');
            
            // Toggle section content visibility
            if (content) {
                content.classList.toggle('active');
                
                // Update toggle icon
                const icon = toggle.querySelector('i');
                if (icon) {
                    icon.classList.toggle('fa-chevron-down');
                    icon.classList.toggle('fa-chevron-up');
                }
            }
        });
        
        // Set first section to be open by default
        const section = toggle.closest('.control-section');
        if (section && section === document.querySelector('.control-section')) {
            const content = section.querySelector('.section-content');
            if (content) {
                content.classList.add('active');
                const icon = toggle.querySelector('i');
                if (icon) {
                    icon.classList.remove('fa-chevron-down');
                    icon.classList.add('fa-chevron-up');
                }
            }
        }
    });
    
    // Make section headers also toggle their content
    const sectionHeaders = document.querySelectorAll('.control-section h3');
    sectionHeaders.forEach(header => {
        header.addEventListener('click', (e) => {
            if (e.target === header || e.target.tagName !== 'BUTTON') {
                const toggle = header.querySelector('.section-toggle');
                if (toggle) {
                    toggle.click();
                }
            }
        });
    });
    
    // Settings panel toggle
    const settingsToggle = document.getElementById('settings-toggle');
    const settingsPanel = document.getElementById('settings-panel');
    const closeSettings = document.querySelector('.close-settings');
    
    if (settingsToggle && settingsPanel) {
        settingsToggle.addEventListener('click', () => {
            settingsPanel.classList.add('active');
        });
        
        if (closeSettings) {
            closeSettings.addEventListener('click', () => {
                settingsPanel.classList.remove('active');
            });
        }
        
        // Close settings when clicking outside
        window.addEventListener('click', (e) => {
            if (settingsPanel.classList.contains('active') && 
                !settingsPanel.contains(e.target) && 
                e.target !== settingsToggle) {
                settingsPanel.classList.remove('active');
            }
        });
    }
    
    // Initialize settings controls
    initializeSettingsControls();
}

// Initialize settings controls and their functionality
function initializeSettingsControls() {
    // Map style setting
    const mapStyleSelect = document.getElementById('map-style');
    if (mapStyleSelect) {
        mapStyleSelect.addEventListener('change', (e) => {
            const style = e.target.value;
            updateMapStyle(style);
        });
    }
    
    // Radar opacity setting
    const radarOpacitySlider = document.getElementById('radar-opacity');
    if (radarOpacitySlider) {
        radarOpacitySlider.addEventListener('input', (e) => {
            const opacity = parseInt(e.target.value) / 100;
            updateRadarOpacity(opacity);
        });
    }
    
    // Animation frame rate setting
    const frameRateSelect = document.getElementById('frame-rate');
    if (frameRateSelect) {
        frameRateSelect.addEventListener('change', (e) => {
            const frameRate = parseInt(e.target.value);
            updateAnimationFrameRate(frameRate);
        });
    }
    
    // Loop count setting
    const loopCountInput = document.getElementById('loop-count');
    if (loopCountInput) {
        loopCountInput.addEventListener('change', (e) => {
            const loopCount = parseInt(e.target.value);
            updateAnimationLoopCount(loopCount);
        });
    }
}

// Update map style based on selection
function updateMapStyle(style) {
    if (!map) return;
    
    // Remove current base layer
    map.eachLayer(layer => {
        if (layer._url && layer._url.includes('tile')) {
            map.removeLayer(layer);
        }
    });
    
    // Add new base layer based on style
    switch (style) {
        case 'satellite':
            L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
                attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
            }).addTo(map);
            break;
        case 'dark':
            L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
            }).addTo(map);
            break;
        default: // default OSM style
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            }).addTo(map);
    }
    
    // Save preference
    localStorage.setItem('mapStyle', style);
}

// Update radar overlay opacity
function updateRadarOpacity(opacity) {
    if (this.radarOverlay) {
        this.radarOverlay.setOpacity(opacity);
    }
    
    // Save preference
    localStorage.setItem('radarOpacity', opacity);
}

// Update animation frame rate
function updateAnimationFrameRate(frameRate) {
    this.animationFrameRate = frameRate;
    
    // If animation is currently playing, restart it with new frame rate
    if (this.isPlaying) {
        this.stopAnimation();
        this.playAnimation();
    }
    
    // Save preference
    localStorage.setItem('animationFrameRate', frameRate);
}

// Update animation loop count
function updateAnimationLoopCount(loopCount) {
    this.animationLoopCount = loopCount;
    
    // Save preference
    localStorage.setItem('animationLoopCount', loopCount);
}

// Load user preferences from localStorage
function loadUserPreferences() {
    // Map style
    const savedMapStyle = localStorage.getItem('mapStyle');
    if (savedMapStyle) {
        const mapStyleSelect = document.getElementById('map-style');
        if (mapStyleSelect) {
            mapStyleSelect.value = savedMapStyle;
            updateMapStyle(savedMapStyle);
        }
    }
    
    // Radar opacity
    const savedOpacity = localStorage.getItem('radarOpacity');
    if (savedOpacity !== null) {
        const opacity = parseFloat(savedOpacity);
        const radarOpacitySlider = document.getElementById('radar-opacity');
        if (radarOpacitySlider) {
            radarOpacitySlider.value = opacity * 100;
        }
    }
    
    // Animation frame rate
    const savedFrameRate = localStorage.getItem('animationFrameRate');
    if (savedFrameRate) {
        const frameRate = parseInt(savedFrameRate);
        const frameRateSelect = document.getElementById('frame-rate');
        if (frameRateSelect) {
            frameRateSelect.value = frameRate;
        }
        this.animationFrameRate = frameRate;
    }
    
    // Animation loop count
    const savedLoopCount = localStorage.getItem('animationLoopCount');
    if (savedLoopCount) {
        const loopCount = parseInt(savedLoopCount);
        const loopCountInput = document.getElementById('loop-count');
        if (loopCountInput) {
            loopCountInput.value = loopCount;
        }
        this.animationLoopCount = loopCount;
    }
}

// Initialize warnings panel
function initializeWarningsPanel() {
    const alertsPanel = document.getElementById('alerts-panel');
    if (!alertsPanel) return;
    
    // Add header to alerts panel
    const header = document.createElement('div');
    header.className = 'alerts-header';
    header.innerHTML = `
        <h3>
            <i class="fas fa-exclamation-triangle"></i>
            Warnings
            <button class="alerts-toggle">
                <i class="fas fa-chevron-up"></i>
            </button>
        </h3>
    `;
    alertsPanel.prepend(header);
    
    // Add toggle functionality
    const alertsToggle = header.querySelector('.alerts-toggle');
    if (alertsToggle) {
        alertsToggle.addEventListener('click', () => {
            alertsPanel.classList.toggle('collapsed');
            
            // Update toggle icon
            const icon = alertsToggle.querySelector('i');
            if (icon) {
                icon.classList.toggle('fa-chevron-up');
                icon.classList.toggle('fa-chevron-down');
            }
        });
    }
}

// Call these functions after the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Initialize UI components first
    initializeUI();
    loadUserPreferences();
    initializeWarningsPanel();
    
    // Initialize the radar controller
    window.radarController = new RadarController();
    
    // Add error handling for map tiles
    map.on('tileerror', function(error) {
        console.error('Tile error:', error);
    });
});