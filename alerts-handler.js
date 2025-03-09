class AlertsHandler {
    constructor() {
        this.alerts = [];
        this.alertMarkers = [];
    }

    async fetchActiveAlerts(state = 'US') {
        try {
            // Use the Weather.gov alerts API
            const url = `https://api.weather.gov/alerts/active?area=${state}`;
            console.log(`Fetching alerts from: ${url}`);
            
            const response = await fetch(url, {
                headers: {
                    'Accept': 'application/geo+json',
                    'User-Agent': 'RadarApp/1.0 (https://github.com/yourusername/radar-app-electron)'
                }
            });
            
            if (!response.ok) {
                throw new Error(`API responded with status: ${response.status}`);
            }
            
            const data = await response.json();
            
            if (!data.features) {
                console.error('No alert features found in response');
                this.alerts = [];
                this.displayAlerts();
                return [];
            }
            
            this.alerts = data.features.map(feature => {
                // Extract coordinates for mapping
                const coordinates = this.extractCoordinates(feature.geometry);
                
                return {
                    id: feature.id,
                    title: feature.properties.headline || 'Weather Alert',
                    description: feature.properties.description || '',
                    severity: this.mapSeverity(feature.properties.severity),
                    event: feature.properties.event || 'Unknown Event',
                    start: new Date(feature.properties.effective || Date.now()),
                    end: new Date(feature.properties.expires || Date.now() + 3600000),
                    geometry: feature.geometry,
                    coordinates: coordinates,
                    instruction: feature.properties.instruction || '',
                    areaDesc: feature.properties.areaDesc || ''
                };
            });
            
            console.log(`Fetched ${this.alerts.length} alerts`);
            this.displayAlerts();
            this.addAlertMarkersToMap();
            return this.alerts;
        } catch (error) {
            console.error('Error fetching weather alerts:', error);
            this.alerts = [];
            this.displayAlerts();
            return [];
        }
    }
    
    // Map NWS severity to more user-friendly categories
    mapSeverity(severity) {
        const severityMap = {
            'Extreme': 'Extreme',
            'Severe': 'Severe',
            'Moderate': 'Moderate',
            'Minor': 'Minor',
            'Unknown': 'Unknown'
        };
        
        return severityMap[severity] || 'Unknown';
    }

    extractCoordinates(geometry) {
        if (!geometry) return null;
        
        // For point geometry
        if (geometry.type === 'Point') {
            return {
                lat: geometry.coordinates[1],
                lng: geometry.coordinates[0]
            };
        }
        
        // For polygon geometry, return center point
        if (geometry.type === 'Polygon' && geometry.coordinates && geometry.coordinates.length > 0) {
            const coords = geometry.coordinates[0];
            let lat = 0, lng = 0;
            
            coords.forEach(coord => {
                lat += coord[1];
                lng += coord[0];
            });
            
            return {
                lat: lat / coords.length,
                lng: lng / coords.length
            };
        }
        
        return null;
    }
    
    // Update the display alerts function to show more information
    displayAlerts() {
        const alertsPanel = document.getElementById('alerts-panel');
        if (!alertsPanel) return;
        
        // Clear existing alerts content (but keep the header if it exists)
        const header = alertsPanel.querySelector('.alerts-header');
        alertsPanel.innerHTML = '';
        if (header) {
            alertsPanel.appendChild(header);
        }
        
        if (this.alerts.length === 0) {
            const noAlerts = document.createElement('div');
            noAlerts.className = 'no-alerts';
            noAlerts.textContent = 'No active weather alerts';
            alertsPanel.appendChild(noAlerts);
            return;
        }
        
        // Sort alerts by severity
        const sortedAlerts = [...this.alerts].sort((a, b) => {
            const severityOrder = { 'Extreme': 0, 'Severe': 1, 'Moderate': 2, 'Minor': 3, 'Unknown': 4 };
            return (severityOrder[a.severity] || 4) - (severityOrder[b.severity] || 4);
        });
        
        // Create alert elements
        sortedAlerts.forEach(alert => {
            const alertElement = document.createElement('div');
            alertElement.className = `alert-item alert-${alert.severity.toLowerCase()}`;
            
            // Format the end time
            const endTime = alert.end.toLocaleString(undefined, {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
            
            alertElement.innerHTML = `
                <div class="alert-header">
                    <span class="alert-type">${alert.event}</span>
                    <span class="alert-severity">${alert.severity}</span>
                </div>
                <div class="alert-title">${alert.title}</div>
                <div class="alert-time">
                    <span>Until: ${endTime}</span>
                </div>
                <div class="alert-area">${alert.areaDesc || ''}</div>
                <button class="view-details-btn">View Details</button>
            `;
            
            // Add event listener to view details button
            const detailsBtn = alertElement.querySelector('.view-details-btn');
            detailsBtn.addEventListener('click', () => {
                this.showAlertDetails(alert);
            });
            
            alertsPanel.appendChild(alertElement);
        });
        
        // Add a refresh button
        const refreshBtn = document.createElement('button');
        refreshBtn.className = 'refresh-alerts-btn';
        refreshBtn.innerHTML = '<i class="fas fa-sync-alt"></i> Refresh Alerts';
        refreshBtn.addEventListener('click', () => {
            const state = window.radarController.getStateFromCoordinates(
                map.getCenter().lat, 
                map.getCenter().lng
            );
            this.fetchActiveAlerts(state);
        });
        
        alertsPanel.appendChild(refreshBtn);
    }
    
    addAlertMarkersToMap() {
        // Clear existing markers
        this.clearAlertMarkers();
        
        // Add new markers
        this.alerts.forEach(alert => {
            if (alert.coordinates && window.map) {
                const markerColor = this.getSeverityColor(alert.severity);
                
                const marker = L.circleMarker([alert.coordinates.lat, alert.coordinates.lng], {
                    radius: 10,
                    fillColor: markerColor,
                    color: '#000',
                    weight: 1,
                    opacity: 1,
                    fillOpacity: 0.8
                });
                
                marker.bindPopup(`
                    <div class="alert-popup">
                        <h3>${alert.event}</h3>
                        <p>${alert.title}</p>
                        <p>Severity: ${alert.severity}</p>
                        <p>Until: ${alert.end.toLocaleTimeString()}</p>
                    </div>
                `);
                
                marker.addTo(window.map);
                this.alertMarkers.push(marker);
            }
        });
    }
    
    clearAlertMarkers() {
        if (window.map) {
            this.alertMarkers.forEach(marker => {
                window.map.removeLayer(marker);
            });
        }
        this.alertMarkers = [];
    }
    
    getSeverityColor(severity) {
        switch (severity.toLowerCase()) {
            case 'extreme': return '#FF0000';  // Red
            case 'severe': return '#FF6600';   // Orange
            case 'moderate': return '#FFCC00'; // Yellow
            case 'minor': return '#00CC00';    // Green
            default: return '#CCCCCC';         // Gray
        }
    }
    
    showAlertDetails(alert) {
        // Create a modal to display alert details
        const modal = document.createElement('div');
        modal.className = 'alert-modal';
        
        modal.innerHTML = `
            <div class="alert-modal-content">
                <span class="close-modal">&times;</span>
                <h2>${alert.event}</h2>
                <div class="alert-meta">
                    <span class="alert-severity ${alert.severity.toLowerCase()}">${alert.severity}</span>
                    <span class="alert-time">Until: ${alert.end.toLocaleString()}</span>
                </div>
                <h3>${alert.title}</h3>
                <div class="alert-description">${alert.description}</div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Add event listener to close modal
        modal.querySelector('.close-modal').addEventListener('click', () => {
            document.body.removeChild(modal);
        });
        
        // Close modal when clicking outside content
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                document.body.removeChild(modal);
            }
        });
    }
}

module.exports = AlertsHandler;