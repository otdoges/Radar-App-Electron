/**
 * Forecast Models Handler
 * Manages forecast model data from THREDDS
 * 
 * This file is now a wrapper that uses the modular implementation
 * in the forecast-models folder.
 */

// Import the modular implementation
const ForecastModelsHandler = require('./forecast-models/index');

// Export the ForecastModelsHandler for global use
window.ForecastModelsHandler = ForecastModelsHandler;