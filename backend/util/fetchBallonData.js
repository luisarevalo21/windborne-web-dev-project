const SCALE_HEIGHT_METERS = 7640; // Approx scale height
// OR
const TENS_OF_KM = 10000;
const uuidv4 = require("uuid").v4;
// const fetchWeatherData = require("./fetchWeatherData");
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
  if (balloonPaths.length <= targetCount) return balloonPaths;

  // Take every Nth balloon for even distribution
  const step = Math.ceil(balloonPaths.length / targetCount);
  return balloonPaths.filter((_, index) => index % step === 0);
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
  const mock = false; //set to false to fetch real data

  //testing purposes with mock data
  if (mock) {
    const responseData = await fetchWeatherData([
      {
        time: 0,
        latitude: -6.72343719899604,
        longitude: 58.84621601705491,
        altitude: 8.9,
        balloonID: 0,
      },
      {
        time: 1,
        latitude: -7.427397379689796,
        longitude: 59.219998670322965,
        altitude: 8.21,
        balloonID: 0,
      },
      {
        time: 2,
        latitude: -8.351575932587778,
        longitude: 59.66125288630856,
        altitude: 7.32,
        balloonID: 0,
      },
      {
        time: 3,
        latitude: -9.253746340353645,
        longitude: 60.03846366639745,
        altitude: 6.47,
        balloonID: 0,
      },
      {
        time: 4,
        latitude: -10.136017432295269,
        longitude: 60.35455658390073,
        altitude: 5.68,
        balloonID: 0,
      },
      {
        time: 5,
        latitude: -10.995153136024486,
        longitude: 60.60826921545914,
        altitude: 4.95,
        balloonID: 0,
      },
      {
        time: 6,
        latitude: -11.832570661676328,
        longitude: 60.8000097793709,
        altitude: 4.29,
        balloonID: 0,
      },
      {
        time: 7,
        latitude: -12.644390102302077,
        longitude: 60.93280989809127,
        altitude: 3.7,
        balloonID: 0,
      },
      {
        time: 8,
        latitude: -13.429792204313108,
        longitude: 61.00644260146874,
        altitude: 3.19,
        balloonID: 0,
      },
      {
        time: 9,
        latitude: -14.191888471986115,
        longitude: 61.02264520469719,
        altitude: 2.77,
        balloonID: 0,
      },
      {
        time: 10,
        latitude: -14.925624703459158,
        longitude: 60.981619637281916,
        altitude: 2.43,
        balloonID: 0,
      },
      {
        time: 11,
        latitude: -15.6355670633463,
        longitude: 60.88435061937793,
        altitude: 2.19,
        balloonID: 0,
      },
      {
        time: 12,
        latitude: -16.31841779629241,
        longitude: 60.73473254239623,
        altitude: 2.05,
        balloonID: 0,
      },
      {
        time: 13,
        latitude: -16.975190081678036,
        longitude: 60.53231425580276,
        altitude: 2,
        balloonID: 0,
      },
      {
        time: 14,
        latitude: -17.607257620974003,
        longitude: 60.27821650240992,
        altitude: 2.05,
        balloonID: 0,
      },
      {
        time: 15,
        latitude: -18.212380447705115,
        longitude: 59.972881600850506,
        altitude: 2.19,
        balloonID: 0,
      },
      {
        time: 16,
        latitude: -18.79463050804228,
        longitude: 59.62049531250226,
        altitude: 2.43,
        balloonID: 0,
      },
      {
        time: 17,
        latitude: -19.35299151842465,
        longitude: 59.22157869764993,
        altitude: 2.77,
        balloonID: 0,
      },
      {
        time: 18,
        latitude: -19.88920146710626,
        longitude: 58.775045321911364,
        altitude: 3.19,
        balloonID: 0,
      },
      {
        time: 19,
        latitude: -20.402915481406474,
        longitude: 58.287079534112074,
        altitude: 3.7,
        balloonID: 0,
      },
      {
        time: 20,
        latitude: -20.89567605187215,
        longitude: 57.756889149767154,
        altitude: 4.28,
        balloonID: 0,
      },
      {
        time: 21,
        latitude: -21.368826617336165,
        longitude: 57.18606482020395,
        altitude: 4.95,
        balloonID: 0,
      },
      {
        time: 22,
        latitude: -21.825461530390122,
        longitude: 56.575958126345164,
        altitude: 5.68,
        balloonID: 0,
      },
    ]);

    const movementData = await calculateActualMovement(responseData);
    const comparisonData = await calculateAgreementScores(movementData);
    // console.log("Movement Data:", comparisonData);
    return comparisonData;
  }
  const balloonPaths = [];
  try {
    //create fucntion to fetch data from all 23 routes

    //then return array of array of balloon data mapped with id => to all balloon data for that balloon all 0-23 routes for this id
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
      // balloonPromises.push(fetch(url).then(res => res.json()));
    }
    //all ballon data
    const balloonResults = await Promise.all(balloonPromises);

    const validResults = balloonResults.filter(result => result !== null && Array.isArray(result));
    //mock data for testing
    // const balloonResults = [
    //   [[10.900048798584638, -150.9088746079718, 21.699713912787843]],
    //   [[12.861441932621995, 21.550374478939425, 2.0498235838611745]],
    //   [[-41.744405017231024, 153.0839787072968, 21.504142191058325]],
    //   [[14.79445850551678, -71.90010219907184, 2.96962142688327]],
    // ];
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
    console.log(`Total balloons available: ${sortedBalloonData.length}`);

    // Apply regional filtering if coordinates provided
    let filteredBalloons = sortedBalloonData;
    if (lat && lon) {
      filteredBalloons = filterBalloonsByRegion(sortedBalloonData, lat, lon, radius);
      console.log(`Balloons within ${radius}km of (${lat}, ${lon}): ${filteredBalloons.length}`);
    }

    // Smart sampling to get target count
    const sampledBalloons = sampleBalloons(filteredBalloons, limit);
    console.log(`Processing ${sampledBalloons.length} balloons (limit: ${limit})`);

    // Only fetch weather for sampled balloons (optimized)
    const weatherEnrichedData = await fetchWeatherData(sampledBalloons);
    const movementData = await calculateActualMovement(weatherEnrichedData);
    const comparisonData = await calculateAgreementScores(movementData);

    return {
      balloons: comparisonData,
      total: sortedBalloonData.length,
      filtered: filteredBalloons.length,
      displayed: sampledBalloons.length,
    };

    //struture is [index of balloon][array of points for that balloon sorted from oldest to newest]
    //data is an array of objects with lat lon altitude time balloonID\

    return sortPaths(Object.values(balloonPaths));
    // return;
    // const resposne = await fetch(url);
    // //returns an array of data for the current time
    // const responseData = await resposne.json();
    // const responseData = [
    //   [10.900048798584638, -150.9088746079718, 21.699713912787843],
    //   [12.861441932621995, 21.550374478939425, 2.0498235838611745],
    //   [-41.744405017231024, 153.0839787072968, 21.504142191058325],
    //   [14.79445850551678, -71.90010219907184, 2.96962142688327],
    // ]; //mock data

    //checking for an array
    // if (Array.isArray(responseData)) {
    //   //filter out bad data
    //   const validData = responseData
    //     .filter(balloonItem =>
    //       //validate the values of the current index
    //       validateBalloonData(balloonItem)
    //     )
    //     .map((balloonItem, index) =>
    //       //convert altitude from scale height to meters
    //       ({
    //         balloonId: uuidv4(),
    //         latitude: balloonItem[0],
    //         longitude: balloonItem[1],
    //         altitude: balloonItem[2] * TENS_OF_KM,
    //       })
    //     );
    //   returnedBalloonData.push(validData);
    // }
    // } catch (err) {
    //   console.error(`Failed to fetch data from ${url}:`, err);
    // }

    //returns array of array of balloon data
    // return returnedBalloonData;
  } catch (error) {
    console.error("Failed to fetch balloon data:", error);
    throw error;
  }
};

module.exports = fetchBalloonData;
