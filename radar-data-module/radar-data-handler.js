/**
 * Radar Data Handler
 * Manages fetching and processing NEXRAD Level 3 radar data
 * from THREDDS Data Server
 */
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const xml2js = require('xml2js');

class RadarDataHandler {
    constructor(mapController, threddsConnector) {
        this.mapController = mapController;
        this.map = mapController.getMap();
        this.threddsConnector = threddsConnector;
        this.radarLayers = new Map();
        this.updateInterval = 2 * 60 * 1000; // 2 minutes in milliseconds
        this.updateTimer = null;
        this.activeStations = new Set();
        this.baseUrl = 'https://thredds.ucar.edu/thredds';
        this.nexradLevel3Url = `${this.baseUrl}/catalog/nexrad/level3`;
        this.nexradLevel2Url = `${this.baseUrl}/catalog/nexrad/level2`;
        this.dataDirectory = path.join(__dirname, 'data');
        
        // Create data directory if it doesn't exist
        if (!fs.existsSync(this.dataDirectory)) {
            fs.mkdirSync(this.dataDirectory, { recursive: true });
        }
    }

    /**
     * Initialize the radar data handler
     */
    initialize() {
        // Start the automatic update timer
        this.startAutoUpdate();
        console.log('Radar data handler initialized');
    }

    /**
     * Start automatic updates of radar data
     */
    startAutoUpdate() {
        // Clear any existing timer
        if (this.updateTimer) {
            clearInterval(this.updateTimer);
        }

        // Set up the timer to update every 2 minutes
        this.updateTimer = setInterval(() => {
            this.updateAllActiveRadars();
        }, this.updateInterval);

        console.log(`Automatic radar updates started (every ${this.updateInterval / 1000 / 60} minutes)`);
    }

    /**
     * Stop automatic updates
     */
    stopAutoUpdate() {
        if (this.updateTimer) {
            clearInterval(this.updateTimer);
            this.updateTimer = null;
            console.log('Automatic radar updates stopped');
        }
    }

    /**
     * Update all active radar stations
     */
    async updateAllActiveRadars() {
        console.log(`Updating ${this.activeStations.size} active radar stations...`);
        
        for (const stationId of this.activeStations) {
            await this.loadRadarData(stationId);
        }
    }

    /**
     * Load radar data for a specific station
     * @param {string} stationId - The radar station ID (e.g., KBMX)
     * @param {string} productCode - The radar product code (default: N0Q - Base Reflectivity)
     * @param {number} level - The radar data level (2 or 3, default: 3)
     */
    async loadRadarData(stationId, productCode = 'N0Q', level = 3) {
        if (!stationId) return;
        
        try {
            document.getElementById('loading-indicator').style.display = 'block';
            
            // Add to active stations
            this.activeStations.add(stationId);
            
            // Get the latest radar data from THREDDS
            const radarData = await this.fetchLatestRadarData(stationId, productCode, level);
            
            if (!radarData) {
                console.error(`No radar data found for station ${stationId}`);
                document.getElementById('loading-indicator').style.display = 'none';
                return;
            }
            
            // Download the data file
            await this.downloadRadarData(radarData);
            
            // Create a unique layer ID
            const layerId = `radar-${stationId}-${productCode}`;
            
            // Remove existing layer if it exists
            if (this.radarLayers.has(layerId)) {
                this.map.removeLayer(this.radarLayers.get(layerId));
            }
            
            // Add the WMS layer to the map
            const wmsLayer = this.threddsConnector.addWmsLayer(
                this.map,
                radarData.wmsUrl,
                radarData.layerName,
                {
                    opacity: 0.7,
                    styles: productCode === 'N0U' ? 'velocity' : 'default',
                    time: radarData.timestamp
                }
            );
            
            if (wmsLayer) {
                // Store the layer
                this.radarLayers.set(layerId, wmsLayer);
                console.log(`Added/updated radar layer: ${layerId}`);
                
                // Return the layer for further processing
                return wmsLayer;
            } else {
                console.error(`Failed to add radar layer: ${layerId}`);
                return null;
            }
        } catch (error) {
            console.error(`Error loading radar data for ${stationId}:`, error);
            return null;
        } finally {
            document.getElementById('loading-indicator').style.display = 'none';
        }
    }

    /**
     * Download radar data file
     * @param {Object} radarData - Radar data object
     */
    async downloadRadarData(radarData) {
        try {
            const stationDir = path.join(this.dataDirectory, radarData.stationId);
            
            // Create station directory if it doesn't exist
            if (!fs.existsSync(stationDir)) {
                fs.mkdirSync(stationDir, { recursive: true });
            }
            
            // Create file path
            const filePath = path.join(stationDir, radarData.datasetName);
            
            // Download the file
            const response = await axios({
                method: 'GET',
                url: `${this.baseUrl}/fileServer/${radarData.datasetPath}`,
                responseType: 'arraybuffer'
            });
            
            // Save the file
            fs.writeFileSync(filePath, response.data);
            console.log(`Downloaded radar data: ${filePath}`);
            
            return filePath;
        } catch (error) {
            console.error('Error downloading radar data:', error);
            return null;
        }
    }

