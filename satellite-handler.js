/**
 * Satellite Data Handler
 * Manages satellite imagery from THREDDS
 */
class SatelliteHandler {
    constructor(mapController, threddsConnector) {
        this.map = mapController.getMap();
        this.threddsConnector = threddsConnector;
        this.satelliteLayers = new Map();
        this.satelliteUrl = 'https://thredds.ucar.edu/thredds/catalog/idd/satellite.html';
        this.satelliteCatalogUrl = 'https://thredds.ucar.edu/thredds/catalog/idd/satellite.xml';
    }
    
    async loadSatelliteProducts() {
        try {
            const satellites = await this.threddsConnector.getSatelliteList(this.satelliteCatalogUrl);
            
            // Find or create the satellite section in the sidebar
            let satelliteSection = document.getElementById('satellite-section');
            if (!satelliteSection) {
                satelliteSection = document.createElement('div');
                satelliteSection.id = 'satellite-section';
                satelliteSection.className = 'control-section';
                satelliteSection.innerHTML = `
                    <div class="section-header">
                        <h3>Satellite Imagery</h3>
                        <button class="section-toggle"><i class="fas fa-chevron-down"></i></button>
                    </div>
                    <div class="section-content">
                        <div class="satellite-list"></div>
                    </div>
                `;
                
                const sidebar = document.getElementById('sidebar');
                sidebar.appendChild(satelliteSection);
                
                // Add toggle functionality
                const toggle = satelliteSection.querySelector('.section-toggle');
                toggle.addEventListener('click', () => {
                    const content = satelliteSection.querySelector('.section-content');
                    content.classList.toggle('active');
                    const icon = toggle.querySelector('i');
                    if (content.classList.contains('active')) {
                        icon.className = 'fas fa-chevron-up';
                    } else {
                        icon.className = 'fas fa-chevron-down';
                    }
                });
            }
            
            const satelliteList = satelliteSection.querySelector('.satellite-list');
            satelliteList.innerHTML = '';
            
            // Add satellite options
            for (const satellite of satellites) {
                const satItem = document.createElement('div');
                satItem.className = 'satellite-item';
                satItem.innerHTML = `
                    <h4>${satellite.name}</h4>
                    <div class="satellite-products">
                        <button class="sat-btn" data-sat="${satellite.id}" data-product="visible">Visible</button>
                        <button class="sat-btn" data-sat="${satellite.id}" data-product="infrared">Infrared</button>
                        <button class="sat-btn" data-sat="${satellite.id}" data-product="water-vapor">Water Vapor</button>
                    </div>
                `;
                
                satelliteList.appendChild(satItem);
            }
            
            // Add event listeners
            const satButtons = document.querySelectorAll('.sat-btn');
            satButtons.forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    const satellite = e.target.getAttribute('data-sat');
                    const product = e.target.getAttribute('data-product');
                    await this.toggleSatelliteLayer(satellite, product, btn);
                });
            });
            
        } catch (error) {
            console.error('Error loading satellite products:', error);
        }
    }
    
    async toggleSatelliteLayer(satellite, product, button) {
        const layerId = `${satellite}-${product}`;
        const isActive = button.classList.contains('active');
        
        if (isActive) {
            // Remove layer
            if (this.satelliteLayers.has(layerId)) {
                this.map.removeLayer(this.satelliteLayers.get(layerId));
                this.satelliteLayers.delete(layerId);
            }
            button.classList.remove('active');
        } else {
            // Add layer
            button.classList.add('active');
            document.getElementById('loading-indicator').style.display = 'block';
            
            try {
                let layer;
                let productName;
                let style = '';
                
                // Map product names to GOES channels
                switch (product) {
                    case 'visible':
                        productName = 'Channel02';
                        break;
                    case 'infrared':
                        productName = 'Channel13';
                        style = 'ir_rgbcolor';
                        break;
                    case 'water-vapor':
                        productName = 'Channel08';
                        style = 'ir_rgbcolor';
                        break;
                    default:
                        productName = 'Channel02';
                }
                
                const satData = await this.threddsConnector.getSatelliteImagery(satellite, 'ABI');
                if (satData.length > 0) {
                    const satLayer = satData.find(d => d.name.includes(productName));
                    if (satLayer) {
                        layer = this.threddsConnector.addWmsLayer(
                            this.map, 
                            satLayer.wmsUrl, 
                            'Sectorized_CMI', 
                            { opacity: 0.7, styles: style }
                        );
                    }
                }
                
                if (layer) {
                    this.satelliteLayers.set(layerId, layer);
                } else {
                    console.error(`Failed to load satellite layer: ${layerId}`);
                    button.classList.remove('active');
                }
            } catch (error) {
                console.error(`Error loading satellite layer ${layerId}:`, error);
                button.classList.remove('active');
                alert(`Error loading satellite imagery: ${error.message}`);
            } finally {
                document.getElementById('loading-indicator').style.display = 'none';
            }
        }
    }
}

// Export the SatelliteHandler
window.SatelliteHandler = SatelliteHandler;