const openmeteo = require("openmeteo");
const HEIGHT_LEVELS = [
  { pressure: 1000, altitude: 0.11 },
  { pressure: 975, altitude: 0.32 },
  { pressure: 950, altitude: 0.5 },
  { pressure: 925, altitude: 0.8 },
  { pressure: 900, altitude: 1.0 },
  { pressure: 850, altitude: 1.5 },
  { pressure: 800, altitude: 1.9 },
  { pressure: 700, altitude: 3.0 },
  { pressure: 600, altitude: 4.2 },
  { pressure: 500, altitude: 5.6 },
  { pressure: 400, altitude: 7.2 },
  { pressure: 300, altitude: 9.2 },
  { pressure: 250, altitude: 10.4 },
  { pressure: 200, altitude: 11.8 },
  { pressure: 150, altitude: 13.5 },
  { pressure: 100, altitude: 15.8 },
  { pressure: 70, altitude: 17.7 },
  { pressure: 50, altitude: 19.3 },
  { pressure: 30, altitude: 22.0 },
];

async function fetchHistoricalWeather(latitude, longitude, pressure) {
  const params = {
    latitude: latitude,
    longitude: longitude,
    hourly: [
      `geopotential_height_${pressure}hPa`,
      `wind_direction_${pressure}hPa`,
      `wind_speed_${pressure}hPa`,
      `temperature_${pressure}hPa`,
    ],
    past_days: 1,
    forecast_days: 1,
  };
  const url = "https://api.open-meteo.com/v1/forecast";
  const responses = await openmeteo.fetchWeatherApi(url, params);
  const response = responses[0];
  const hourly = response.hourly();

  // Extract the arrays - order matches the hourly array in params
  const weatherData = {
    hourly: {
      wind_speed: hourly.variables(2).valuesArray(),
      wind_direction: hourly.variables(1).valuesArray(),
      temperature: hourly.variables(3).valuesArray(),
    },
  };

  return weatherData;
}

