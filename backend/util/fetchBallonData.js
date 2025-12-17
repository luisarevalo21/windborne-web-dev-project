const SCALE_HEIGHT_METERS = 7640; // Approx scale height
// OR
const TENS_OF_KM = 10000;
const { fetchWeatherData } = require("../cache"); // Use cached version
const turf = require("@turf/turf");

// Filter balloons by geographic region
const filterBalloonsByRegion = (balloonPaths, centerLat, centerLon, radiusKm) => {
  if (!centerLat || !centerLon || !radiusKm) return balloonPaths;

  return balloonPaths.filter(path => {
    if (!path || path.length === 0) return false;

    // Use most recent position (index 0 after sorting)
    const latestPoint = path[0];
    const from = turf.point([centerLon, centerLat]);
    const to = turf.point([latestPoint.longitude, latestPoint.latitude]);
    const distance = turf.distance(from, to, { units: "kilometers" });

    return distance <= radiusKm;
  });
};

// Smart sampling to distribute balloons evenly
const sampleBalloons = (balloonPaths, targetCount) => {
  if (balloonPaths.length <= targetCount) {
    console.log(`Returning all ${balloonPaths.length} balloons (less than limit ${targetCount})`);
    return balloonPaths;
  }

  const step = Math.max(1, Math.floor(balloonPaths.length / targetCount));
  const sampled = [];
  const sampledIndices = new Set();

  // First pass: take every Nth balloon
  for (let i = 0; i < balloonPaths.length && sampled.length < targetCount; i += step) {
    sampled.push(balloonPaths[i]);
    sampledIndices.add(i);
  }

  // Second pass: fill remaining slots if needed
  if (sampled.length < targetCount) {
    for (let i = 0; i < balloonPaths.length && sampled.length < targetCount; i++) {
      if (!sampledIndices.has(i)) {
        sampled.push(balloonPaths[i]);
        sampledIndices.add(i);
      }
    }
  }

  console.log(`Sampled ${sampled.length} from ${balloonPaths.length} (step: ${step}, target: ${targetCount})`);
  return sampled;
};
const validateBalloonData = data => {
  const [lat, lon, altitude] = data;

  // Validate latitude (-90 to 90)
  if (typeof lat !== "number" || lat < -90 || lat > 90) {
    return false;
  }

  // Validate longitude (-180 to 180)
  if (typeof lon !== "number" || lon < -180 || lon > 180) {
    return false;
  }

  // Validate altitude (reasonable range)
  if (typeof altitude !== "number" || isNaN(altitude)) {
    return false;
  }

  return true;
};

function sortPaths(pathsArray) {
  for (let i = 0; i < pathsArray.length; i++) {
    const points = pathsArray[i];

    // Sort ascending by the 'time' property: 23 (oldest) to 0 (newest).
    // This arranges the data so the polyline flows from the start of the 24-hour period to the current time.
    points.sort((a, b) => a.time - b.time);

    pathsArray[i] = points;
  }
  return pathsArray;
}

