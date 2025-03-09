/**
 * THREDDS Data Server Connector
 * Provides access to UCAR's THREDDS meteorological datasets
 */
class ThreddsConnector {
    constructor() {
        this.baseUrl = 'https://thredds.ucar.edu/thredds';
        this.wmsUrl = `${this.baseUrl}/wms`;
        this.ncssUrl = `${this.baseUrl}/ncss`;
        this.catalogUrl = `${this.baseUrl}/catalog`;
        this.datasetCache = new Map();
        
        // Add specific URL for forecast models
        this.forecastModelsUrl = `${this.catalogUrl}/idd/forecastModels.html`;
        this.forecastModelsCatalog = `${this.catalogUrl}/idd/forecastModels.xml`;
    }

    /**
     * Get available NEXRAD Level II radar archives
     * @returns {Promise<Array>} List of available radar archives
     */
    async getNexradArchives(stationId, date) {
        try {
            // Format date as YYYY/MM/DD
            const formattedDate = date ? this.formatDate(date) : this.formatDate(new Date());
            
            // NEXRAD Level II data is organized by year/month/day/station
            const url = `${this.catalogUrl}/nexrad/level2/${formattedDate}/${stationId}/catalog.xml`;
            console.log(`Fetching NEXRAD archives from: ${url}`);
            
            const response = await fetch(url);
            const text = await response.text();
            
            // Parse XML response to extract dataset information
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(text, "text/xml");
            
            // Extract dataset elements
            const datasets = Array.from(xmlDoc.getElementsByTagName('dataset'))
                .filter(dataset => dataset.getAttribute('name').endsWith('.ar2v'))
                .map(dataset => {
                    const name = dataset.getAttribute('name');
                    const urlPath = dataset.getAttribute('urlPath');
                    return {
                        name,
                        urlPath,
                        timestamp: this.extractTimestampFromFilename(name),
                        accessUrl: `${this.baseUrl}/dodsC/${urlPath}`
                    };
                });
            
            return datasets;
        } catch (error) {
            console.error('Error fetching NEXRAD archives:', error);
            return [];
        }
    }

    /**
     * Get model forecast data from NCEP models
     * @param {string} model - Model name (e.g., 'GFS', 'NAM', 'HRRR')
     * @returns {Promise<Object>} Model metadata and access URLs
     */
    async getModelData(model = 'GFS') {
        try {
            const modelMap = {
                'GFS': 'gfs',
                'NAM': 'nam',
                'HRRR': 'hrrr',
                'RAP': 'rap'
            };
            
            const modelId = modelMap[model] || 'gfs';
            const url = `${this.catalogUrl}/grib/NCEP/${modelId}/catalog.xml`;
            
            const response = await fetch(url);
            const text = await response.text();
            
            // Parse XML response
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(text, "text/xml");
            
            // Get the latest dataset
            const datasets = Array.from(xmlDoc.getElementsByTagName('dataset'))
                .filter(dataset => dataset.hasAttribute('name') && dataset.getAttribute('name').includes('_'))
                .map(dataset => {
                    const name = dataset.getAttribute('name');
                    const urlPath = dataset.getAttribute('urlPath');
                    return {
                        name,
                        urlPath,
                        wmsUrl: `${this.wmsUrl}/${urlPath}`,
                        ncssUrl: `${this.ncssUrl}/${urlPath}`
                    };
                });
            
            // Sort by name to get the latest
            datasets.sort((a, b) => b.name.localeCompare(a.name));
            
            return datasets.length > 0 ? datasets[0] : null;
        } catch (error) {
            console.error(`Error fetching ${model} model data:`, error);
            return null;
        }
    }

    /**
     * Get GOES satellite imagery
     * @param {string} satellite - Satellite name (e.g., 'GOES16', 'GOES17')
     * @param {string} product - Product type (e.g., 'ABI', 'GLM')
     * @returns {Promise<Object>} Satellite data access information
     */
    async getSatelliteImagery(satellite = 'GOES16', product = 'ABI') {
        try {
            const satMap = {
                'GOES16': 'goes16',
                'GOES17': 'goes17',
                'GOES18': 'goes18'
            };
            
            const satId = satMap[satellite] || 'goes16';
            const url = `${this.catalogUrl}/satellite/${satId}/${product.toLowerCase()}/catalog.xml`;
            
            const response = await fetch(url);
            const text = await response.text();
            
            // Parse XML response
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(text, "text/xml");
            
            // Get available datasets
            const datasets = Array.from(xmlDoc.getElementsByTagName('dataset'))
                .filter(dataset => dataset.hasAttribute('name'))
                .map(dataset => {
                    const name = dataset.getAttribute('name');
                    const urlPath = dataset.getAttribute('urlPath');
                    return {
                        name,
                        urlPath,
                        wmsUrl: urlPath ? `${this.wmsUrl}/${urlPath}` : null
                    };
                })
                .filter(dataset => dataset.wmsUrl);
            
            return datasets;
        } catch (error) {
            console.error(`Error fetching ${satellite} ${product} data:`, error);
            return [];
        }
    }

