class ProductSelector {
    constructor(radarController) {
        this.radarController = radarController;
        this.currentProduct = 'N0Q'; // Default to Super-Res Base Reflectivity
        this.currentTilt = 1;
         this.productTypes = {
            reflectivity: ['N0Q', 'N0R'],
            velocity: ['N0U', 'N0V'],
            other: ['N0C', 'N0K', 'N0H', 'N0X', 'NTP']
        };
        this.initializeProductButtons();
    }

    initializeProductButtons() {
        const productButtons = document.querySelectorAll('.product-btn');
        const tiltButtons = document.querySelectorAll('.tilt-btn');
        
        // Use event delegation for product buttons
        const productContainer = document.querySelector('.product-category');
        if (productContainer) {
            productContainer.addEventListener('click', (e) => {
                const button = e.target.closest('.product-btn');
                if (!button) return;
                
                // Remove active class from all buttons
                productButtons.forEach(btn => btn.classList.remove('active'));
                
                // Add active class to clicked button
                button.classList.add('active');
                
                // Get product code from data attribute
                const productCode = button.getAttribute('data-product');
                this.selectProduct(productCode);
            });
        }
        
        // Use event delegation for tilt buttons
        const tiltContainer = document.querySelector('.tilt-buttons');
        if (tiltContainer) {
            tiltContainer.addEventListener('click', (e) => {
                const button = e.target.closest('.tilt-btn');
                if (!button) return;
                
                // Remove active class from all tilt buttons
                tiltButtons.forEach(btn => btn.classList.remove('active'));
                
                // Add active class to clicked button
                button.classList.add('active');
                
                // Get tilt number from data attribute
                const tilt = parseInt(button.getAttribute('data-tilt'), 10);
                this.selectTilt(tilt);
            });
        }
        
        // Set initial active states
        const defaultProductButton = document.querySelector(`.product-btn[data-product="${this.currentProduct}"]`);
        if (defaultProductButton) {
            defaultProductButton.classList.add('active');
        }
        
        const defaultTiltButton = document.querySelector(`.tilt-btn[data-tilt="${this.currentTilt}"]`);
        if (defaultTiltButton) {
            defaultTiltButton.classList.add('active');
        }
        
        // Set up legend visibility
        this.updateLegendVisibility(this.currentProduct);
    }
    
    selectProduct(productCode) {
        this.currentProduct = productCode;
        
        // If we have a current station, load the new product
        if (this.radarController.currentStation) {
            this.radarController.loadRadarData(
                this.radarController.currentStation, 
                productCode,
                this.currentTilt
            );
        }
        
        // Update legend visibility based on product type
        this.updateLegendVisibility(productCode);
    }
    
    selectTilt(tilt) {
        this.currentTilt = tilt;
        
        // If we have a current station, reload with new tilt
        if (this.radarController.currentStation) {
            this.radarController.loadRadarData(
                this.radarController.currentStation,
                this.currentProduct,
                tilt
            );
        }
    }
    
    updateLegendVisibility(productCode) {
        const reflectivityLegend = document.querySelector('.reflectivity-legend');
        const velocityLegend = document.querySelector('.velocity-legend');
        
        // Use the product type mapping for cleaner code
        const showReflectivity = this.productTypes.reflectivity.includes(productCode);
        const showVelocity = this.productTypes.velocity.includes(productCode);
        
        if (reflectivityLegend) reflectivityLegend.style.display = showReflectivity ? 'block' : 'none';
        if (velocityLegend) velocityLegend.style.display = showVelocity ? 'block' : 'none';
    }
}

module.exports = ProductSelector;