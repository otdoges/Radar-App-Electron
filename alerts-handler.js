class AlertsHandler {
    constructor() {
        this.alerts = [];
        this.alertMarkers = [];
    }

    async fetchActiveAlerts(state = 'US') {
        try {
            const url = `https://api.weather.gov/alerts/active?area=${state}`;
            const response = await fetch(url);
            const data = await response.json();
            
            if (!data.features) {
                console.error('No alert features found in response');
                return [];
            }
            
            this.alerts = data.features.map(feature => {
                return {
                    id: feature.id,
                    title: feature.properties.headline || 'Weather Alert',
                    description: feature.properties.description || '',
                    severity: feature.properties.severity || 'Unknown',
                    event: feature.properties.event || 'Unknown Event',
                    start: new Date(feature.properties.effective || Date.now()),
                    end: new Date(feature.properties.expires || Date.now() + 3600000),
                    geometry: feature.geometry,
                    coordinates: this.extractCoordinates(feature.geometry)
                };
            });
            
            this.displayAlerts();
            return this.alerts;
        } catch (error) {
            console.error('Error fetching weather alerts:', error);
            return [];
        }
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
    
    displayAlerts() {
        const alertsPanel = document.getElementById('alerts-panel');
        if (!alertsPanel) return;
        
        // Clear existing alerts
        alertsPanel.innerHTML = '';
        
        if (this.alerts.length === 0) {
            alertsPanel.innerHTML = '<div class="no-alerts">No active weather alerts</div>';
            return;
        }
        
        // Sort alerts by severity
        const sortedAlerts = [...this.alerts].sort((a, b) => {
            const severityOrder = { Extreme: 0, Severe: 1, Moderate: 2, Minor: 3, Unknown: 4 };
            return (severityOrder[a.severity] || 4) - (severityOrder[b.severity] || 4);
        });
        
        // Create alert elements
        sortedAlerts.forEach(alert => {
            const alertElement = document.createElement('div');
            alertElement.className = `alert-item alert-${alert.severity.toLowerCase()}`;
            
            alertElement.innerHTML = `
                <div class="alert-header">
                    <span class="alert-type">${alert.event}</span>
                    <span class="alert-severity">${alert.severity}</span>
                </div>
                <div class="alert-title">${alert.title}</div>
                <div class="alert-time">
                    Until: ${alert.end.toLocaleTimeString()}
                </div>
                <button class="alert-details-btn" data-alert-id="${alert.id}">Details</button>
            `;
            
            alertsPanel.appendChild(alertElement);
            
            // Add event listener for details button
            alertElement.querySelector('.alert-details-btn').addEventListener('click', () => {
                this.showAlertDetails(alert);
            });
        });
        
        // Add markers to the map if coordinates are available
        this.addAlertMarkersToMap();
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