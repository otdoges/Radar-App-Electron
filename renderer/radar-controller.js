/**
 * Radar Controller
 * Manages radar station selection, data loading, and display
 */
const RadarProcessor = require('../radar-processor');

class RadarController {
    constructor(mapController, threddsConnector) {
        this.mapController = mapController;
        this.map = mapController.getMap();
        this.threddsConnector = threddsConnector;
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
        
        this.crosshair = { x: 0, y: 0 };
        this.measurementOverlay = document.createElement('div');
        this.measurementOverlay.className = 'measurement-overlay';
        document.getElementById('map').appendChild(this.measurementOverlay);
        
        this.initializeCrosshair();
        this.loadNexradStations();
    }
    
    // Initialize crosshair for measurements
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
    
    // Update measurement display
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
    
    // Load NEXRAD stations
    async loadNexradStations() {
        try {
            const response = await fetch('https://api.weather.gov/radar/stations');
            const data = await response.json();
            this.nexradStations = data.features;
            this.populateStationSelect();
            this.addStationMarkers();
            
            // Initialize product selector after stations are loaded
            const ProductSelector = require('../product-selector');
            this.productSelector = new ProductSelector(this);
        } catch (error) {
            console.error('Error loading NEXRAD stations:', error);
        }
    }
    
    // Add station markers to the map
    addStationMarkers() {
        this.nexradStations.forEach(station => {
            const coords = station.geometry.coordinates;
            const marker = L.marker([coords[1], coords[0]], {
                icon: L.divIcon({
                    className: 'radar-station-marker',
                    html: `<div class="station-icon"></div><div class="station-label">${station.properties.id}</div>`,
                    iconSize: [40, 20]
                })
            });
    
            marker.bindPopup(`
                <div class="station-popup">
                    <h3>${station.properties.name}</h3>
                    <p>ID: ${station.properties.id}</p>
                    <button class="select-station-btn" onclick="radarController.selectStation('${station.properties.id}')">
                        Select Station
                    </button>
                </div>
            `);
    
            marker.addTo(this.map);
            this.markers.set(station.properties.id, marker);
        });
    }
    
    // Populate station select dropdown
    populateStationSelect() {
        const stationSelect = document.getElementById('station-select');
        if (!stationSelect) return;
        
        // Clear existing options
        stationSelect.innerHTML = '<option value="">Select a radar station</option>';
        
        // Add stations
        this.nexradStations.forEach(station => {
            const option = document.createElement('option');
            option.value = station.properties.id;
            option.textContent = `${station.properties.id} - ${station.properties.name}`;
            stationSelect.appendChild(option);
        });
        
        // Add event listener
        stationSelect.addEventListener('change', () => {
            const selectedStationId = stationSelect.value;
            if (selectedStationId) {
                this.selectStation(selectedStationId);
            }
        });
    }
    
    // Select a radar station
    selectStation(stationId) {
        if (this.currentStation) {
            // Reset previous station marker
            const prevMarker = this.markers.get(this.currentStation);
            if (prevMarker) {
                prevMarker.getElement().classList.remove('active-station');
            }
        }
        
        this.currentStation = stationId;
        
        // Highlight the selected station marker
        const marker = this.markers.get(stationId);
        if (marker) {
            marker.getElement().classList.add('active-station');
            
            // Get coordinates and zoom to station
            const station = this.nexradStations.find(s => s.properties.id === stationId);
            if (station) {
                const coords = station.geometry.coordinates;
                this.map.setView([coords[1], coords[0]], 8);
            }
        }
        
        // Update the station select dropdown
        const stationSelect = document.getElementById('station-select');
        if (stationSelect) {
            stationSelect.value = stationId;
        }
        
        // Load radar data for the selected station
        this.loadRadarData(stationId);
    }
    
    // Load radar data for a station
    async loadRadarData(stationId, productCode = 'N0Q', tilt = 1) {
        if (!stationId) return;
        
        this.currentStation = stationId;
        
        // Use the radar data handler to load the data
        window.radarDataHandler.loadRadarData(stationId, productCode);
    }
    