    /**
     * Fetch the latest radar data for a station
     * @param {string} stationId - The radar station ID
     * @param {string} productCode - The radar product code
     * @param {number} level - The radar data level (2 or 3)
     * @returns {Promise<Object>} The radar data object
     */
    async fetchLatestRadarData(stationId, productCode, level = 3) {
        try {
            const baseUrl = level === 2 ? this.nexradLevel2Url : this.nexradLevel3Url;
            
            // For Level 3 data, we need to navigate the catalog structure
            // Level 3 data is organized by station/product
            const stationUrl = `${baseUrl}/${stationId}/catalog.xml`;
            console.log(`Fetching station catalog from: ${stationUrl}`);
            
            const stationResponse = await axios.get(stationUrl);
            const stationXml = await xml2js.parseStringPromise(stationResponse.data);
            
            // Find the product directory
            let productPath = null;
            const datasets = stationXml.catalog.dataset[0].dataset;
            
            for (const dataset of datasets) {
                const name = dataset.$.name;
                if (name && name.includes(productCode)) {
                    productPath = dataset.$.urlPath;
                    break;
                }
            }
            
            if (!productPath) {
                throw new Error(`Product ${productCode} not found for station ${stationId}`);
            }
            
            // Get the product catalog
            const productUrl = `${this.baseUrl}/catalog/${productPath}/catalog.xml`;
            const productResponse = await axios.get(productUrl);
            const productXml = await xml2js.parseStringPromise(productResponse.data);
            
            // Get all datasets
            const productDatasets = productXml.catalog.dataset[0].dataset
                .filter(d => d.$.name.endsWith('.nc'));
            
            if (productDatasets.length === 0) {
                throw new Error(`No datasets found for ${stationId}/${productCode}`);
            }
            
            // Sort by name (which contains the timestamp) to get the latest first
            productDatasets.sort((a, b) => {
                return b.$.name.localeCompare(a.$.name); // Descending order
            });
            
            // Limit to the requested count
            const limitedDatasets = productDatasets.slice(0, count);
            
            // Create frames for each dataset
            for (const dataset of limitedDatasets) {
                const datasetName = dataset.$.name;
                const datasetPath = dataset.$.urlPath;
                const timestamp = this.extractTimestampFromFilename(datasetName);
                const wmsUrl = `${this.baseUrl}/wms/${datasetPath}`;
                
                // Determine layer name based on product code
                let layerName = 'Reflectivity';
                if (productCode === 'N0U') {
                    layerName = 'RadialVelocity';
                }
                
                // Create WMS layer
                const wmsLayer = this.threddsConnector.createWmsLayer(
                    wmsUrl,
                    layerName,
                    {
                        opacity: 0.7,
                        styles: productCode === 'N0U' ? 'velocity' : 'default',
                        time: timestamp
                    }
                );
                
                if (wmsLayer) {
                    frames.push({
                        timestamp,
                        layer: wmsLayer,
                        datasetName,
                        datasetPath
                    });
                }
            }
            
            return frames;
        } catch (error) {
            console.error(`Error loading historical frames for ${stationId}/${productCode}:`, error);
            return [];
        }
    }

    /**
     * Extract timestamp from a filename
     * @param {string} filename - The filename containing a timestamp
     * @returns {string} ISO timestamp string
     */
    extractTimestampFromFilename(filename) {
        // Example filename: KBMX_SDUS54_N0RBMX_202304251456.nc
        // Extract the timestamp part (202304251456)
        const match = filename.match(/(\d{12})\.nc$/);
        if (match && match[1]) {
            const timestampStr = match[1];
            // Parse YYYYMMDDHHMI format
            const year = timestampStr.substring(0, 4);
            const month = timestampStr.substring(4, 6);
            const day = timestampStr.substring(6, 8);
            const hour = timestampStr.substring(8, 10);
            const minute = timestampStr.substring(10, 12);
            
            // Create ISO string
            return `${year}-${month}-${day}T${hour}:${minute}:00Z`;
        }
        
        // Return current time if parsing fails
        return new Date().toISOString();
    }

    /**
     * Remove a radar layer
     * @param {string} stationId - The radar station ID
     * @param {string} productCode - The radar product code
     */
    removeRadarLayer(stationId, productCode = 'N0Q') {
        const layerId = `radar-${stationId}-${productCode}`;
        
        if (this.radarLayers.has(layerId)) {
            this.map.removeLayer(this.radarLayers.get(layerId));
            this.radarLayers.delete(layerId);
            this.activeStations.delete(stationId);
            console.log(`Removed radar layer: ${layerId}`);
        }
    }

