class RadarProcessor {
    constructor() {
        this.nexradData = null;
        this.velocityData = null;
        this.temperatureData = null;
        this.canvas = document.createElement('canvas');
        this.ctx = this.canvas.getContext('2d');
        this.canvas.width = 1000;
        this.canvas.height = 1000;
        
        // Define color maps to avoid multiple if statements
        this.reflectivityColorMap = [
            { threshold: 5, color: { r: 0, g: 0, b: 0, a: 0 } },
            { threshold: 10, color: { r: 4, g: 233, b: 231, a: 255 } },
            { threshold: 15, color: { r: 1, g: 159, b: 244, a: 255 } },
            { threshold: 20, color: { r: 3, g: 0, b: 244, a: 255 } },
            { threshold: 25, color: { r: 2, g: 253, b: 2, a: 255 } },
            { threshold: 30, color: { r: 1, g: 197, b: 1, a: 255 } },
            { threshold: 35, color: { r: 0, g: 142, b: 0, a: 255 } },
            { threshold: 40, color: { r: 253, g: 248, b: 2, a: 255 } },
            { threshold: 45, color: { r: 229, g: 188, b: 0, a: 255 } },
            { threshold: 50, color: { r: 253, g: 149, b: 0, a: 255 } },
            { threshold: 55, color: { r: 253, g: 0, b: 0, a: 255 } },
            { threshold: 60, color: { r: 212, g: 0, b: 0, a: 255 } },
            { threshold: 65, color: { r: 188, g: 0, b: 0, a: 255 } },
            { threshold: Infinity, color: { r: 248, g: 0, b: 253, a: 255 } }
        ];
        
        this.temperatureColorMap = [
            { threshold: -20, color: { r: 145, g: 0, b: 255, a: 200 } },
            { threshold: -10, color: { r: 0, g: 0, b: 255, a: 200 } },
            { threshold: 0, color: { r: 0, g: 128, b: 255, a: 200 } },
            { threshold: 10, color: { r: 0, g: 255, b: 255, a: 200 } },
            { threshold: 20, color: { r: 0, g: 255, b: 0, a: 200 } },
            { threshold: 30, color: { r: 255, g: 255, b: 0, a: 200 } },
            { threshold: 40, color: { r: 255, g: 128, b: 0, a: 200 } },
            { threshold: Infinity, color: { r: 255, g: 0, b: 0, a: 200 } }
        ];
    }

    async processNexradData(stationId, productType = 'N0Q', tilt = 1) {
        // Update URL to use NEXRAD Level 3 data format
        const url = `https://tgftp.nws.noaa.gov/SL.us008001/DF.of/DC.radar/DS.${productType}/SI.${stationId}/sn.last`;
        try {
            // Show loading indicator
            document.getElementById('loading-indicator').style.display = 'block';
            
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`Failed to fetch radar data: ${response.status} ${response.statusText}`);
            }
            
            const arrayBuffer = await response.arrayBuffer();
            
            // Process the radar data based on product type
            let imageUrl;
            if (productType.startsWith('N0Q') || productType === 'N0R') {
                imageUrl = this.processReflectivityData(arrayBuffer, tilt);
            } else if (productType.startsWith('N0U') || productType === 'N0V') {
                imageUrl = this.processVelocityData(arrayBuffer, tilt);
            } else {
                imageUrl = this.processGenericData(arrayBuffer, productType, tilt);
            }
            
            // Store the data for later use with center coordinates for measurements
            const center = { x: this.canvas.width / 2, y: this.canvas.height / 2 };
            const maxRadius = Math.min(this.canvas.width, this.canvas.height) / 2 - 10;
            
            this.nexradData = {
                stationId,
                productType,
                tilt,
                timestamp: new Date(),
                center,
                maxRadius
            };
            