function calculateAgreementScores(pathWithVectors) {
  const MAX_PLAUSIBLE_WIND_ERROR = 30; // 30 m/s is a reasonable cap for stratospheric wind error

  for (let pathIndex = 0; pathIndex < pathWithVectors.length; pathIndex++) {
    const balloonPath = pathWithVectors[pathIndex];

    // We start at i=1 because the first point (T=0) is the first to have movement calculated
    for (let i = 1; i < balloonPath.length; i++) {
      const P_curr = balloonPath[i - 1]; // The point where all data is stored

      // Destructure Actual and Model values
      const Dir_Actual = P_curr.actualDirection;
      const Speed_Actual = P_curr.actualSpeed;
      const Dir_Model = P_curr.weather.windDirection;
      const Speed_Model = P_curr.weather.windSpeed;

      // --- 1. Angular Error ---
      const rawDiff = Math.abs(Dir_Actual - Dir_Model);
      P_curr.angularError = parseFloat(Math.min(rawDiff, 360 - rawDiff).toFixed(2));

      // --- 2. Speed Error ---
      P_curr.speedError = parseFloat(Math.abs(Speed_Actual - Speed_Model).toFixed(2));

      // --- 3. Normalized Scores ---

      // A. Direction Score (0 to 1)
      const S_Dir = 1 - P_curr.angularError / 180;

      // B. Speed Score (0 to 1, capped at 0)
      let S_Speed = 1 - P_curr.speedError / MAX_PLAUSIBLE_WIND_ERROR;
      S_Speed = Math.max(0, S_Speed); // Ensures score doesn't go negative

      // C. Combined Final Score (0 to 100)
      const weightedScore = 0.7 * S_Dir + 0.3 * S_Speed;
      P_curr.agreementScore = Math.round(weightedScore * 100);

      // Optional: Assign a color based on score for easy reference
      if (P_curr.agreementScore >= 70) {
        P_curr.segmentColor = "Green";
      } else if (P_curr.agreementScore >= 40) {
        P_curr.segmentColor = "Yellow";
      } else {
        P_curr.segmentColor = "Red";
      }
    }
  }
  return pathWithVectors;
}
function calculateActualMovement(sortedBalloonData) {
  const ALT_CONVERSION = 10000; // Your chosen conversion (e.g., 10km per unit)
  const TIME_INTERVAL_SEC = 3600; // 1 hour
  for (let pathIndex = 0; pathIndex < sortedBalloonData.length; pathIndex++) {
    const balloonPath = sortedBalloonData[pathIndex];
    for (let i = 1; i < balloonPath.length; i++) {
      const P_curr = balloonPath[i - 1]; // Newer point (End)
      const P_prev = balloonPath[i]; // Older point (Start)

      // Convert data to GeoJSON format for Turf.js
      const point_curr = turf.point([P_curr.longitude, P_curr.latitude]);
      const point_prev = turf.point([P_prev.longitude, P_prev.latitude]);

      // 1. Horizontal Distance (Turf.js returns distance in kilometers by default)
      const dist_km = turf.distance(point_prev, point_curr, { units: "kilometers" });
      const D_xy = dist_km * 1000; // Convert to meters

      // 2. Vertical Distance (in meters)
      const alt_curr_m = P_curr.altitude * ALT_CONVERSION;
      const alt_prev_m = P_prev.altitude * ALT_CONVERSION;
      const Delta_Z = Math.abs(alt_curr_m - alt_prev_m);

      // 3. 3D Distance (Pythagorean Theorem)
      const D_3D = Math.sqrt(D_xy ** 2 + Delta_Z ** 2);

      // 4. Actual Speed (m/s)
      P_curr.actualSpeed = parseFloat((D_3D / TIME_INTERVAL_SEC).toFixed(2));

      // 5. Actual Bearing (Direction)
      P_curr.actualDirection = parseFloat(turf.bearing(point_prev, point_curr).toFixed(2));

      // Normalize bearing to 0-360 if turf.bearing returns negative values
      if (P_curr.actualDirection < 0) {
        P_curr.actualDirection += 360;
      }
    }
  }
  return sortedBalloonData;
}
const fetchBalloonData = async (options = {}) => {
  const { limit = 50, lat, lon, radius = 2000 } = options;

  const balloonPaths = [];
  try {
    const balloonPromises = [];
    //gets all 24 routes
    for (let i = 0; i <= 23; i++) {
      const route = String(i).padStart(2, "0");
      const url = `https://a.windbornesystems.com/treasure/${route}.json`;

      balloonPromises.push(
        fetch(url)
          .then(async res => {
            // Check if response is OK and content-type is JSON
            if (!res.ok) {
              console.error(`HTTP error from ${url}: ${res.status} ${res.statusText}`);
              return null;
            }

            const contentType = res.headers.get("content-type");
            if (!contentType || !contentType.includes("application/json")) {
              console.error(`Non-JSON response from ${url}: ${contentType}`);
              return null;
            }

            return res.json();
          })
          .catch(err => {
            console.error(`Failed to fetch data from ${url}:`, err.message);
            return null;
          })
      );
    }
    //all ballon data
    const balloonResults = await Promise.all(balloonPromises);

    const validResults = balloonResults.filter(result => result !== null && Array.isArray(result));

    if (validResults.length === 0) {
      throw new Error("No valid balloon data available. The Windborne API may be down or returning invalid data.");
    }
    //process each hour's data

    for (let i = 0; i < validResults.length; i++) {
      const hourOffset = i;
      //all the balloon data for this hour offset
      const rawPoints = validResults[i];

      // Safety check: ensure rawPoints is a valid array
      if (!rawPoints || !Array.isArray(rawPoints)) {
        console.warn(`Invalid rawPoints at index ${i}, skipping...`);
        continue;
      }

      for (let balloonIndex = 0; balloonIndex < rawPoints.length; balloonIndex++) {
        const rawPoint = rawPoints[balloonIndex];
        // point isn't valid skip it
        if (!validateBalloonData(rawPoint)) {
          console.warn("Invalid balloon data skipped:", rawPoint);
          continue;
        }
        const [latitude, longitude, altitude] = rawPoint;
        const normalizedPoint = {
          time: hourOffset, // Time identifier (0 to 23)
          latitude: latitude,
          longitude: longitude,
          //alternative
          // /altitude: Math.round(altitude * 100) / 100,
          altitude: parseFloat(altitude.toFixed(2)),
          // The Balloon's ID is its current index in the array!
          //either index or index generate uuid each time
          balloonID: balloonIndex,
          // balloonID: uuidv4(),
        };
        // Ensure the path array for this balloon exists
        if (!balloonPaths[balloonIndex]) {
          balloonPaths[balloonIndex] = [];
        }

        // Add the point to the path. Since we are processing 00 -> 23,
        // the newest points are added first, which is ideal for a reverse sort later.
        balloonPaths[balloonIndex].push(normalizedPoint);
      }
    }

    // Sort all balloon paths
    const sortedBalloonData = sortPaths(Object.values(balloonPaths));

    // Apply regional filtering if coordinates provided
    let filteredBalloons = sortedBalloonData;
    console.log(`Total balloons fetched: ${sortedBalloonData.length}`);

    if (lat && lon) {
      filteredBalloons = filterBalloonsByRegion(sortedBalloonData, lat, lon, radius);
      console.log(`Balloons within ${radius}km of (${lat}, ${lon}): ${filteredBalloons.length}`);
    }

    // Smart sampling to get target count
    const sampledBalloons = sampleBalloons(filteredBalloons, limit);
    console.log(`Sampled ${sampledBalloons.length} balloons (requested limit: ${limit})`);

    // Only fetch weather for sampled balloons
    const weatherEnrichedData = await fetchWeatherData(sampledBalloons);
    const movementData = await calculateActualMovement(weatherEnrichedData);
    const comparisonData = await calculateAgreementScores(movementData);

    return {
      balloons: comparisonData,
      total: sortedBalloonData.length,
      filtered: filteredBalloons.length,
      displayed: sampledBalloons.length,
    };
  } catch (error) {
    console.error("Failed to fetch balloon data:", error);
    throw error;
  }
};

module.exports = fetchBalloonData;
