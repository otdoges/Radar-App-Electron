class RadarProcessor {
    constructor() {
        // Create an offscreen canvas for processing radar data
        this.canvas = document.createElement('canvas');
        this.canvas.width = 1000;
        this.canvas.height = 1000;
        this.ctx = this.canvas.getContext('2d');
        this.nexradData = null;
        this.temperatureData = null;
    }

    // Process NEXRAD data without relying on the external module
    async processNexradData(stationId, productType = 'N0Q', tilt = 1) {
        try {
            // Show loading indicator
            document.getElementById('loading-indicator').style.display = 'block';
            
            // Instead of using the failing module, we'll use direct API calls
            const url = `https://api.weather.gov/radar/stations/${stationId}/observations/latest`;
            console.log(`Fetching radar data from: ${url}`);
            
            const response = await fetch(url, {
                headers: {
                    'Accept': 'application/json',
                    'User-Agent': 'RadarApp/1.0'
                }
            });
            
            if (!response.ok) {
                throw new Error(`Failed to fetch radar data: ${response.status} ${response.statusText}`);
            }
            
            const data = await response.json();
            
            // Get the URL for the requested product
            let imageUrl = null;
            if (data && data.features && data.features.length > 0) {
                const feature = data.features[0];
                if (feature.properties && feature.properties.image) {
                    // Try to find the requested product
                    if (productType === 'N0Q' && feature.properties.image) {
                        imageUrl = feature.properties.image;
                    } else if (productType === 'N0U' && feature.properties.velocity) {
                        imageUrl = feature.properties.velocity;
                    } else {
                        // Default to reflectivity if requested product not found
                        imageUrl = feature.properties.image;
                    }
                }
            }
            
            if (!imageUrl) {
                // If we couldn't get the image URL from the API, use a fallback approach
                imageUrl = `https://radar.weather.gov/ridge/RadarImg/N0R/${stationId}_N0R_0.gif`;
            }
            
            // Store the data for later use
            this.nexradData = {
                stationId,
                productType,
                tilt,
                timestamp: new Date(),
                imageUrl
            };
            
            return imageUrl;
        } catch (error) {
            console.error('Error processing NEXRAD data:', error);
            // Fallback to static image if API fails
            const fallbackUrl = `https://radar.weather.gov/ridge/RadarImg/N0R/${stationId}_N0R_0.gif`;
            console.log(`Using fallback URL: ${fallbackUrl}`);
            return fallbackUrl;
        } finally {
            // Hide loading indicator
            document.getElementById('loading-indicator').style.display = 'none';
        }
    }

    // Other methods remain the same
    drawCrosshair(x, y) {
        // Return placeholder measurements for now
        return {
            reflectivity: null,
            velocity: null,
            temperature: null
        };
    }

    async loadTemperatureData(stationId) {
        // Placeholder for temperature data loading
        console.log(`Loading temperature data for station ${stationId}`);
        return true;
    }

    clearTemperatureData() {
        this.temperatureData = null;
    }

    getReflectivityColor(value) {
        // Define color scale for reflectivity values
        if (value < 5) return { r: 0, g: 0, b: 0, a: 0 };
        if (value < 10) return { r: 4, g: 233, b: 231, a: 255 };
        if (value < 15) return { r: 1, g: 159, b: 244, a: 255 };
        if (value < 20) return { r: 3, g: 0, b: 244, a: 255 };
        if (value < 25) return { r: 2, g: 253, b: 2, a: 255 };
        if (value < 30) return { r: 1, g: 197, b: 1, a: 255 };
        if (value < 35) return { r: 0, g: 142, b: 0, a: 255 };
        if (value < 40) return { r: 253, g: 248, b: 2, a: 255 };
        if (value < 45) return { r: 229, g: 188, b: 0, a: 255 };
        if (value < 50) return { r: 253, g: 149, b: 0, a: 255 };
        if (value < 55) return { r: 253, g: 0, b: 0, a: 255 };
        if (value < 60) return { r: 212, g: 0, b: 0, a: 255 };
        if (value < 65) return { r: 188, g: 0, b: 0, a: 255 };
        if (value < 70) return { r: 248, g: 0, b: 253, a: 255 };
        if (value < 75) return { r: 152, g: 84, b: 198, a: 255 };
        return { r: 253, g: 253, b: 253, a: 255 };
    }
}

module.exports = RadarProcessor;