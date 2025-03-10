/**
 * Forecast Models UI Manager
 * Handles UI operations for forecast models
 */
class ForecastModelsUI {
    constructor(handler) {
        this.handler = handler;
        this.map = handler.getMap();
        this.threddsConnector = handler.getThreddsConnector();
        this.modelLayers = handler.getModelLayers();
    }
    
    async loadForecastModels() {
        try {
            // Get forecast model categories
            const categories = await this.threddsConnector.getForecastModelCategories();
            
            if (categories.length === 0) {
                console.error('No forecast model categories found');
                return;
            }
            
            // Find or create the forecast models section in the sidebar
            let forecastModelsSection = document.getElementById('forecast-models-section');
            if (!forecastModelsSection) {
                forecastModelsSection = document.createElement('div');
                forecastModelsSection.id = 'forecast-models-section';
                forecastModelsSection.className = 'control-section';
                forecastModelsSection.innerHTML = `
                    <div class="section-header">
                        <h3>Forecast Models</h3>
                        <button class="section-toggle"><i class="fas fa-chevron-down"></i></button>
                    </div>
                    <div class="section-content">
                        <div class="loading-models">Loading forecast models...</div>
                    </div>
                `;
                
                const sidebar = document.getElementById('sidebar');
                sidebar.appendChild(forecastModelsSection);
                
                // Add toggle functionality
                const toggle = forecastModelsSection.querySelector('.section-toggle');
                toggle.addEventListener('click', () => {
                    const content = forecastModelsSection.querySelector('.section-content');
                    content.classList.toggle('active');
                    const icon = toggle.querySelector('i');
                    if (content.classList.contains('active')) {
                        icon.className = 'fas fa-chevron-up';
                    } else {
                        icon.className = 'fas fa-chevron-down';
                    }
                });
            }
            
            // Get the section content
            const sectionContent = forecastModelsSection.querySelector('.section-content');
            sectionContent.innerHTML = '';
            
            // Add categories
            for (const category of categories) {
                const categoryDiv = document.createElement('div');
                categoryDiv.className = 'model-category';
                categoryDiv.innerHTML = `
                    <h4>${category.name}</h4>
                    <div class="model-list" id="model-list-${category.name.replace(/\s+/g, '-').toLowerCase()}">
                        <div class="loading-models">Loading models...</div>
                    </div>
                `;
                
                sectionContent.appendChild(categoryDiv);
                
                // Load models for this category
                this.loadModelsForCategory(category, categoryDiv.querySelector('.model-list'));
            }
        } catch (error) {
            console.error('Error loading forecast models:', error);
            const forecastModelsSection = document.getElementById('forecast-models-section');
            if (forecastModelsSection) {
                const sectionContent = forecastModelsSection.querySelector('.section-content');
                if (sectionContent) {
                    sectionContent.innerHTML = `<div class="error-message">Error loading forecast models: ${error.message}</div>`;
                }
            }
        }
    }

    async loadModelsForCategory(category, containerElement) {
        try {
            const models = await this.threddsConnector.getModelsInCategory(category.href);
            
            if (models.length === 0) {
                containerElement.innerHTML = '<div class="no-models">No models available</div>';
                return;
            }
            
            // Clear loading message
            containerElement.innerHTML = '';
            
            // Add models
            for (const model of models) {
                const modelElement = document.createElement('div');
                modelElement.className = 'model-item';
                
                if (model.type === 'dataset') {
                    modelElement.innerHTML = `
                        <button class="model-btn" data-wms-url="${model.wmsUrl}">
                            ${model.name}
                        </button>
                    `;
                    
                    // Add event listener
                    const btn = modelElement.querySelector('.model-btn');
                    btn.addEventListener('click', () => {
                        this.showModelLayers(model);
                    });
                } else {
                    modelElement.innerHTML = `
                        <button class="model-category-btn" data-href="${model.href}">
                            ${model.name} <i class="fas fa-chevron-right"></i>
                        </button>
                    `;
                    
                    // Add event listener
                    const btn = modelElement.querySelector('.model-category-btn');
                    btn.addEventListener('click', () => {
                        this.showSubcategoryModels(model);
                    });
                }
                
                containerElement.appendChild(modelElement);
            }
        } catch (error) {
            console.error(`Error loading models for category ${category.name}:`, error);
            containerElement.innerHTML = `<div class="error-message">Error loading models: ${error.message}</div>`;
        }
    }