    // Initialize UI controls
    initializeControls() {
        // Set up play/pause buttons
        const playBtn = document.getElementById('play');
        const pauseBtn = document.getElementById('pause');
        
        if (playBtn) {
            playBtn.addEventListener('click', () => this.play());
        }
        
        if (pauseBtn) {
            pauseBtn.addEventListener('click', () => this.pause());
        }
        
        // Set up opacity slider
        const opacitySlider = document.getElementById('opacity-slider');
        if (opacitySlider) {
            opacitySlider.addEventListener('input', (e) => {
                this.updateRadarOpacity(e.target.value);
            });
        }
        
        // Set up map style selector
        const mapStyleSelect = document.getElementById('map-style');
        if (mapStyleSelect) {
            mapStyleSelect.addEventListener('change', () => {
                this.mapController.setMapStyle(mapStyleSelect.value);
            });
            
            // Set initial value from localStorage
            const savedStyle = localStorage.getItem('mapStyle') || 'dark';
            mapStyleSelect.value = savedStyle;
        }
    }
    
    // Play animation
    play() {
        this.isPlaying = true;
        document.getElementById('play').classList.add('active');
        document.getElementById('pause').classList.remove('active');
        
        if (this.animationFrames.length === 0) {
            // No frames loaded yet, load them
            this.loadAnimationFrames();
        } else {
            // Start the animation
            this.startAnimation();
        }
    }
    
    // Pause animation
    pause() {
        this.isPlaying = false;
        document.getElementById('play').classList.remove('active');
        document.getElementById('pause').classList.add('active');
        
        if (this.animationInterval) {
            clearInterval(this.animationInterval);
            this.animationInterval = null;
        }
    }
    
    // Update radar opacity
    updateRadarOpacity(opacity) {
        // Convert opacity from 0-100 range to 0-1 range for Leaflet
        const normalizedOpacity = opacity / 100;
        
        if (this.radarOverlay) {
            this.radarOverlay.setOpacity(normalizedOpacity);
            console.log(`Radar opacity set to ${normalizedOpacity}`);
        }
        
        // Save preference
        localStorage.setItem('radarOpacity', opacity);
    }
    
    // Load animation frames
    async loadAnimationFrames() {
        if (!this.currentStation) return;
        
        try {
            document.getElementById('loading-indicator').style.display = 'block';
            
            // Clear existing frames
            this.animationFrames = [];
            this.currentFrameIndex = 0;
            
            // Get the last 10 frames
            const frames = await window.radarDataHandler.loadHistoricalFrames(
                this.currentStation, 
                10
            );
            
            if (frames && frames.length > 0) {
                this.animationFrames = frames;
                this.startAnimation();
            } else {
                console.error('No animation frames loaded');
            }
        } catch (error) {
            console.error('Error loading animation frames:', error);
        } finally {
            document.getElementById('loading-indicator').style.display = 'none';
        }
    }
    
    // Start animation playback
    startAnimation() {
        if (this.animationInterval) {
            clearInterval(this.animationInterval);
        }
        
        if (this.animationFrames.length === 0) return;
        
        this.animationInterval = setInterval(() => {
            if (!this.isPlaying) return;
            
            // Show the current frame
            this.showAnimationFrame(this.currentFrameIndex);
            
            // Increment frame index
            this.currentFrameIndex = (this.currentFrameIndex + 1) % this.animationFrames.length;
        }, 500); // 500ms between frames
    }
    
    // Show a specific animation frame
    showAnimationFrame(index) {
        if (!this.animationFrames[index]) return;
        
        const frame = this.animationFrames[index];
        
        // Remove existing overlay
        if (this.radarOverlay) {
            this.map.removeLayer(this.radarOverlay);
        }
        
        // Add the new overlay
        this.radarOverlay = frame.layer;
        this.radarOverlay.addTo(this.map);
        
        // Update timestamp display
        const timestampElement = document.getElementById('radar-timestamp');
        if (timestampElement) {
            const date = new Date(frame.timestamp);
            timestampElement.textContent = date.toLocaleString();
        }
    }
    
    // Clear all radar data
    clearRadarData() {
        // Stop animation
        this.pause();
        
        // Clear animation frames
        this.animationFrames = [];
        this.currentFrameIndex = 0;
        
        // Remove radar overlay
        if (this.radarOverlay) {
            this.map.removeLayer(this.radarOverlay);
            this.radarOverlay = null;
        }
        
        // Clear current station
        this.currentStation = null;
        
        // Reset station markers
        this.markers.forEach(marker => {
            marker.getElement().classList.remove('active-station');
        });
        
        // Reset station select
        const stationSelect = document.getElementById('station-select');
        if (stationSelect) {
            stationSelect.value = '';
        }
    }
}

module.exports = RadarController;