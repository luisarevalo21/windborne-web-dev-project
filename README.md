# 🎈 Weather Balloon Trajectory Visualizer

A full-stack application that visualizes weather balloon trajectories in 3D and compares actual balloon movements against weather model predictions to assess forecast accuracy.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Node](https://img.shields.io/badge/node-%3E%3D16.0.0-brightgreen.svg)
![React](https://img.shields.io/badge/react-18.x-61dafb.svg)

## 🌟 Overview

This project fetches real-world weather balloon data from Windborne Systems and compares the actual balloon trajectories against weather model predictions from Open-Meteo. It calculates agreement scores to visualize how accurately weather models predict stratospheric winds.

## ✨ Features

- **3D Globe Visualization** - Interactive Cesium-powered globe showing balloon paths
- **Agreement Scoring** - Weighted algorithm (70% direction, 30% speed) comparing actual vs predicted winds
- **Color-Coded Trajectories** - Visual indication of forecast accuracy:
  - 🟢 Green: ≥70% agreement (Excellent)
  - 🟡 Yellow: 40-69% agreement (Moderate)
  - 🔴 Red: <40% agreement (Poor)
- **Interactive Balloons** - Click balloons for detailed stats (speed, direction, altitude)
- **Vector Arrows** - Visual comparison of model predictions vs actual movement
- **User Geolocation** - Camera automatically flies to user's location
- **Multi-Balloon Support** - Displays multiple balloon trajectories simultaneously
- **24-Hour History** - Shows the last 24 hours of balloon data

## 🛠️ Tech Stack

### Backend

- **Node.js** & **Express** - REST API server
- **Axios** - HTTP requests to external APIs
- **Turf.js** - Geospatial calculations (distance, bearing)
- **CORS** - Cross-origin resource sharing

### Frontend

- **React** with **TypeScript** - UI framework
- **Vite** - Build tool and dev server
- **Cesium** & **Resium** - 3D globe visualization
- **Turf.js** - Vector calculations

### External APIs

- **Windborne Systems** - Real-time balloon position data
- **Open-Meteo** - Historical weather model data (19 pressure levels)

## 📦 Installation

### Prerequisites

- Node.js >= 16.0.0
- npm or yarn

### Setup

1. **Clone the repository**

```bash
git clone <repository-url>
cd windborne
```

2. **Install backend dependencies**

```bash
cd backend
npm install
```

3. **Install frontend dependencies**

```bash
cd ../frontend
npm install
```

## 🚀 Running the Application

### Start the Backend Server

```bash
cd backend
npm start
```

Server runs on `http://localhost:3000`

**Available Endpoints:**

- `GET /api/balloon` - Fetch processed balloon trajectories with weather data
- `GET /health` - Health check endpoint

### Start the Frontend

```bash
cd frontend
npm run dev
```

Frontend runs on `http://localhost:5173` (default Vite port)

### Access the Application

Open your browser and navigate to `http://localhost:5173`

## 📁 Project Structure

```
windborne/
├── backend/
│   ├── server.js              # Express server setup
│   ├── routes/
│   │   ├── balloon/
│   │   │   └── ballon.js      # Balloon API route
│   │   └── weather/
│   │       └── weather.js     # Weather API route
│   └── util/
│       ├── fetchBallonData.js # Main data processing logic
│       └── fetchWeatherData.js # Weather API integration
├── frontend/
│   ├── src/
│   │   ├── component/
│   │   │   ├── Map.tsx        # Main 3D visualization
│   │   │   ├── Legend.tsx     # Color-coding legend
│   │   │   └── Spinner.tsx    # Loading indicator
│   │   ├── api/
│   │   │   └── balloon.ts     # API client
│   │   ├── App.tsx
│   │   └── main.tsx
│   └── package.json
└── README.md
```

## 🧮 How It Works

### 1. Data Fetching

The backend fetches 24 hourly JSON files from Windborne Systems (`00.json` to `23.json`), each containing balloon position snapshots.

### 2. Movement Calculation

For each consecutive pair of positions:

- Calculate 3D distance using Turf.js (accounting for altitude)
- Compute bearing (direction) between points
- Derive actual wind speed from distance/time

### 3. Weather Model Integration

- Fetch historical weather data from Open-Meteo at balloon timestamps
- 19 pressure levels from 1000hPa (0.11km) to 30hPa (22km altitude)
- Interpolate wind speed/direction between pressure levels for accurate altitude matching

### 4. Agreement Score Calculation

```javascript
// Angular error (0-180°)
angularError = min(|actual_dir - model_dir|, 360 - |actual_dir - model_dir|)

// Normalized scores (0-1)
directionScore = 1 - (angularError / 180)
speedScore = max(0, 1 - (speedError / 30))  // 30 m/s cap

// Combined score (0-100)
agreementScore = (0.7 * directionScore + 0.3 * speedScore) * 100
```

### 5. Visualization

- Path segments colored by agreement score
- Interactive labels showing balloon ID and time
- Vector arrows at T=0 comparing model (blue) vs actual (green) wind
- Camera flies to user location or first balloon

## 🎨 Color Scheme

| Color     | Score Range | Meaning                  |
| --------- | ----------- | ------------------------ |
| 🟢 Green  | ≥70%        | Excellent model accuracy |
| 🟡 Yellow | 40-69%      | Moderate model accuracy  |
| 🔴 Red    | <40%        | Poor model accuracy      |

## 🌐 API Details

### Balloon Data

- **Source**: `https://a.windbornesystems.com/treasure/`
- **Format**: Hourly JSON files (00-23)
- **Data**: `[latitude, longitude, altitude_km]`

### Weather Data

- **Source**: `https://api.open-meteo.com/v1/forecast`
- **Parameters**: Pressure level data (wind speed, direction, temperature)
- **Levels**: 19 levels from surface to 22km altitude
- **Caching**: By rounded lat/lon to minimize API calls

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

This project is licensed under the MIT License.

## 🙏 Acknowledgments

- [Windborne Systems](https://windbornesystems.com/) for balloon data
- [Open-Meteo](https://open-meteo.com/) for weather model data
- [Cesium](https://cesium.com/) for 3D globe visualization
- [Turf.js](https://turfjs.org/) for geospatial calculations

---

Built with ❤️ for understanding atmospheric dynamics
