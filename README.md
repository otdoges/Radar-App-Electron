```markdown
# Radar App

An Electron-based desktop application for visualizing NEXRAD weather radar data across the United States.

![Radar App Screenshot](screenshot.png)

## Features

- Real-time NEXRAD radar data visualization
- Support for multiple radar products (reflectivity, velocity, etc.)
- Weather alert monitoring and display
- Interactive measurements and data analysis
- Animation capabilities for tracking storm movement
- Multiple radar tilt angle support
- Customizable display options

## Installation

### Prerequisites

- [Node.js](https://nodejs.org/) (v14 or higher)
- [npm](https://www.npmjs.com/) or [pnpm](https://pnpm.io/)

### Setup

1. Clone the repository:
```bash
git clone https://github.com/yourusername/radar-app-electron.git
cd radar-app-electron
 ```
```

2. Install dependencies:
```bash
pnpm install
 ```

or

```bash
npm install
 ```

3. Start the application:
```bash
npm start
 ```

## Usage
### Radar Station Selection
Click on any radar station marker on the map to load data from that station. Active stations are displayed as blue dots, with the currently selected station highlighted in red.

### Product Selection
Use the product selector panel to choose different radar products:

- Reflectivity Products :
  
  - N0Q: Super-Resolution Base Reflectivity
  - N0R: Base Reflectivity
- Velocity Products :
  
  - N0U: Super-Resolution Base Velocity
  - N0V: Base Velocity
- Other Products :
  
  - N0C: Composite Reflectivity
  - N0K: Correlation Coefficient
  - N0H: Hydrometeor Classification
  - N0X: Differential Reflectivity
  - NTP: Storm Total Precipitation
### Tilt Angles
Select different tilt angles to view radar data at various elevations above the ground.

### Weather Alerts
The application automatically displays active weather alerts for the current map area. Click on an alert to view detailed information.

### Measurements
Hover your mouse over the radar display to see real-time measurements of:

- Reflectivity (dBZ)
- Velocity (m/s and mph)
- Temperature (°C and °F)
### Animation Controls
Use the animation controls to play through recent radar scans and track storm movement over time.

## Development
### Project Structure
- main.js - Electron main process
- renderer.js - Main application controller
- radar-processor.js - Handles radar data processing and visualization
- product-selector.js - Manages radar product selection
- alerts-handler.js - Processes weather alerts
- index.html - Main application UI
- styles.css - Application styling
### Building for Production
To build the application for production:

```bash
npm run build
 ```

This will create distributable packages in the dist_electron directory.

## License
ISC License

## Acknowledgments
- NOAA/NWS for providing NEXRAD radar data
- Leaflet for the interactive mapping capabilities
- Electron for the desktop application framework