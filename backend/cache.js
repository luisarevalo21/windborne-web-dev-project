const fs = require("fs");
const path = require("path");

const CACHE_DIR = path.join(__dirname, "../cache");
const CACHE_FILE = path.join(CACHE_DIR, "weather-cache.json");
const { findBoundingHeights, interpolateWeather, fetchHistoricalWeather } = require("./util/fetchWeatherData");
// Create cache directory if it doesn't exist
if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

function getTodayKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(
    2,
    "0"
  )}`;
}
// Load cache from file
function loadCache() {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      const data = fs.readFileSync(CACHE_FILE, "utf8");
      return JSON.parse(data);
    }
  } catch (error) {
    console.error("Failed to load cache:", error);
  }
  return {};
}

// Save cache to file
function saveCache(cache) {
  try {
    fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
  } catch (error) {
    console.error("Failed to save cache:", error);
  }
}

async function fetchWeatherData(balloonPaths) {
  // Load existing cache from disk
  const weatherCache = loadCache();
  let cacheUpdated = false;

  try {
    const uniqueLocations = new Map();

    for (let pathIndex = 0; pathIndex < balloonPaths.length; pathIndex++) {
      const balloonPath = balloonPaths[pathIndex];

      for (let i = 0; i < balloonPath.length; i++) {
        const point = balloonPath[i];
        const { lower, upper } = findBoundingHeights(point.altitude);
        const cacheKey = `${getTodayKey()}_${point.latitude.toFixed(0)},${point.longitude.toFixed(0)}`;
        // Skip if already in cache
        if (weatherCache[cacheKey]) {
          continue;
        }

        if (!uniqueLocations.has(cacheKey)) {
          uniqueLocations.set(cacheKey, {
            latitude: Math.round(point.latitude),
            longitude: Math.round(point.longitude),
            lowerPressure: lower.pressure,
            upperPressure: upper.pressure,
          });
        }
      }
    }

    const newLocationsCount = uniqueLocations.size;
    console.log(`Cache has ${Object.keys(weatherCache).length} locations`);
    console.log(`Need to fetch ${newLocationsCount} new locations...`);

    if (newLocationsCount > 0) {
      let requestCount = 0;
      const locationEntries = Array.from(uniqueLocations.entries());

      // Process sequentially to avoid rate limits
      for (let i = 0; i < locationEntries.length; i++) {
        const [cacheKey, location] = locationEntries[i];

        // Add delay between each location (except first)
        if (i > 0) {
          await new Promise(resolve => setTimeout(resolve, 400));
        }

        try {
          // Fetch lower pressure first
          const weatherLower = await fetchHistoricalWeather(
            location.latitude,
            location.longitude,
            location.lowerPressure
          );

          // Small delay before upper pressure request
          await new Promise(resolve => setTimeout(resolve, 200));

          // Then fetch upper pressure
          const weatherUpper = await fetchHistoricalWeather(
            location.latitude,
            location.longitude,
            location.upperPressure
          );

          weatherCache[cacheKey] = { lower: weatherLower, upper: weatherUpper };
          requestCount++;
          cacheUpdated = true;

          console.log(`✓ Fetched ${requestCount}/${newLocationsCount} locations`);
        } catch (error) {
          console.error(`✗ Failed for ${cacheKey}:`, error.message);

          if (error.message.includes("limit exceeded") || error.message.includes("Too many concurrent")) {
            console.warn("⚠️  Rate limit hit! Saving cache and using existing data...");
            saveCache(weatherCache);
            break;
          }
        }
      }

      // Save cache after fetching new data
      if (cacheUpdated) {
        saveCache(weatherCache);
        console.log("💾 Cache saved to disk");
      }
    }

    // Apply weather to all points
    for (let pathIndex = 0; pathIndex < balloonPaths.length; pathIndex++) {
      const balloonPath = balloonPaths[pathIndex];

      for (let i = 0; i < balloonPath.length; i++) {
        const point = balloonPath[i];
        const { lower, upper } = findBoundingHeights(point.altitude);
        const cacheKey = `${getTodayKey()}_${point.latitude.toFixed(0)},${point.longitude.toFixed(0)}`;

        const cachedWeather = weatherCache[cacheKey];

        if (!cachedWeather) {
          point.weather = { windSpeed: 0, windDirection: 0, temperature: 0 };
          continue;
        }

        const timeIndex = point.time;

        const lowerWeather = {
          windSpeed: cachedWeather.lower.hourly.wind_speed[timeIndex],
          windDirection: cachedWeather.lower.hourly.wind_direction[timeIndex],
          temperature: cachedWeather.lower.hourly.temperature[timeIndex],
        };

        const upperWeather = {
          windSpeed: cachedWeather.upper.hourly.wind_speed[timeIndex],
          windDirection: cachedWeather.upper.hourly.wind_direction[timeIndex],
          temperature: cachedWeather.upper.hourly.temperature[timeIndex],
        };

        point.weather = interpolateWeather(lowerWeather, upperWeather, point.altitude, lower.altitude, upper.altitude);
      }
    }

    return balloonPaths;
  } catch (error) {
    console.error("Error fetching weather data:", error);

    // Save whatever we have in cache
    if (cacheUpdated) {
      saveCache(weatherCache);
    }

    throw error;
  }
}
module.exports = {
  fetchWeatherData,
  loadCache,
  saveCache,
};