    async showSubcategoryModels(model) {
        try {
            // Create a modal to display subcategory models
            const modal = document.createElement('div');
            modal.className = 'modal active';
            modal.innerHTML = `
                <div class="modal-content">
                    <span class="close-modal">&times;</span>
                    <h2>${model.name} Models</h2>
                    <div class="loading-models">Loading models...</div>
                    <div class="subcategory-models"></div>
                </div>
            `;
            
            document.body.appendChild(modal);
            
            // Add event listener to close button
            const closeBtn = modal.querySelector('.close-modal');
            closeBtn.addEventListener('click', () => {
                document.body.removeChild(modal);
            });
            
            // Get models in the subcategory
            const models = await this.threddsConnector.getModelsInCategory(model.href);
            
            const modelsContainer = modal.querySelector('.subcategory-models');
            const loadingElement = modal.querySelector('.loading-models');
            loadingElement.style.display = 'none';
            
            if (models.length === 0) {
                modelsContainer.innerHTML = '<div class="no-models">No models available</div>';
                return;
            }
            
            // Add models
            for (const subModel of models) {
                const modelElement = document.createElement('div');
                modelElement.className = 'model-item';
                
                if (subModel.type === 'dataset') {
                    modelElement.innerHTML = `
                        <button class="model-btn" data-wms-url="${subModel.wmsUrl}">
                            ${subModel.name}
                        </button>
                    `;
                    
                    // Add event listener
                    const btn = modelElement.querySelector('.model-btn');
                    btn.addEventListener('click', () => {
                        this.showModelLayers(subModel);
                        document.body.removeChild(modal);
                    });
                } else {
                    modelElement.innerHTML = `
                        <button class="model-category-btn" data-href="${subModel.href}">
                            ${subModel.name} <i class="fas fa-chevron-right"></i>
                        </button>
                    `;
                    
                    // Add event listener
                    const btn = modelElement.querySelector('.model-category-btn');
                    btn.addEventListener('click', () => {
                        document.body.removeChild(modal);
                        this.showSubcategoryModels(subModel);
                    });
                }
                
                modelsContainer.appendChild(modelElement);
            }
        } catch (error) {
            console.error(`Error loading subcategory models:`, error);
            const modal = document.querySelector('.modal.active');
            if (modal) {
                const modelsContainer = modal.querySelector('.subcategory-models');
                const loadingElement = modal.querySelector('.loading-models');
                loadingElement.style.display = 'none';
                modelsContainer.innerHTML = `<div class="error-message">Error loading models: ${error.message}</div>`;
            }
        }
    }

    async showModelLayers(model) {
        try {
            // Show loading indicator
            document.getElementById('loading-indicator').style.display = 'block';
            
            // Create a modal to display available layers
            const modal = document.createElement('div');
            modal.className = 'modal active';
            modal.innerHTML = `
                <div class="modal-content">
                    <span class="close-modal">&times;</span>
                    <h2>${model.name} Layers</h2>
                    <div class="loading-layers">Loading layers...</div>
                    <div class="layers-list"></div>
                </div>
            `;
            
            document.body.appendChild(modal);
            
            // Add event listener to close button
            const closeBtn = modal.querySelector('.close-modal');
            closeBtn.addEventListener('click', () => {
                document.body.removeChild(modal);
            });
            
            // Get layers for this model
            const layers = await this.threddsConnector.getModelLayers(model.wmsUrl);
            
            const layersList = modal.querySelector('.layers-list');
            const loadingElement = modal.querySelector('.loading-layers');
            loadingElement.style.display = 'none';
            
            if (layers.length === 0) {
                layersList.innerHTML = '<div class="no-layers">No layers available</div>';
                return;
            }
            
            // Group layers by category (first part of the name before underscore)
            const layerGroups = {};
            layers.forEach(layer => {
                const category = layer.name.split('_')[0] || 'Other';
                if (!layerGroups[category]) {
                    layerGroups[category] = [];
                }
                layerGroups[category].push(layer);
            });
            
            // Add layers by group
            for (const [category, groupLayers] of Object.entries(layerGroups)) {
                const groupElement = document.createElement('div');
                groupElement.className = 'layer-group';
                groupElement.innerHTML = `
                    <h3>${category}</h3>
                    <div class="layer-items"></div>
                `;
                
                const layerItems = groupElement.querySelector('.layer-items');
                
                // Add layers
                groupLayers.forEach(layer => {
                    const layerElement = document.createElement('div');
                    layerElement.className = 'layer-item';
                    layerElement.innerHTML = `
                        <button class="layer-btn" data-layer="${layer.name}">
                            ${layer.title || layer.name}
                        </button>
                    `;
                    
                    // Add event listener
                    const btn = layerElement.querySelector('.layer-btn');
                    btn.addEventListener('click', () => {
                        this.handler.addModelLayer(model, layer);
                        document.body.removeChild(modal);
                    });
                    
                    layerItems.appendChild(layerElement);
                });
                
                layersList.appendChild(groupElement);
            }
        } catch (error) {
            console.error(`Error loading model layers:`, error);
            const modal = document.querySelector('.modal.active');
            if (modal) {
                const layersList = modal.querySelector('.layers-list');
                const loadingElement = modal.querySelector('.loading-layers');
                loadingElement.style.display = 'none';
                layersList.innerHTML = `<div class="error-message">Error loading layers: ${error.message}</div>`;
            }
        } finally {
            document.getElementById('loading-indicator').style.display = 'none';
        }
    }

