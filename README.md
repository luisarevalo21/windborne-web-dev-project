# 🎈 Weather Balloon Trajectory Visualizer

A full-stack application that visualizes weather balloon trajectories in 3D and compares actual balloon movements against weather model predictions to assess forecast accuracy.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Node](https://img.shields.io/badge/node-%3E%3D16.0.0-brightgreen.svg)
![React](https://img.shields.io/badge/react-18.x-61dafb.svg)

## 🌟 Overview

This project fetches real-world weather balloon data from Windborne Systems and compares the actual balloon trajectories against weather model predictions from Open-Meteo. It calculates agreement scores to visualize how accurately weather models predict stratospheric winds.

## ✨ Features

### Visualization

- **3D Globe Visualization** - Interactive Cesium-powered globe showing balloon paths
- **Color-Coded Trajectories** - Visual indication of forecast accuracy:
  - 🟢 Green: ≥70% agreement (Excellent)
  - 🟡 Yellow: 40-69% agreement (Moderate)
  - 🔴 Red: <40% agreement (Poor)
- **Directional Arrows** - Path segments show direction of travel with arrow indicators
- **Interactive Balloons** - Click balloons for detailed stats (speed, direction, altitude)
- **Vector Comparison** - Blue (model prediction) vs Green (actual movement) vectors at T=0

### Data & Analysis

- **Agreement Scoring** - Weighted algorithm (70% direction, 30% speed) comparing actual vs predicted winds
- **Regional Filtering** - Load balloons within custom radius (500-5000km) from any location
- **Smart Sampling** - Evenly distributed balloon selection for performance
- **24-Hour History** - Shows the last 24 hours of balloon data across multiple snapshots
- **Weather Caching** - File-based cache reduces API calls by ~90%, speeds up subsequent loads

### User Controls

- **Quick Presets** - ⚡ Fast (10/500km), ⚖️ Balanced (20/1000km), 🌐 Full (100/3000km)
- **Manual Adjustments** - Custom radius (500-5000km) and limit (10-200 balloons)
- **Dual Loading Modes** - "Load Balloons Here" (camera position) or "Load My Location" (GPS)
- **Interactive Control Panel** - Toggleable UI for adjusting parameters on the fly
- **Progress Indicators** - Loading screen shows search coordinates and progress

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

### Development Mode

**Start the Backend Server**

```bash
cd backend
npm run dev
```

Server runs on `http://localhost:3000`

**Available Endpoints:**

- `GET /api/balloon` - Fetch processed balloon trajectories with weather data
- `GET /health` - Health check endpoint

**Start the Frontend**

```bash
cd frontend
npm run dev
```

Frontend runs on `http://localhost:5173` (default Vite port)

**Access the Application**

Open your browser and navigate to `http://localhost:5173`

### Production Deployment

For detailed production deployment instructions, see [DEPLOYMENT.md](DEPLOYMENT.md)

**Quick Deploy to Render:**

1. Push to GitHub
2. Connect repository on [Render.com](https://render.com)
3. Set environment variables (see DEPLOYMENT.md)
4. Deploy automatically

**Free Tier Optimizations:**

- ✅ Automatic retry logic with exponential backoff
- ✅ 60-second timeout for cold starts
- ✅ User-friendly cold start messages
- ✅ No auto-load on initial page (prevents timeout)
- ✅ Warmup endpoint for keep-alive services

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

**Regional Filtering:**

- Filter balloons within specified radius from target coordinates
- Uses Turf.js distance calculations for accurate geographic filtering
- Reduces data transfer and processing time

### 2. Movement Calculation

For each consecutive pair of positions:

- Calculate 3D distance using Turf.js (accounting for altitude)
- Compute bearing (direction) between points
- Derive actual wind speed from distance/time

### 3. Weather Model Integration

- Fetch historical weather data from Open-Meteo at balloon timestamps
- 19 pressure levels from 1000hPa (0.11km) to 30hPa (22km altitude)
- Interpolate wind speed/direction between pressure levels for accurate altitude matching

**Caching Strategy:**

- File-based cache with date-based expiration (daily refresh)
- Coordinate rounding to nearest degree reduces unique locations from ~500 to ~50
- Cache key format: `YYYY-MM-DD_lat,lon`
- Sequential API fetching (400ms between locations, 200ms between pressure levels)
- First load: 30-60 seconds | Cached load: 2-3 seconds

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

### Backend Endpoints

- `GET /api/balloon?limit={num}&lat={lat}&lon={lon}&radius={km}` - Fetch filtered balloon data
- `GET /health` - Health check with timestamp and environment
- `GET /warmup` - Wake up server from cold start

**Query Parameters:**

- `limit` - Max balloons to return (default: 20)
- `lat` - Center latitude for regional filter (optional)
- `lon` - Center longitude for regional filter (optional)
- `radius` - Search radius in km (default: 1000)

**Response Format:**

```json
{
  "balloons": [[...], [...]], // Array of balloon paths
  "total": 900,                 // Total balloons available
  "filtered": 45,               // Balloons in region
  "displayed": 20               // Balloons returned (after limit)
}
```

### External APIs

**Balloon Data:**

- **Source**: `https://a.windbornesystems.com/treasure/`
- **Format**: Hourly JSON files (00-23)
- **Data**: `[latitude, longitude, altitude_km]`

**Weather Data:**

- **Source**: `https://api.open-meteo.com/v1/forecast`
- **Parameters**: Pressure level data (wind speed, direction, temperature)
- **Levels**: 19 levels from surface to 22km altitude
- **Rate Limits**: Handled with sequential fetching and caching

## ⚡ Performance

### Default Settings (Optimized for Speed)

- **Balloons**: 20 (adjustable 10-200)
- **Radius**: 1000km (adjustable 500-5000km)
- **Load Time**: 5-15 seconds (cached), 30-60 seconds (first load)

### Quick Presets

- **⚡ Fast**: 10 balloons, 500km - ~5 seconds
- **⚖️ Balanced**: 20 balloons, 1000km - ~10 seconds (default)
- **🌐 Full**: 100 balloons, 3000km - ~45 seconds

### Optimization Features

- Regional filtering reduces processing from 900+ to ~50 balloons
- Coordinate rounding reduces weather API calls by ~90%
- Smart sampling ensures even geographic distribution
- Sequential API requests prevent rate limiting
- File-based caching speeds up subsequent loads

## 🔧 Troubleshooting

### "Server is waking up from sleep"

- **Cause**: Free tier services sleep after 15 minutes of inactivity
- **Solution**: Wait 10-30 seconds, retry automatically happens
- **Prevention**: Use cron-job.org to ping `/warmup` every 10 minutes

### Slow Initial Load

- **Expected**: First load takes 30-60 seconds fetching weather data
- **Solution**: Subsequent loads are 2-3 seconds (cached)
- **Tip**: Use ⚡ Fast preset (10 balloons) for quickest loads

### No Balloons Displayed

- Check browser console for errors
- Verify you clicked "Load Balloons Here" or "Load My Location"
- Try increasing radius or limit
- Ensure backend is running and accessible

### API Rate Limit Errors

- Should not occur with current implementation
- Check cache is working properly
- Verify sequential fetching delays (400ms/200ms)

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
