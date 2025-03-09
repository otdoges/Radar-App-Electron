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

    initializeAlerts() {
        // Get the current map bounds and fetch alerts for that area
        const bounds = map.getBounds();
        const center = bounds.getCenter();
        const state = this.getStateFromCoordinates(center.lat, center.lng);
        if (state) {
            alertsHandler.fetchActiveAlerts(state);
        }
        
        // Set up event listener for map movement to update alerts
        map.on('moveend', () => {
            const newBounds = map.getBounds();
            const newCenter = newBounds.getCenter();
            const newState = this.getStateFromCoordinates(newCenter.lat, newCenter.lng);
            if (newState) {
                alertsHandler.fetchActiveAlerts(newState);
            }
        });
    }
    
    getStateFromCoordinates(lat, lng) {
        // This is a simplified approach - in a real app you'd use a proper geocoding service
        // or a GeoJSON of state boundaries to determine the state
        return 'US'; // Default to all US alerts
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
            const bounds = [
                [coords[1] - 2.25, coords[0] - 2.25],
                [coords[1] + 2.25, coords[0] + 2.25]
            ];
            
            // Add the radar image to the map
            this.radarOverlay = L.imageOverlay(imageUrl, bounds, {
                opacity: 0.7,
                interactive: true
            }).addTo(map);
            
            // Zoom to the radar station
            map.setView([coords[1], coords[0]], 8);
            
            // If velocity data is requested, process it
            if (productCode === 'N0U' || productCode === 'N0V') {
                this.radarProcessor.processVelocityData();
            }
            
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
        } catch (error) {
            console.error('Error loading radar data:', error);
        } finally {
            // Hide loading indicator
            document.getElementById('loading-indicator').style.display = 'none';
        }
    }

    play() {
        this.isPlaying = true;
        
        // Clear any existing animation interval
        if (this.animationInterval) {
            clearInterval(this.animationInterval);
        }
        
        // Start animation loop
        this.animationInterval = setInterval(() => {
            if (this.currentStation && this.productSelector) {
                this.loadRadarData(
                    this.currentStation,
                    this.productSelector.currentProduct,
                    this.productSelector.currentTilt
                );
            }
        }, 5 * 60 * 1000); // Update every 5 minutes
    }

    pause() {
        this.isPlaying = false;
        
        if (this.animationInterval) {
            clearInterval(this.animationInterval);
            this.animationInterval = null;
        }
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
    }
    
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