    addToActiveLayers(layerId, modelName, layerName) {
        // Find or create the active layers container
        let activeLayersContainer = document.getElementById('active-layers-container');
        if (!activeLayersContainer) {
            // Create the container if it doesn't exist
            const sidebar = document.getElementById('sidebar');
            activeLayersContainer = document.createElement('div');
            activeLayersContainer.id = 'active-layers-container';
            activeLayersContainer.className = 'control-section';
            activeLayersContainer.innerHTML = `
                <div class="section-header">
                    <h3>Active Layers</h3>
                    <button class="section-toggle"><i class="fas fa-chevron-down"></i></button>
                </div>
                <div class="section-content active-layers">
                    <div class="no-active-layers">No active layers</div>
                </div>
            `;
            sidebar.appendChild(activeLayersContainer);
            
            // Add toggle functionality
            const toggle = activeLayersContainer.querySelector('.section-toggle');
            toggle.addEventListener('click', () => {
                const content = activeLayersContainer.querySelector('.section-content');
                content.classList.toggle('active');
                const icon = toggle.querySelector('i');
                if (content.classList.contains('active')) {
                    icon.className = 'fas fa-chevron-up';
                } else {
                    icon.className = 'fas fa-chevron-down';
                }
            });
        }
        
        // Find the active layers list
        const activeLayersList = activeLayersContainer.querySelector('.active-layers');
        
        // Remove the "no active layers" message if it exists
        const noLayersMsg = activeLayersList.querySelector('.no-active-layers');
        if (noLayersMsg) {
            activeLayersList.removeChild(noLayersMsg);
        }
        
        // Create the layer item
        const layerItem = document.createElement('div');
        layerItem.className = 'active-layer-item';
        layerItem.setAttribute('data-layer-id', layerId);
        layerItem.innerHTML = `
            <div class="layer-info">
                <div class="layer-name">${layerName}</div>
                <div class="model-name">${modelName}</div>
            </div>
            <div class="layer-controls">
                <button class="layer-opacity-btn" title="Adjust Opacity"><i class="fas fa-adjust"></i></button>
                <button class="layer-remove-btn" title="Remove Layer"><i class="fas fa-times"></i></button>
            </div>
            <div class="layer-opacity-slider" style="display: none;">
                <input type="range" min="0" max="100" value="70" class="opacity-slider">
            </div>
        `;
        
        // Add event listeners
        const removeBtn = layerItem.querySelector('.layer-remove-btn');
        removeBtn.addEventListener('click', () => {
            this.handler.removeModelLayer(layerId);
        });
        
        const opacityBtn = layerItem.querySelector('.layer-opacity-btn');
        const opacitySlider = layerItem.querySelector('.layer-opacity-slider');
        opacityBtn.addEventListener('click', () => {
            if (opacitySlider.style.display === 'none') {
                opacitySlider.style.display = 'block';
            } else {
                opacitySlider.style.display = 'none';
            }
        });
        
        const slider = layerItem.querySelector('.opacity-slider');
        slider.addEventListener('input', (e) => {
            const opacity = parseInt(e.target.value) / 100;
            this.handler.setLayerOpacity(layerId, opacity);
        });
        
        activeLayersList.appendChild(layerItem);
    }

