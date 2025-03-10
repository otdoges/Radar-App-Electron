/**
 * Forecast Models Handler - Main Entry Point
 * Manages forecast model data from THREDDS
 */
const ForecastModelsUI = require('./forecast-models-ui');
const ForecastModelsLayer = require('./forecast-models-layer');

class ForecastModelsHandler {
    constructor(mapController, threddsConnector) {
        this.map = mapController.getMap();
        this.threddsConnector = threddsConnector;
        this.modelLayers = new Map();
        this.forecastModelsUrl = 'https://thredds.ucar.edu/thredds/catalog/idd/forecastModels.html';
        this.forecastModelsCatalog = 'https://thredds.ucar.edu/thredds/catalog/idd/forecastModels.xml';
        
        // Initialize UI and Layer handlers
        this.ui = new ForecastModelsUI(this);
        this.layerManager = new ForecastModelsLayer(this);
    }
    
    async loadForecastModels() {
        return this.ui.loadForecastModels();
    }

    async loadModelsForCategory(category, containerElement) {
        return this.ui.loadModelsForCategory(category, containerElement);
    }

    async showSubcategoryModels(model) {
        return this.ui.showSubcategoryModels(model);
    }

    async showModelLayers(model) {
        return this.ui.showModelLayers(model);
    }

    async addModelLayer(model, layer) {
        return this.layerManager.addModelLayer(model, layer);
    }

    addToActiveLayers(layerId, modelName, layerName) {
        return this.ui.addToActiveLayers(layerId, modelName, layerName);
    }
    
    removeModelLayer(layerId) {
        return this.layerManager.removeModelLayer(layerId);
    }
    
    setLayerOpacity(layerId, opacity) {
        return this.layerManager.setLayerOpacity(layerId, opacity);
    }
    
    removeAllLayers() {
        return this.layerManager.removeAllLayers();
    }
    
    async getModelTimeSteps(model, layer) {
        return this.layerManager.getModelTimeSteps(model, layer);
    }
    
    async setLayerTime(layerId, time) {
        return this.layerManager.setLayerTime(layerId, time);
    }
    
    addQuickAccessModels() {
        return this.ui.addQuickAccessModels();
    }
    
    async loadQuickAccessModel(modelType) {
        return this.ui.loadQuickAccessModel(modelType);
    }
    
    // Getters for internal components
    getMap() {
        return this.map;
    }
    
    getThreddsConnector() {
        return this.threddsConnector;
    }
    
    getModelLayers() {
        return this.modelLayers;
    }
}

// Export the ForecastModelsHandler
window.ForecastModelsHandler = ForecastModelsHandler;
module.exports = ForecastModelsHandler;