/**
 * Forecast Models Layer Manager
 * Handles layer operations for forecast models
 */
class ForecastModelsLayer {
    constructor(handler) {
        this.handler = handler;
        this.map = handler.getMap();
        this.threddsConnector = handler.getThreddsConnector();
        this.modelLayers = handler.getModelLayers();
    }
    
    async addModelLayer(model, layer) {
        try {
            // Show loading indicator
            document.getElementById('loading-indicator').style.display = 'block';
            
            // Get the latest time for this layer
            const latestTime = await this.threddsConnector.getLatestModelTime(model.wmsUrl, layer.name);
            
            // Create a unique ID for this layer
            const layerId = `model-${model.name.replace(/\s+/g, '-')}-${layer.name}`;
            
            // Remove existing layer with the same ID if it exists
            if (this.modelLayers.has(layerId)) {
                this.map.removeLayer(this.modelLayers.get(layerId));
                this.modelLayers.delete(layerId);
            }
            
            // Determine appropriate style for this layer
            let style = 'default';
            if (layer.styles && layer.styles.length > 0) {
                // Try to find appropriate style based on layer name
                if (layer.name.toLowerCase().includes('temp')) {
                    const tempStyle = layer.styles.find(s => s.name.toLowerCase().includes('temp'));
                    if (tempStyle) style = tempStyle.name;
                } else if (layer.name.toLowerCase().includes('precip')) {
                    const precipStyle = layer.styles.find(s => s.name.toLowerCase().includes('precip'));
                    if (precipStyle) style = precipStyle.name;
                } else if (layer.name.toLowerCase().includes('reflect')) {
                    const reflectStyle = layer.styles.find(s => s.name.toLowerCase().includes('reflect'));
                    if (reflectStyle) style = reflectStyle.name;
                }
            }
            
            // Add the WMS layer to the map
            const wmsLayer = this.threddsConnector.addWmsLayer(
                this.map,
                model.wmsUrl,
                layer.name,
                { 
                    opacity: 0.7,
                    styles: style,
                    time: latestTime
                }
            );
            
            if (wmsLayer) {
                // Store the layer
                this.modelLayers.set(layerId, wmsLayer);
                
                // Add to active layers list
                this.handler.addToActiveLayers(layerId, model.name, layer.title || layer.name);
                
                console.log(`Added model layer: ${layer.name} from ${model.name}`);
            } else {
                throw new Error(`Failed to add layer: ${layer.name}`);
            }
        } catch (error) {
            console.error(`Error adding model layer:`, error);
            alert(`Error adding model layer: ${error.message}`);
        } finally {
            document.getElementById('loading-indicator').style.display = 'none';
        }
    }
    
    removeModelLayer(layerId) {
        if (this.modelLayers.has(layerId)) {
            // Remove from map
            this.map.removeLayer(this.modelLayers.get(layerId));
            this.modelLayers.delete(layerId);

            // Remove from active layers list
            const layerItem = document.querySelector(`.active-layer-item[data-layer-id="${layerId}"]`);
            if (layerItem) {
                const parent = layerItem.parentNode;
                parent.removeChild(layerItem);

                // If no more layers, add the "no active layers" message back
                if (parent.children.length === 0) {
                    parent.innerHTML = '<div class="no-active-layers">No active layers</div>';
                }
            }

            console.log(`Removed model layer: ${layerId}`);
        }
    }

    setLayerOpacity(layerId, opacity) {
        if (this.modelLayers.has(layerId)) {
            const layer = this.modelLayers.get(layerId);
            layer.setOpacity(opacity);
            console.log(`Set opacity of ${layerId} to ${opacity}`);
        }
    }

    removeAllLayers() {
        // Remove all model layers from the map
        for (const [layerId, layer] of this.modelLayers.entries()) {
            this.map.removeLayer(layer);
        }

        // Clear the layers map
        this.modelLayers.clear();

        // Clear the active layers list
        const activeLayersList = document.querySelector('.active-layers');
        if (activeLayersList) {
            activeLayersList.innerHTML = '<div class="no-active-layers">No active layers</div>';
        }

        console.log('Removed all model layers');
    }
    
    async getModelTimeSteps(model, layer) {
        try {
            return await this.threddsConnector.getModelTimeSteps(model.wmsUrl, layer.name);
        } catch (error) {
            console.error(`Error getting time steps for ${layer.name}:`, error);
            return [];
        }
    }
    
    async setLayerTime(layerId, time) {
        if (this.modelLayers.has(layerId)) {
            const layer = this.modelLayers.get(layerId);
            layer.setParams({ time: time });
            console.log(`Set time of ${layerId} to ${time}`);
        }
    }
}

module.exports = ForecastModelsLayer;