    // Method to add quick access buttons for common forecast models
    addQuickAccessModels() {
        try {
            // Find or create the quick access section
            let quickAccessSection = document.getElementById('quick-access-models');
            if (!quickAccessSection) {
                const sidebar = document.getElementById('sidebar');
                quickAccessSection = document.createElement('div');
                quickAccessSection.id = 'quick-access-models';
                quickAccessSection.className = 'control-section';
                quickAccessSection.innerHTML = `
                    <div class="section-header">
                        <h3>Quick Access Models</h3>
                        <button class="section-toggle"><i class="fas fa-chevron-down"></i></button>
                    </div>
                    <div class="section-content">
                        <div class="quick-models-list">
                            <button class="quick-model-btn" data-model="GFS">GFS Temperature</button>
                            <button class="quick-model-btn" data-model="GFS-PRECIP">GFS Precipitation</button>
                            <button class="quick-model-btn" data-model="HRRR">HRRR Reflectivity</button>
                            <button class="quick-model-btn" data-model="NAM">NAM Temperature</button>
                        </div>
                    </div>
                `;
                
                sidebar.appendChild(quickAccessSection);
                
                // Add toggle functionality
                const toggle = quickAccessSection.querySelector('.section-toggle');
                toggle.addEventListener('click', () => {
                    const content = quickAccessSection.querySelector('.section-content');
                    content.classList.toggle('active');
                    const icon = toggle.querySelector('i');
                    if (content.classList.contains('active')) {
                        icon.className = 'fas fa-chevron-up';
                    } else {
                        icon.className = 'fas fa-chevron-down';
                    }
                });
                
                // Add event listeners to quick access buttons
                const quickButtons = quickAccessSection.querySelectorAll('.quick-model-btn');
                quickButtons.forEach(btn => {
                    btn.addEventListener('click', () => {
                        const modelType = btn.getAttribute('data-model');
                        this.loadQuickAccessModel(modelType);
                    });
                });
            }
        } catch (error) {
            console.error('Error adding quick access models:', error);
        }
    }
    
    async loadQuickAccessModel(modelType) {
        try {
            document.getElementById('loading-indicator').style.display = 'block';
            
            let modelData;
            let layerName;
            let styleName = '';
            
            switch (modelType) {
                case 'GFS':
                    modelData = await this.threddsConnector.getModelData('GFS');
                    layerName = 'Temperature_surface';
                    styleName = 'temperature';
                    break;
                case 'GFS-PRECIP':
                    modelData = await this.threddsConnector.getModelData('GFS');
                    layerName = 'Total_precipitation_surface';
                    styleName = 'precip';
                    break;
                case 'HRRR':
                    modelData = await this.threddsConnector.getModelData('HRRR');
                    layerName = 'Reflectivity_1000m_above_ground';
                    break;
                case 'NAM':
                    modelData = await this.threddsConnector.getModelData('NAM');
                    layerName = 'Temperature_surface';
                    styleName = 'temperature';
                    break;
                default:
                    throw new Error(`Unknown model type: ${modelType}`);
            }
            
            if (modelData) {
                const latestTime = await this.threddsConnector.getLatestModelTime(modelData.wmsUrl, layerName);
                
                // Create a unique ID for this layer
                const layerId = `quick-${modelType}-${layerName}`;
                
                // Remove existing layer with the same ID if it exists
                if (this.modelLayers.has(layerId)) {
                    this.map.removeLayer(this.modelLayers.get(layerId));
                    this.modelLayers.delete(layerId);
                }
                
                // Add the WMS layer to the map
                const wmsLayer = this.threddsConnector.addWmsLayer(
                    this.map,
                    modelData.wmsUrl,
                    layerName,
                    {
                        opacity: 0.7,
                        styles: styleName,
                        time: latestTime
                    }
                );
                
                if (wmsLayer) {
                    // Store the layer
                    this.modelLayers.set(layerId, wmsLayer);
                    
                    // Add to active layers list
                    this.addToActiveLayers(layerId, modelData.name, layerName.replace(/_/g, ' '));
                    
                    console.log(`Added quick access model: ${layerName} from ${modelData.name}`);
                } else {
                    throw new Error(`Failed to add layer: ${layerName}`);
                }
            } else {
                throw new Error(`Failed to get model data for ${modelType}`);
            }
        } catch (error) {
            console.error(`Error loading quick access model ${modelType}:`, error);
            alert(`Error loading model: ${error.message}`);
        } finally {
            document.getElementById('loading-indicator').style.display = 'none';
        }
    }
}

module.exports = ForecastModelsUI;