            return imageUrl;
        } catch (error) {
            console.error('Error processing NEXRAD data:', error);
            return null;
        } finally {
            // Hide loading indicator
            document.getElementById('loading-indicator').style.display = 'none';
        }
    }

    processReflectivityData(arrayBuffer, tilt) {
        // Clear the canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        try {
            // Parse NEXRAD Level 3 data format
            const center = { x: this.canvas.width / 2, y: this.canvas.height / 2 };
            const maxRadius = Math.min(this.canvas.width, this.canvas.height) / 2 - 10;
            
            // Draw radar rings for reference
            this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
            this.ctx.lineWidth = 1;
            
            for (let i = 1; i <= 5; i++) {
                const radius = (maxRadius / 5) * i;
                this.ctx.beginPath();
                this.ctx.arc(center.x, center.y, radius, 0, Math.PI * 2);
                this.ctx.stroke();
            }
            
            // Generate simulated radar data based on the actual binary data
            const numBins = 360;
            const numGates = 230;
            
            for (let azimuth = 0; azimuth < numBins; azimuth++) {
                const angle = (azimuth / numBins) * Math.PI * 2;
                
                for (let gate = 0; gate < numGates; gate++) {
                    // Use some bytes from the actual data to generate values
                    const byteOffset = (azimuth * numGates + gate) % (arrayBuffer.byteLength - 4);
                    let value = 0;
                    
                    if (byteOffset < arrayBuffer.byteLength - 4) {
                        value = new DataView(arrayBuffer).getUint8(byteOffset) % 75; // Get a value between 0-75 dBZ
                    }
                    
                    if (value > 0) {
                        const distance = (gate / numGates) * maxRadius;
                        const x = center.x + Math.cos(angle) * distance;
                        const y = center.y + Math.sin(angle) * distance;
                        
                        // Get color based on reflectivity value
                        const color = this.getReflectivityColor(value);
                        
                        // Draw the radar bin
                        this.ctx.fillStyle = `rgba(${color.r}, ${color.g}, ${color.b}, ${color.a / 255})`;
                        this.ctx.fillRect(x, y, 2, 2);
                    }
                }
            }
            
            // Convert canvas to data URL
            return this.canvas.toDataURL('image/png');
        } catch (error) {
            console.error('Error processing reflectivity data:', error);
            return null;
        }
    }

    processVelocityData(arrayBuffer, tilt) {
        // Clear the canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Parse the NEXRAD Level 2 data for velocity
        try {
            // This is a simplified version - in a real app, you'd use a proper NEXRAD parser
            
            // For now, we'll create a simple visualization
            const center = { x: this.canvas.width / 2, y: this.canvas.height / 2 };
            const maxRadius = Math.min(this.canvas.width, this.canvas.height) / 2 - 10;
            
            // Draw radar rings
            this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
            this.ctx.lineWidth = 1;
            
            for (let i = 1; i <= 5; i++) {
                const radius = (maxRadius / 5) * i;
                this.ctx.beginPath();
                this.ctx.arc(center.x, center.y, radius, 0, Math.PI * 2);
                this.ctx.stroke();
            }
            
            // Draw velocity data
            // This is just a placeholder - real implementation would parse the binary data
            const velocityColors = [
                'rgba(122, 114, 238, 0.7)',  // -30 m/s
                'rgba(30, 41, 183, 0.7)',    // -20 m/s
                'rgba(0, 0, 255, 0.7)',      // -10 m/s
                'rgba(255, 255, 255, 0.7)',  // 0 m/s
                'rgba(255, 0, 0, 0.7)',      // 10 m/s
                'rgba(183, 41, 30, 0.7)',    // 20 m/s
                'rgba(238, 114, 122, 0.7)'   // 30 m/s
            ];
            
            // Generate some sample data for visualization
            for (let angle = 0; angle < 360; angle += 1) {
                const angleRad = (angle * Math.PI) / 180;
                
                // Generate random velocity values
                for (let r = 0; r < maxRadius; r += 5) {
                    const randomValue = Math.random();
                    if (randomValue > 0.95) {
                        // Velocity tends to be more organized than reflectivity
                        // Left side of storm moving toward radar (negative/blue)
                        // Right side moving away (positive/red)
                        let colorIndex;
                        if (angle > 90 && angle < 270) {
                            colorIndex = Math.floor(Math.random() * 3); // Negative velocity
                        } else {
                            colorIndex = 4 + Math.floor(Math.random() * 3); // Positive velocity
                        }
                        
                        const x = center.x + r * Math.cos(angleRad);
                        const y = center.y + r * Math.sin(angleRad);
                        
                        this.ctx.fillStyle = velocityColors[colorIndex];
                        this.ctx.fillRect(x, y, 5, 5);
                    }
                }
            }
            
            // Store the data for measurements
            this.velocityData = {
                type: 'velocity',
                center,
                maxRadius,
                data: [] // In a real app, this would contain the actual data
            };
            
            // Return the data URL of the canvas
            return this.canvas.toDataURL();
        } catch (error) {
            console.error('Error parsing velocity data:', error);
            return null;
        }
    }
    
    processGenericData(arrayBuffer, productType, tilt) {
        // Process other product types
        // This is a placeholder for other product types
        return this.processReflectivityData(arrayBuffer, tilt);
    }
    
    getElevation(x, y) {
        // Implementation for getting elevation data
        // This would typically use DEM (Digital Elevation Model) data
        return 0; // Placeholder
    }

    async loadTemperatureData(stationId) {
        try {
            // In a real application, you would fetch temperature data from a weather API
            // For this example, we'll generate synthetic temperature data
            const width = 1000;
            const height = 1000;
            
            // Create a temperature grid
            const tempGrid = [];
            for (let y = 0; y < height; y++) {
                const row = [];
                for (let x = 0; x < width; x++) {
                    // Calculate distance from center
                    const dx = x - width/2;
                    const dy = y - height/2;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    const maxRadius = Math.min(width, height) / 2;
                    
                    // Temperature decreases with distance from center (simulating higher elevation)
                    // Base temperature around 20°C at center, decreasing to -10°C at edges
                    const temp = 20 - (distance / maxRadius) * 30;
                    row.push(temp);
                }
                tempGrid.push(row);
            }
            
            this.temperatureData = {
                grid: tempGrid,
                width,
                height
            };
            
            // Generate a visualization of the temperature data
            const imageData = this.ctx.createImageData(width, height);
            const data = imageData.data;
            
            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    const temp = tempGrid[y][x];
                    const color = this.getTemperatureColor(temp);
                    
                    const index = (y * width + x) * 4;
                    data[index] = color.r;
                    data[index + 1] = color.g;
                    data[index + 2] = color.b;
                    data[index + 3] = color.a;
                }
            }
            
            this.ctx.putImageData(imageData, 0, 0);
            return true;
        } catch (error) {
            console.error('Error loading temperature data:', error);
            return false;
        }
    }
    
    clearTemperatureData() {
        this.temperatureData = null;
        return true;
    }
    
    getReflectivityColor(value) {
        // Use binary search for better performance with large color maps
        return this.getColorFromMap(this.reflectivityColorMap, value);
    }
    
    getTemperatureColor(temperature) {
        return this.getColorFromMap(this.temperatureColorMap, temperature);
    }
    
    getColorFromMap(colorMap, value) {
        // Binary search implementation for color lookup
        let low = 0;
        let high = colorMap.length - 1;
        
        while (low <= high) {
            const mid = Math.floor((low + high) / 2);
            if (value < colorMap[mid].threshold) {
                high = mid - 1;
            } else {
                low = mid + 1;
            }
        }
        
        // Return the color at the found index, or the first color if value is too low
        return colorMap[Math.max(0, high)].color;
    }
    
    getVelocityColor(value) {
        // Velocity color scale (m/s)
        const maxVelocity = 50;
        if (value === null) return { r: 0, g: 0, b: 0, a: 0 };
        
        const normalizedValue = (value + maxVelocity) / (maxVelocity * 2);
        
        // Simplified logic with ternary operator
        return value < 0 
            ? { r: 0, g: 0, b: Math.floor(255 * Math.abs(normalizedValue)), a: 255 }
            : { r: Math.floor(255 * normalizedValue), g: 0, b: 0, a: 255 };
    }
    
    getMeasurements(x, y) {
        if (!this.nexradData || !this.nexradData.center) {
            return { reflectivity: null, velocity: null };
        }
        
        // Calculate distance and angle from center
        const dx = x - this.nexradData.center.x;
        const dy = y - this.nexradData.center.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const angle = Math.atan2(dy, dx);
        
        // Convert to polar coordinates relative to radar
        const distanceKm = (distance / this.nexradData.maxRadius) * 250; // Assuming 250km max range
        
        // In a real implementation, you would look up the actual data values
        // This is a placeholder that returns random values for demonstration
        const reflectivity = distance < this.nexradData.maxRadius ? Math.random() * 70 : null;
        const velocity = distance < this.nexradData.maxRadius ? (Math.random() * 100) - 50 : null;
        
        return {
            reflectivity,
            velocity,
            distanceKm,
            angle
        };
    }
    
    getTemperature(x, y) {
        if (!this.temperatureData) return null;
        
        // Convert canvas coordinates to temperature grid coordinates
        const gridX = Math.floor(x);
        const gridY = Math.floor(y);
        
        // Check if coordinates are within bounds
        if (gridX >= 0 && gridX < this.canvas.width && 
            gridY >= 0 && gridY < this.canvas.height) {
            return this.temperatureData.grid[gridY][gridX];
        }
        
        return null;
    }
    
    drawCrosshair(x, y) {
        const measurements = this.getMeasurements(x, y);
        return {
            velocity: measurements.velocity ? {
                ms: measurements.velocity,
                mph: measurements.velocity * 2.237 // Convert m/s to mph
            } : null,
            reflectivity: measurements.reflectivity,
            temperature: this.getTemperature(x, y)
        };
    }
}

module.exports = RadarProcessor;