    /**
     * Remove all radar layers
     */
    removeAllRadarLayers() {
        for (const [layerId, layer] of this.radarLayers.entries()) {
            this.map.removeLayer(layer);
        }
        
        this.radarLayers.clear();
        this.activeStations.clear();
        console.log('All radar layers removed');
    }

    /**
     * Set opacity for all radar layers
     * @param {number} opacity - Opacity value (0-1)
     */
    setAllRadarLayersOpacity(opacity) {
        for (const layer of this.radarLayers.values()) {
            layer.setOpacity(opacity);
        }
        console.log(`Set opacity of all radar layers to ${opacity}`);
    }

    /**
     * Set opacity for a specific radar layer
     * @param {string} stationId - The radar station ID
     * @param {number} opacity - Opacity value (0-1)
     * @param {string} productCode - The radar product code
     */
    setRadarLayerOpacity(stationId, opacity, productCode = 'N0Q') {
        const layerId = `radar-${stationId}-${productCode}`;
        
        if (this.radarLayers.has(layerId)) {
            const layer = this.radarLayers.get(layerId);
            layer.setOpacity(opacity);
            console.log(`Set opacity of ${layerId} to ${opacity}`);
        }
    }

    /**
     * Get available products for a station
     * @param {string} stationId - The radar station ID
     * @returns {Promise<Array>} Array of available products
     */
    async getAvailableProducts(stationId) {
        try {
            const baseUrl = this.nexradLevel3Url;
            const stationUrl = `${baseUrl}/${stationId}/catalog.xml`;
            
            const stationResponse = await axios.get(stationUrl);
            const stationXml = await xml2js.parseStringPromise(stationResponse.data);
            
            const products = [];
            const datasets = stationXml.catalog.dataset[0].dataset;
            
            for (const dataset of datasets) {
                const name = dataset.$.name;
                // Extract product code from name (e.g., N0Q, N0U)
                const match = name.match(/N\d[A-Z]/);
                if (match) {
                    const productCode = match[0];
                    const productName = this.getProductName(productCode);
                    
                    products.push({
                        code: productCode,
                        name: productName,
                        path: dataset.$.urlPath
                    });
                }
            }
            
            return products;
        } catch (error) {
            console.error(`Error getting available products for ${stationId}:`, error);
            return [];
        }
    }

    /**
     * Get product name from product code
     * @param {string} productCode - The radar product code
     * @returns {string} The product name
     */
    getProductName(productCode) {
        const productNames = {
            'N0Q': 'Base Reflectivity (0.5°)',
            'N1Q': 'Base Reflectivity (1.5°)',
            'N2Q': 'Base Reflectivity (2.4°)',
            'N3Q': 'Base Reflectivity (3.4°)',
            'N0U': 'Base Velocity (0.5°)',
            'N1U': 'Base Velocity (1.5°)',
            'N2U': 'Base Velocity (2.4°)',
            'N3U': 'Base Velocity (3.4°)',
            'NCR': 'Composite Reflectivity',
            'NTP': 'Storm Total Precipitation',
            'N0C': 'Correlation Coefficient (0.5°)',
            'N0K': 'Specific Differential Phase (0.5°)',
            'N0X': 'Differential Reflectivity (0.5°)',
            'DVL': 'Digital Vertically Integrated Liquid',
            'EET': 'Enhanced Echo Tops',
            'DSA': 'Digital Storm Total Accumulation',
            'DTA': 'Digital Storm Total Accumulation',
            'DPR': 'Digital Precipitation Rate'
        };
        
        return productNames[productCode] || `Unknown Product (${productCode})`;
    }

    /**
     * Get metadata for a radar dataset
     * @param {string} stationId - The radar station ID
     * @param {string} productCode - The radar product code
     * @param {string} datasetName - The dataset name
     * @returns {Promise<Object>} The metadata object
     */
    async getDatasetMetadata(stationId, productCode, datasetName) {
        try {
            const baseUrl = this.nexradLevel3Url;
            const productUrl = `${baseUrl}/${stationId}/${productCode}/catalog.xml`;
            
            const productResponse = await axios.get(productUrl);
            const productXml = await xml2js.parseStringPromise(productResponse.data);
            
            const datasets = productXml.catalog.dataset[0].dataset;
            const dataset = datasets.find(d => d.$.name === datasetName);
            
            if (!dataset) {
                throw new Error(`Dataset ${datasetName} not found`);
            }
            
            // Get metadata URL
            const metadataUrl = `${this.baseUrl}/metadata/${dataset.$.urlPath}?metadata=thredds`;
            const metadataResponse = await axios.get(metadataUrl);
            
            return {
                stationId,
                productCode,
                datasetName,
                metadata: metadataResponse.data
            };
        } catch (error) {
            console.error(`Error getting dataset metadata:`, error);
            return null;
        }
    }
}

module.exports = RadarDataHandler;