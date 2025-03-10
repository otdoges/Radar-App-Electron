/**
 * Radar Data Handler
 * Manages fetching and processing NEXRAD Level 3 radar data
 * from THREDDS Data Server
 */
class RadarDataHandler {
    constructor(mapController, threddsConnector) {
        this.map = mapController.getMap();
        this.threddsConnector = threddsConnector;
        this.radarLayers = new Map();
        this.updateInterval = 2 * 60 * 1000; // 2 minutes in milliseconds
        this.updateTimer = null;
        this.activeStations = new Set();
        this.baseUrl = 'https://thredds.ucar.edu/thredds';
        this.nexradLevel3Url = `${this.baseUrl}/catalog/nexrad/level3`;
    }

    /**
     * Initialize the radar data handler
     */
    initialize() {
        // Start the automatic update timer
        this.startAutoUpdate();
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
     */
    async loadRadarData(stationId, productCode = 'N0Q') {
        if (!stationId) return;
        
        try {
            document.getElementById('loading-indicator').style.display = 'block';
            
            // Add to active stations
            this.activeStations.add(stationId);
            
            // Get the latest radar data from THREDDS
            const radarData = await this.fetchLatestRadarData(stationId, productCode);
            
            if (!radarData) {
                console.error(`No radar data found for station ${stationId}`);
                document.getElementById('loading-indicator').style.display = 'none';
                return;
            }
            
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
            } else {
                console.error(`Failed to add radar layer: ${layerId}`);
            }
        } catch (error) {
            console.error(`Error loading radar data for ${stationId}:`, error);
        } finally {
            document.getElementById('loading-indicator').style.display = 'none';
        }
    }

    /**
     * Fetch the latest radar data for a station
     * @param {string} stationId - The radar station ID
     * @param {string} productCode - The radar product code
     * @returns {Promise<Object>} The radar data object
     */
    async fetchLatestRadarData(stationId, productCode) {
        try {
            // For Level 3 data, we need to navigate the catalog structure
            // Level 3 data is organized by station/product
            const stationUrl = `${this.nexradLevel3Url}/${stationId}/catalog.xml`;
            console.log(`Fetching station catalog from: ${stationUrl}`);
            
            const stationResponse = await fetch(stationUrl);
            if (!stationResponse.ok) {
                throw new Error(`Failed to fetch station catalog: ${stationResponse.status}`);
            }
            
            const stationText = await stationResponse.text();
            const stationXml = new DOMParser().parseFromString(stationText, "text/xml");
            
            // Find the product directory
            let productPath = null;
            const datasets = stationXml.getElementsByTagName('dataset');
            for (const dataset of datasets) {
                const name = dataset.getAttribute('name');
                if (name && name.includes(productCode)) {
                    productPath = dataset.getAttribute('urlPath');
                    break;
                }
            }
            
            if (!productPath) {
                throw new Error(`Product ${productCode} not found for station ${stationId}`);
            }
            
            // Get the product catalog
            const productUrl = `${this.baseUrl}/catalog/${productPath}/catalog.xml`;
            console.log(`Fetching product catalog from: ${productUrl}`);
            
            const productResponse = await fetch(productUrl);
            if (!productResponse.ok) {
                throw new Error(`Failed to fetch product catalog: ${productResponse.status}`);
            }
            
            const productText = await productResponse.text();
            const productXml = new DOMParser().parseFromString(productText, "text/xml");
            
            // Find the latest dataset
            const productDatasets = Array.from(productXml.getElementsByTagName('dataset'))
                .filter(d => d.getAttribute('name').endsWith('.nc'));
            
            if (productDatasets.length === 0) {
                throw new Error(`No datasets found for ${stationId}/${productCode}`);
            }
            
            // Sort by name (which contains the timestamp) to get the latest
            productDatasets.sort((a, b) => {
                const nameA = a.getAttribute('name');
                const nameB = b.getAttribute('name');
                return nameB.localeCompare(nameA); // Descending order
            });
            
            const latestDataset = productDatasets[0];
            const datasetName = latestDataset.getAttribute('name');
            const datasetPath = latestDataset.getAttribute('urlPath');
            
            // Extract timestamp from filename
            const timestamp = this.extractTimestampFromFilename(datasetName);
            
            // Create WMS URL
            const wmsUrl = `${this.baseUrl}/wms/${datasetPath}`;
            
            // Determine layer name based on product code
            let layerName = 'Reflectivity';
            if (productCode === 'N0U') {
                layerName = 'RadialVelocity';
            }
            
            return {
                stationId,
                productCode,
                datasetName,
                wmsUrl,
                layerName,
                timestamp
            };
        } catch (error) {
            console.error(`Error fetching radar data for ${stationId}/${productCode}:`, error);
            return null;
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
     * Set opacity for a radar layer
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
}

module.exports = RadarDataHandler;