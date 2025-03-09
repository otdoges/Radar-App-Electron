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
    
            marker.addTo(map);
            this.markers.set(station.properties.id, marker);
        });
    }

    // Initialize THREDDS connector for additional data layers
    initializeThreddsConnector() {
        this.threddsConnector = new ThreddsConnector();
        this.additionalLayers = new Map();
        
        // Set up event listeners for layer buttons
        document.querySelectorAll('.layer-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const layerId = btn.getAttribute('data-layer');
                this.toggleLayer(layerId, btn);
            });
        });
        
        // Set up archive loader
        const loadArchiveBtn = document.getElementById('load-archive');
        if (loadArchiveBtn) {
            loadArchiveBtn.addEventListener('click', () => {
                const dateInput = document.getElementById('archive-date');
                const selectedDate = dateInput.value ? new Date(dateInput.value) : new Date();
                this.loadRadarArchive(this.currentStation, selectedDate);
            });
        }
    }

    // Toggle additional data layers from THREDDS
    async toggleLayer(layerId, button) {
        // Toggle button active state
        const isActive = button.classList.contains('active');
        
        if (isActive) {
            // Remove layer
            if (this.additionalLayers.has(layerId)) {
                map.removeLayer(this.additionalLayers.get(layerId));
                this.additionalLayers.delete(layerId);
            }
            button.classList.remove('active');
        } else {
            // Add layer
            button.classList.add('active');
            
            try {
                let layer;
                
                switch (layerId) {
                    case 'gfs-temperature':
                        const gfsData = await this.threddsConnector.getModelData('GFS');
                        if (gfsData) {
                            layer = this.threddsConnector.addWmsLayer(
                                map, 
                                gfsData.wmsUrl, 
                                'Temperature_surface', 
                                { opacity: 0.6, styles: 'temperature' }
                            );
                        }
                        break;
                        
                    case 'gfs-precipitation':
                        const gfsPrecip = await this.threddsConnector.getModelData('GFS');
                        if (gfsPrecip) {
                            layer = this.threddsConnector.addWmsLayer(
                                map, 
                                gfsPrecip.wmsUrl, 
                                'Total_precipitation_surface', 
                                { opacity: 0.7, styles: 'precip' }
                            );
                        }
                        break;
                        
                    case 'hrrr-reflectivity':
                        const hrrrData = await this.threddsConnector.getModelData('HRRR');
                        if (hrrrData) {
                            layer = this.threddsConnector.addWmsLayer(
                                map, 
                                hrrrData.wmsUrl, 
                                'Reflectivity_1000m_above_ground', 
                                { opacity: 0.7 }
                            );
                        }
                        break;
                        
                    case 'goes16-visible':
                        const visibleData = await this.threddsConnector.getSatelliteImagery('GOES16', 'ABI');
                        if (visibleData.length > 0) {
                            const visibleLayer = visibleData.find(d => d.name.includes('Channel02'));
                            if (visibleLayer) {
                                layer = this.threddsConnector.addWmsLayer(
                                    map, 
                                    visibleLayer.wmsUrl, 
                                    'Sectorized_CMI', 
                                    { opacity: 0.8 }
                                );
                            }
                        }
                        break;
                        
                    case 'goes16-infrared':
                        const irData = await this.threddsConnector.getSatelliteImagery('GOES16', 'ABI');
                        if (irData.length > 0) {
                            const irLayer = irData.find(d => d.name.includes('Channel13'));
                            if (irLayer) {
                                layer = this.threddsConnector.addWmsLayer(
                                    map, 
                                    irLayer.wmsUrl, 
                                    'Sectorized_CMI', 
                                    { opacity: 0.7, styles: 'ir_rgbcolor' }
                                );
                            }
                        }
                        break;
                }
                
                if (layer) {
                    this.additionalLayers.set(layerId, layer);
                } else {
                    console.error(`Failed to load layer: ${layerId}`);
                    button.classList.remove('active');
                }
            } catch (error) {
                console.error(`Error loading layer ${layerId}:`, error);
                button.classList.remove('active');
                alert(`Error loading ${layerId}: ${error.message}`);
            }
        }
    }

    // Load historical radar data from THREDDS archive
    async loadRadarArchive(stationId, date) {
        if (!stationId || !this.threddsConnector) return;
        
        try {
            document.getElementById('loading-indicator').style.display = 'block';
            
            const archives = await this.threddsConnector.getNexradArchives(stationId, date);
            
            if (archives.length === 0) {
                alert(`No radar archives found for ${stationId} on ${date.toLocaleDateString()}`);
                return;
            }
            
            // Sort archives by timestamp
            archives.sort((a, b) => a.timestamp - b.timestamp);
            
            // Create a modal to display available archives
            const modal = document.createElement('div');
            modal.className = 'modal';
            modal.innerHTML = `
                <div class="modal-content">
                    <span class="close-modal">&times;</span>
                    <h2>Available Radar Archives for ${stationId}</h2>
                    <div class="archive-list">
                        ${archives.map((archive, index) => `
                            <div class="archive-item" data-index="${index}">
                                <span class="archive-time">${archive.timestamp.toLocaleTimeString()}</span>
                                <span class="archive-name">${archive.name}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
            
            document.body.appendChild(modal);
            
            // Add event listeners
            const closeBtn = modal.querySelector('.close-modal');
            closeBtn.addEventListener('click', () => {
                document.body.removeChild(modal);
            });
            
            const archiveItems = modal.querySelectorAll('.archive-item');
            archiveItems.forEach(item => {
                item.addEventListener('click', () => {
                    const index = parseInt(item.getAttribute('data-index'), 10);
                    const archive = archives[index];
                    
                    // Display the selected archive
                    this.displayRadarArchive(archive);
                    
                    // Close the modal
                    document.body.removeChild(modal);
                });
            });
            
        } catch (error) {
            console.error('Error loading radar archives:', error);
            alert(`Error loading radar archives: ${error.message}`);
        } finally {
            document.getElementById('loading-indicator').style.display = 'none';
        }
    }

    // Display a selected radar archive
    async displayRadarArchive(archive) {
        try {
            document.getElementById('loading-indicator').style.display = 'block';
            
            // Clear any existing radar overlay
            if (this.radarOverlay) {
                map.removeLayer(this.radarOverlay);
                this.radarOverlay = null;
            }
            
            // Get the WMS URL for the archive
            const wmsUrl = archive.accessUrl.replace('dodsC', 'wms');
            
            // Get the station coordinates
            const station = this.nexradStations.find(s => s.properties.id === this.currentStation);
            if (!station) {
                console.error('Station not found:', this.currentStation);
                return;
            }
            
            const coords = station.geometry.coordinates;
            
            // Add the WMS layer to the map
            const layer = this.threddsConnector.addWmsLayer(
                map,
                wmsUrl,
                'Reflectivity',
                { 
                    opacity: 0.8,
                    styles: 'radar',
                    colorscalerange: '0,80',
                    time: archive.timestamp.toISOString()
                }
            );
            
            if (layer) {
                // Store the layer
                this.radarOverlay = layer;
                
                // Zoom to the radar station
                map.setView([coords[1], coords[0]], 8);
                
                // Update status
                console.log(`Displaying radar archive: ${archive.name}`);
                
                // Show timestamp
                const timestamp = document.createElement('div');
                timestamp.className = 'archive-timestamp';
                timestamp.textContent = `Archive: ${archive.timestamp.toLocaleString()}`;
                document.getElementById('map').appendChild(timestamp);
                
                // Remove timestamp after 5 seconds
                setTimeout(() => {
                    if (timestamp.parentNode) {
                        timestamp.parentNode.removeChild(timestamp);
                    }
                }, 5000);
            }
        } catch (error) {
            console.error('Error displaying radar archive:', error);
            alert(`Error displaying radar archive: ${error.message}`);
        } finally {
            document.getElementById('loading-indicator').style.display = 'none';
        }
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
        console.log('Initializing radar controls');
        
        // Initialize product buttons
        const productButtons = document.querySelectorAll('.product-btn');
        productButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const productCode = btn.getAttribute('data-product');
                if (productCode) {
                    // Remove active class from all buttons
                    productButtons.forEach(b => b.classList.remove('active'));
                    // Add active class to clicked button
                    btn.classList.add('active');
                    
                    if (this.currentStation) {
                        this.loadRadarData(this.currentStation, productCode, this.currentTilt || 1);
                    }
                }
            });
        });
        
        // Initialize tilt buttons
        const tiltButtons = document.querySelectorAll('.tilt-btn');
        tiltButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const tilt = parseInt(btn.getAttribute('data-tilt'), 10);
                if (tilt) {
                    // Remove active class from all buttons
                    tiltButtons.forEach(b => b.classList.remove('active'));
                    // Add active class to clicked button
                    btn.classList.add('active');
                    
                    this.currentTilt = tilt;
                    if (this.currentStation) {
                        const productCode = document.querySelector('.product-btn.active')?.getAttribute('data-product') || 'N0Q';
                        this.loadRadarData(this.currentStation, productCode, tilt);
                    }
                }
            });
        });
        
        // Initialize radar site selector
        const radarSiteSelect = document.getElementById('radar-site');
        if (radarSiteSelect) {
            radarSiteSelect.addEventListener('change', () => {
                const stationId = radarSiteSelect.value;
                if (stationId) {
                    this.selectStation(stationId);
                }
            });
        }
        
        // Play/Pause buttons
        document.querySelectorAll('.animation-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                if (btn.id === 'play') {
                    this.play();
                } else if (btn.id === 'pause') {
                    this.pause();
                }
            });
        });
        
        // Settings panel toggle
        const settingsToggle = document.getElementById('settings-toggle');
        const settingsPanel = document.getElementById('settings-panel');
        const closeSettings = document.querySelector('.close-settings');
        
        if (settingsToggle && settingsPanel) {
            settingsToggle.addEventListener('click', () => {
                settingsPanel.classList.toggle('active');
            });
            
            if (closeSettings) {
                closeSettings.addEventListener('click', () => {
                    settingsPanel.classList.remove('active');
                });
            }
        }
        
        // Radar opacity slider
        const opacitySlider = document.getElementById('radar-opacity');
        if (opacitySlider) {
            // Set initial value from localStorage if available
            const savedOpacity = localStorage.getItem('radarOpacity');
            if (savedOpacity) {
                opacitySlider.value = savedOpacity;
            }
            
            opacitySlider.addEventListener('input', (e) => {
                this.updateRadarOpacity(e.target.value);
            });
        }
        
        // Map style selector
        const mapStyleSelector = document.getElementById('map-style');
        if (mapStyleSelector) {
            // Set initial value from localStorage if available
            const savedStyle = localStorage.getItem('mapStyle');
            if (savedStyle) {
                mapStyleSelector.value = savedStyle;
                this.updateMapStyle(savedStyle);
            }
            
            mapStyleSelector.addEventListener('change', (e) => {
                this.updateMapStyle(e.target.value);
            });
        }
        
        // Set default active product
        const defaultProduct = document.querySelector('.product-btn[data-product="N0Q"]');
        if (defaultProduct) {
            defaultProduct.classList.add('active');
        }
        
        // Set default active tilt
        const defaultTilt = document.querySelector('.tilt-btn[data-tilt="1"]');
        if (defaultTilt) {
            defaultTilt.classList.add('active');
        }
    }

    updateMapStyle(style) {
        // Remove current base layer
        map.eachLayer(layer => {
            if (layer._url && layer._url.includes('tile')) {
                map.removeLayer(layer);
            }
        });
        
        // Add new base layer based on style
        let tileLayer;
        switch (style) {
            case 'satellite':
                tileLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
                    attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
                    maxZoom: 19
                });
                break;
            case 'dark':
                tileLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
                    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
                    subdomains: 'abcd',
                    maxZoom: 19
                });
                break;
            default: // default OSM style
                tileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
                    maxZoom: 19
                });
        }
        
        // Add the new layer to the map
        if (tileLayer) {
            tileLayer.addTo(map);
        }
        
        // Save preference
        localStorage.setItem('mapStyle', style);
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
                console.log('Radar image loaded successfully');
                
                // Add the radar image to the map
                this.radarOverlay = L.imageOverlay(imageUrl, bounds, {
                    opacity: 0.8,
                    interactive: true
                }).addTo(map);
                
                // Get saved opacity preference
                const savedOpacity = localStorage.getItem('radarOpacity');
                if (savedOpacity) {
                    this.radarOverlay.setOpacity(savedOpacity / 100);
                } else {
                    // Default to 80% opacity if not set
                    this.radarOverlay.setOpacity(0.8);
                    localStorage.setItem('radarOpacity', '80');
                }
                
                // Update the product legend based on the current product
                this.updateProductLegend(productCode);
                
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
            
            img.onerror = (e) => {
                console.error('Failed to load radar image', e);
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

    // Add a new method to update the product legend based on the current product
    updateProductLegend(productCode) {
        const legendElement = document.querySelector('.legend-gradient');
        if (!legendElement) return;
        
        // Remove all existing classes
        legendElement.className = 'legend-gradient';
        
        // Add the appropriate class based on the product
        switch(productCode) {
            case 'N0Q':
            case 'N0R':
                legendElement.classList.add('reflectivity-legend');
                break;
            case 'N0U':
            case 'N0V':
                legendElement.classList.add('velocity-legend');
                break;
            case 'N0C':
                legendElement.classList.add('correlation-legend');
                break;
            case 'N0K':
                legendElement.classList.add('differential-reflectivity-legend');
                break;
            case 'N0H':
                legendElement.classList.add('hydrometeor-legend');
                break;
            case 'N0X':
                legendElement.classList.add('differential-phase-legend');
                break;
            case 'NTP':
                legendElement.classList.add('vil-legend');
                break;
            default:
                legendElement.classList.add('reflectivity-legend');
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

    // Fix the updateRadarOpacity function - there's a duplicate implementation with code outside the function
    updateRadarOpacity(opacity) {
        // Convert opacity from 0-100 range to 0-1 range for Leaflet
        const normalizedOpacity = opacity / 100;
        
        if (this.radarOverlay) {
            this.radarOverlay.setOpacity(normalizedOpacity);
            console.log(`Radar opacity set to: ${normalizedOpacity}`);
        } else {
            console.warn('No radar overlay available to update opacity');
        }
        
        // Save preference
        localStorage.setItem('radarOpacity', opacity);
    }

    showVelocityLayer() {
        if (this.currentStation && this.productSelector) {
            // Switch to velocity product
            const currentProduct = this.productSelector.currentProduct;
            if (currentProduct === 'N0Q') {
                // Use the selectProduct method if it exists, otherwise update directly
                if (typeof this.productSelector.selectProduct === 'function') {
                    this.productSelector.selectProduct('N0U');
                } else {
                    this.loadRadarData(this.currentStation, 'N0U', this.productSelector.currentTilt || 1);
                }
            } else if (currentProduct === 'N0R') {
                if (typeof this.productSelector.selectProduct === 'function') {
                    this.productSelector.selectProduct('N0V');
                } else {
                    this.loadRadarData(this.currentStation, 'N0V', this.productSelector.currentTilt || 1);
                }
            }
        }
    }
    
    hideVelocityLayer() {
        if (this.currentStation && this.productSelector) {
            // Switch back to reflectivity product
            const currentProduct = this.productSelector.currentProduct;
            if (currentProduct === 'N0U') {
                if (typeof this.productSelector.selectProduct === 'function') {
                    this.productSelector.selectProduct('N0Q');
                } else {
                    this.loadRadarData(this.currentStation, 'N0Q', this.productSelector.currentTilt || 1);
                }
            } else if (currentProduct === 'N0V') {
                if (typeof this.productSelector.selectProduct === 'function') {
                    this.productSelector.selectProduct('N0R');
                } else {
                    this.loadRadarData(this.currentStation, 'N0R', this.productSelector.currentTilt || 1);
                }
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
                })
                .catch(error => {
                    console.error('Error loading temperature data:', error);
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

// Update the DOMContentLoaded event handler
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM fully loaded');
    
    // Initialize UI components first
    function initializeUI() {
        console.log('Initializing UI components');
        
        // Section toggles for collapsible sections
        const sectionToggles = document.querySelectorAll('.section-toggle');
        sectionToggles.forEach(toggle => {
            toggle.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const section = toggle.closest('.control-section');
                const content = section.querySelector('.section-content');
                
                // Toggle section content visibility
                if (content) {
                    content.classList.toggle('active');
                    
                    // Update toggle icon
                    const icon = toggle.querySelector('i');
                    if (icon) {
                        if (content.classList.contains('active')) {
                            icon.className = 'fas fa-chevron-up';
                        } else {
                            icon.className = 'fas fa-chevron-down';
                        }
                    }
                }
            });
        });
        
        // Initialize sidebar toggle
        const sidebarToggle = document.getElementById('sidebar-toggle');
        const sidebar = document.getElementById('sidebar');
        
        if (sidebarToggle && sidebar) {
            console.log('Setting up sidebar toggle');
            sidebarToggle.addEventListener('click', () => {
                console.log('Sidebar toggle clicked');
                sidebar.classList.toggle('collapsed');
                
                // Update toggle icon
                const icon = sidebarToggle.querySelector('i');
                if (icon) {
                    if (sidebar.classList.contains('collapsed')) {
                        icon.className = 'fas fa-chevron-right';
                    } else {
                        icon.className = 'fas fa-chevron-left';
                    }
                }
            });
        }
        
        // Open first section by default
        const firstSection = document.querySelector('.control-section');
        if (firstSection) {
            const content = firstSection.querySelector('.section-content');
            const toggle = firstSection.querySelector('.section-toggle i');
            if (content) {
                content.classList.add('active');
            }
            if (toggle) {
                toggle.className = 'fas fa-chevron-up';
            }
        }
    }
    
    // Initialize the radar controller and make it globally accessible
    window.radarController = new RadarController();
    
    // Initialize alerts handler
    window.alertsHandler = new AlertsHandler();
    
    // Load user preferences
    loadUserPreferences();
    
    // Initialize warnings panel
    initializeWarningsPanel();
    
    // Add error handling for map tiles
    map.on('tileerror', function(error) {
        console.error('Tile error:', error);
        // Try to reload the tile
        setTimeout(() => {
            error.tile.src = error.url;
        }, 1000);
    });
    
    // Force a map update
    setTimeout(() => {
        map.invalidateSize();
    }, 100);
});