async function fetchWeatherData(balloonPaths) {
  const weatherCache = {};

  try {
    const uniqueLocations = new Map();

    for (let pathIndex = 0; pathIndex < balloonPaths.length; pathIndex++) {
      const balloonPath = balloonPaths[pathIndex];

      for (let i = 0; i < balloonPath.length; i++) {
        const point = balloonPath[i];
        const { lower, upper } = findBoundingHeights(point.altitude);

        // AGGRESSIVE ROUNDING - reduces unique locations from ~500 to ~50
        const cacheKey = `${point.latitude.toFixed(0)},${point.longitude.toFixed(0)}`; // Round to nearest degree

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

    console.log(`Fetching weather for ${uniqueLocations.size} unique locations (rounded)...`);

    // Add delay between requests to avoid rate limit
    let requestCount = 0;
    for (const [cacheKey, location] of uniqueLocations) {
      try {
        // Add 200ms delay between requests
        if (requestCount > 0) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }

        const [weatherLower, weatherUpper] = await Promise.all([
          fetchHistoricalWeather(location.latitude, location.longitude, location.lowerPressure),
          fetchHistoricalWeather(location.latitude, location.longitude, location.upperPressure),
        ]);

        weatherCache[cacheKey] = { lower: weatherLower, upper: weatherUpper };
        requestCount++;

        console.log(`Fetched ${requestCount}/${uniqueLocations.size} locations...`);
      } catch (error) {
        console.error(`Failed to fetch weather for ${cacheKey}:`, error.message);

        // If rate limited, stop trying and use what we have
        if (error.message.includes("limit exceeded")) {
          console.warn("Rate limit hit, using cached data only");
          break;
        }

        weatherCache[cacheKey] = null;
      }
    }

    // Apply weather to all points using rounded lookup
    for (let pathIndex = 0; pathIndex < balloonPaths.length; pathIndex++) {
      const balloonPath = balloonPaths[pathIndex];

      for (let i = 0; i < balloonPath.length; i++) {
        const point = balloonPath[i];
        const { lower, upper } = findBoundingHeights(point.altitude);
        const cacheKey = `${point.latitude.toFixed(0)},${point.longitude.toFixed(0)}`;

        const cachedWeather = weatherCache[cacheKey];

        if (!cachedWeather) {
          // Use default values if no weather data
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
    throw error;
  }
}
// async function fetchWeatherData(sortedBalloonData) {
//   // Implement the logic to fetch weather data based on sortedBalloonData
//   // This is a placeholder function
//   // console.log("Fetching weather data for balloon data...", sortedBalloonData);
//   const weatherCache = {};

//   //here i'll be fetching the weatehr data for the sorted balloon data
//   try {
//     for (let pathIndex = 0; pathIndex < sortedBalloonData.length; pathIndex++) {
//       const balloonPath = sortedBalloonData[pathIndex];

//       for (let i = 0; i < balloonPath.length; i++) {
//         const balloonPoint = balloonPath[i];
//         // console.log("Processing balloon point:", balloonPoint);
//         // Fetch weather data for balloonPoint.latitude, balloonPoint.longitude, balloonPoint.altitude
//         // and attach it to balloonPoint as needed
//         const { lower, upper } = findBoundingHeights(balloonPoint.altitude);
//         const cacheKey = `${balloonPoint.latitude.toFixed(2)},${balloonPoint.longitude.toFixed(2)}`;

//         if (!weatherCache[cacheKey]) {
//           //fetch the weather data for lwoer and upper heights
//           const [weatherLower, weatherUpper] = await Promise.all([
//             fetchHistoricalWeather(balloonPoint.latitude, balloonPoint.longitude, lower.pressure),
//             fetchHistoricalWeather(balloonPoint.latitude, balloonPoint.longitude, upper.pressure),
//           ]);
//           weatherCache[cacheKey] = { lower: weatherLower, upper: weatherUpper };
//         }
//         const timeIndex = balloonPoint.time;

//         const lowerWeather = {
//           windSpeed: weatherCache[cacheKey].lower.hourly.wind_speed[timeIndex],
//           windDirection: weatherCache[cacheKey].lower.hourly.wind_direction[timeIndex],
//           temperature: weatherCache[cacheKey].lower.hourly.temperature[timeIndex],
//         };

//         const upperWeather = {
//           windSpeed: weatherCache[cacheKey].upper.hourly.wind_speed[timeIndex],
//           windDirection: weatherCache[cacheKey].upper.hourly.wind_direction[timeIndex],
//           temperature: weatherCache[cacheKey].upper.hourly.temperature[timeIndex],
//         };

//         // Interpolate
//         balloonPoint.weather = interpolateWeather(
//           lowerWeather,
//           upperWeather,
//           balloonPoint.altitude,
//           lower.altitude,
//           upper.altitude
//         );
//       }
//     }

//     return sortedBalloonData;
//   } catch (error) {
//     console.error("Error fetching weather data:", error);
//     throw error;
//   }
// }

function interpolate(value1, value2, targetAlt, alt1, alt2) {
  const ratio = (targetAlt - alt1) / (alt2 - alt1);
  return parseFloat((value1 + (value2 - value1) * ratio).toFixed(2));
}
function interpolateWeather(lowerWeather, upperWeather, targetAlt, lowerAlt, upperAlt) {
  return {
    //in km/hr
    windSpeed: interpolate(lowerWeather.windSpeed, upperWeather.windSpeed, targetAlt, lowerAlt, upperAlt),
    //in degrees
    windDirection: interpolate(lowerWeather.windDirection, upperWeather.windDirection, targetAlt, lowerAlt, upperAlt),
    //in celsius
    temperature: interpolate(lowerWeather.temperature, upperWeather.temperature, targetAlt, lowerAlt, upperAlt),
  };
}
function findBoundingHeights(altitude) {
  // const sorted = [...HEIGHT_LEVELS].sort((a, b) => a.altitude - b.altitude);

  let lower = null;
  let upper = null;

  for (let i = 0; i < HEIGHT_LEVELS.length; i++) {
    if (HEIGHT_LEVELS[i].altitude <= altitude) {
      lower = HEIGHT_LEVELS[i];
    }
    if (HEIGHT_LEVELS[i].altitude >= altitude && !upper) {
      upper = HEIGHT_LEVELS[i];
      break;
    }
  }

  // If altitude is beyond bounds, use closest available
  if (!lower) lower = HEIGHT_LEVELS[0];
  if (!upper) upper = HEIGHT_LEVELS[HEIGHT_LEVELS.length - 1];

  return { lower, upper };
}

module.exports = {
  fetchWeatherData, // Your original non-cached version
  findBoundingHeights,
  interpolateWeather,
  fetchHistoricalWeather,
};