    /**
     * Add a WMS layer to the map
     * @param {Object} map - Leaflet map instance
     * @param {string} wmsUrl - WMS service URL
     * @param {string} layer - Layer name
     * @param {Object} options - WMS layer options
     */
    addWmsLayer(map, wmsUrl, layer, options = {}) {
        const defaultOptions = {
            format: 'image/png',
            transparent: true,
            opacity: 0.7,
            attribution: 'UCAR THREDDS Data Server'
        };
        
        const wmsOptions = { ...defaultOptions, ...options, layers: layer };
        const wmsLayer = L.tileLayer.wms(wmsUrl, wmsOptions);
        
        wmsLayer.addTo(map);
        return wmsLayer;
    }

    /**
     * Format date as YYYY/MM/DD for THREDDS URL paths
     * @param {Date} date - Date object
     * @returns {string} Formatted date string
     */
    formatDate(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}/${month}/${day}`;
    }

    /**
     * Extract timestamp from NEXRAD filename
     * @param {string} filename - NEXRAD filename
     * @returns {Date} Timestamp
     */
    extractTimestampFromFilename(filename) {
        // Example filename: KICT20230615_235055_V06.ar2v
        const match = filename.match(/(\w{4})(\d{8})_(\d{6})_/);
        if (!match) return null;
        
        const [, station, dateStr, timeStr] = match;
        const year = dateStr.substring(0, 4);
        const month = dateStr.substring(4, 6);
        const day = dateStr.substring(6, 8);
        const hour = timeStr.substring(0, 2);
        const minute = timeStr.substring(2, 4);
        const second = timeStr.substring(4, 6);
        
        return new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}Z`);
    }

    /**
     * Get available forecast models from the IDD catalog
     * @returns {Promise<Array>} List of available forecast model categories
     */
    async getForecastModelCategories() {
        try {
            if (this.datasetCache.has('forecastModelCategories')) {
                return this.datasetCache.get('forecastModelCategories');
            }
            
            const url = this.forecastModelsCatalog;
            console.log(`Fetching forecast model categories from: ${url}`);
            
            const response = await fetch(url);
            const text = await response.text();
            
            // Parse XML response
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(text, "text/xml");
            
            // Extract catalog references (model categories)
            const catalogRefs = Array.from(xmlDoc.getElementsByTagName('catalogRef'))
                .map(ref => {
                    const name = ref.getAttribute('xlink:title') || ref.getAttribute('title');
                    const href = ref.getAttribute('xlink:href') || ref.getAttribute('href');
                    return {
                        name,
                        href,
                        url: `${this.catalogUrl}/idd/${href}`
                    };
                });
            
            this.datasetCache.set('forecastModelCategories', catalogRefs);
            return catalogRefs;
        } catch (error) {
            console.error('Error fetching forecast model categories:', error);
            return [];
        }
    }

    /**
     * Get available models within a specific category
     * @param {string} categoryHref - Category href from getForecastModelCategories
     * @returns {Promise<Array>} List of available models in the category
     */
    async getModelsInCategory(categoryHref) {
        try {
            const cacheKey = `models_${categoryHref}`;
            if (this.datasetCache.has(cacheKey)) {
                return this.datasetCache.get(cacheKey);
            }
            
            const url = `${this.catalogUrl}/idd/${categoryHref}`;
            console.log(`Fetching models from category: ${url}`);
            
            const response = await fetch(url);
            const text = await response.text();
            
            // Parse XML response
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(text, "text/xml");
            
            // Extract datasets and catalog references
            const datasets = [
                ...Array.from(xmlDoc.getElementsByTagName('dataset'))
                    .filter(dataset => dataset.hasAttribute('urlPath'))
                    .map(dataset => {
                        const name = dataset.getAttribute('name');
                        const urlPath = dataset.getAttribute('urlPath');
                        return {
                            name,
                            type: 'dataset',
                            urlPath,
                            wmsUrl: `${this.wmsUrl}/${urlPath}`,
                            ncssUrl: `${this.ncssUrl}/${urlPath}`
                        };
                    }),
                ...Array.from(xmlDoc.getElementsByTagName('catalogRef'))
                    .map(ref => {
                        const name = ref.getAttribute('xlink:title') || ref.getAttribute('title');
                        const href = ref.getAttribute('xlink:href') || ref.getAttribute('href');
                        return {
                            name,
                            type: 'catalog',
                            href,
                            url: `${this.catalogUrl}/idd/${categoryHref.split('/')[0]}/${href}`
                        };
                    })
            ];
            
            this.datasetCache.set(cacheKey, datasets);
            return datasets;
        } catch (error) {
            console.error(`Error fetching models in category ${categoryHref}:`, error);
            return [];
        }
    }

    /**
     * Get available layers for a specific model dataset
     * @param {string} wmsUrl - WMS URL for the dataset
     * @returns {Promise<Array>} List of available layers
     */
    async getModelLayers(wmsUrl) {
        try {
            const cacheKey = `layers_${wmsUrl}`;
            if (this.datasetCache.has(cacheKey)) {
                return this.datasetCache.get(cacheKey);
            }
            
            // Append GetCapabilities request to the WMS URL
            const capabilitiesUrl = `${wmsUrl}?service=WMS&version=1.3.0&request=GetCapabilities`;
            console.log(`Fetching model layers from: ${capabilitiesUrl}`);
            
            const response = await fetch(capabilitiesUrl);
            const text = await response.text();
            
            // Parse XML response
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(text, "text/xml");
            
            // Extract layers
            const layers = Array.from(xmlDoc.getElementsByTagName('Layer'))
                .filter(layer => layer.getElementsByTagName('Name').length > 0)
                .map(layer => {
                    const name = layer.getElementsByTagName('Name')[0].textContent;
                    const title = layer.getElementsByTagName('Title')[0]?.textContent || name;
                    
                    // Extract style information if available
                    const styles = Array.from(layer.getElementsByTagName('Style'))
                        .map(style => {
                            const styleName = style.getElementsByTagName('Name')[0]?.textContent || 'default';
                            const styleTitle = style.getElementsByTagName('Title')[0]?.textContent || styleName;
                            return { name: styleName, title: styleTitle };
                        });
                    
                    // Extract dimension information (like time)
                    const dimensions = Array.from(layer.getElementsByTagName('Dimension'))
                        .map(dim => {
                            const name = dim.getAttribute('name');
                            const units = dim.getAttribute('units');
                            const values = dim.textContent.trim().split(',');
                            return { name, units, values };
                        });
                    
                    return {
                        name,
                        title,
                        styles: styles.length > 0 ? styles : [{ name: 'default', title: 'Default' }],
                        dimensions
                    };
                });
            
            this.datasetCache.set(cacheKey, layers);
            return layers;
        } catch (error) {
            console.error(`Error fetching layers for ${wmsUrl}:`, error);
            return [];
        }
    }

    /**
     * Get GRIB forecast model data from the IDD catalog
     * @param {string} modelType - Model type (e.g., 'GFS_CONUS_80km', 'NAM_CONUS_12km')
     * @returns {Promise<Object>} Model metadata and access URLs
     */
    async getGribModelData(modelType) {
        try {
            // First get all model categories
            const categories = await this.getForecastModelCategories();
            
            // Look for the GRIB category
            const gribCategory = categories.find(cat => cat.name.includes('GRIB'));
            
            if (!gribCategory) {
                throw new Error('GRIB model category not found');
            }
            
            // Get models in the GRIB category
            const gribModels = await this.getModelsInCategory(gribCategory.href);
            
            // Find the requested model
            const model = gribModels.find(m => m.name.includes(modelType));
            
            if (!model) {
                throw new Error(`Model ${modelType} not found`);
            }
            
            // If it's a dataset, return it directly
            if (model.type === 'dataset') {
                return model;
            }
            
            // If it's a catalog, we need to get the datasets inside
            const modelDatasets = await this.getModelsInCategory(model.href);
            
            // Sort by name to get the latest
            modelDatasets.sort((a, b) => b.name.localeCompare(a.name));
            
            return modelDatasets.length > 0 ? modelDatasets[0] : null;
        } catch (error) {
            console.error(`Error fetching ${modelType} model data:`, error);
            return null;
        }
    }

    /**
     * Get the latest available time for a specific model layer
     * @param {string} wmsUrl - WMS URL for the dataset
     * @param {string} layer - Layer name
     * @returns {Promise<string>} Latest time value
     */
    async getLatestModelTime(wmsUrl, layer) {
        try {
            const layers = await this.getModelLayers(wmsUrl);
            const targetLayer = layers.find(l => l.name === layer);
            
            if (!targetLayer) {
                throw new Error(`Layer ${layer} not found`);
            }
            
            const timeDimension = targetLayer.dimensions.find(d => d.name === 'time');
            
            if (!timeDimension || !timeDimension.values || timeDimension.values.length === 0) {
                throw new Error('Time dimension not found or empty');
            }
            
            // Return the latest time (usually the last in the list)
            return timeDimension.values[timeDimension.values.length - 1];
        } catch (error) {
            console.error(`Error getting latest time for ${layer}:`, error);
            return null;
        }
    }
}

// Export the class
window.ThreddsConnector = ThreddsConnector;