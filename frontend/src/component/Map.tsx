import React from "react";
import { Viewer, Entity, PointGraphics, PolylineGraphics, LabelGraphics } from "resium";
import {
  Cartesian3,
  Cartesian2,
  Color,
  HeadingPitchRange,
  Math as CesiumMath,
  PolylineArrowMaterialProperty,
} from "cesium";
import { useEffect, useState } from "react";
import { fetchBalloonData } from "../ api/balloon";
import Legend from "./Legend";
import Spinner from "./Spinner";
import ErrorDisplay from "./Error";
import * as turf from "@turf/turf"; // Ensure Turf.js is imported
const ALT_CONVERSION = 10000;
const DISPLAY_LENGTH_KM = 20; // How long the vector arrow should be visually
const BalloonPath = ({ path }) => {
  if (!path || path.length < 2) return null;
  const ALT_CONVERSION = 10000;
  const segments = [];
  const points = [];

  const reversedPath = [...path].reverse();

  for (let i = 0; i < reversedPath.length - 1; i++) {
    const P_start = reversedPath[i];
    const P_end = reversedPath[i + 1];

    if (!P_end.segmentColor) continue;

    const startPosition = Cartesian3.fromDegrees(
      P_start.longitude,
      P_start.latitude,
      P_start.altitude * ALT_CONVERSION
    );
    const endPosition = Cartesian3.fromDegrees(P_end.longitude, P_end.latitude, P_end.altitude * ALT_CONVERSION);

    const color = Color[P_end.segmentColor.toUpperCase()].withAlpha(0.8);

    // Create arrow material for direction indication
    const arrowMaterial = new PolylineArrowMaterialProperty(color);

    // Path segment with balloon ID in description
    segments.push(
      <Entity
        key={`segment-${P_end.time}-${P_end.balloonID}`}
        name={`Balloon ${P_end.balloonID} - Segment T=${P_end.time}`}
        description={`
          <strong>Balloon ID: ${P_end.balloonID}</strong><br/>
          Time: ${P_end.time}h ago<br/>
          Agreement Score: ${P_end.agreementScore}%<br/>
          Actual Speed: ${P_end.actualSpeed?.toFixed(1)} m/s<br/>
          Actual Direction: ${P_end.actualDirection?.toFixed(0)}°<br/>
          Model Wind Speed: ${P_end.weather?.windSpeed?.toFixed(1)} m/s<br/>
          Model Wind Direction: ${P_end.weather?.windDirection?.toFixed(0)}°
        `}
      >
        <PolylineGraphics positions={[startPosition, endPosition]} width={12} material={arrowMaterial} />
      </Entity>
    );

    // Point with label showing balloon ID and time
    points.push(
      <Entity
        key={`point-${P_end.time}-${P_end.balloonID}`}
        position={endPosition}
        name={`Balloon ${P_end.balloonID} - T=${P_end.time}`}
        description={`
          <strong>Balloon ID: ${P_end.balloonID}</strong><br/>
          Time: ${P_end.time}h ago<br/>
          Altitude: ${P_end.altitude.toFixed(2)} km<br/>
          Agreement: ${P_end.agreementScore}%<br/>
          Wind Speed: ${P_end.weather?.windSpeed?.toFixed(1)} m/s<br/>
          Direction: ${P_end.weather?.windDirection?.toFixed(0)}°
        `}
      >
        <PointGraphics pixelSize={8} color={color} outlineColor={Color.WHITE} outlineWidth={1} />
        <LabelGraphics
          text={`Balloon ID: ${P_end.balloonID}:T${P_end.time}`}
          font="14px sans-serif"
          fillColor={Color.WHITE}
          outlineColor={Color.BLACK}
          outlineWidth={2}
          style={0}
          pixelOffset={new Cartesian2(0, -20)}
          showBackground={true}
          backgroundColor={Color.BLACK.withAlpha(0.7)}
        />
      </Entity>
    );
  }

  return <>{[...segments, ...points]}</>;
};

const Map = () => {
  const [balloons, setBalloons] = useState([]);
  const [loading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [metadata, setMetadata] = useState({ total: 0, filtered: 0, displayed: 0 });
  const [radius, setRadius] = useState<number>(2000);
  const [limit, setLimit] = useState<number>(50);
  const [showControls, setShowControls] = useState<boolean>(true);
  const [loadingLocation, setLoadingLocation] = useState<{ lat: number; lon: number; radius: number } | null>(null);
  const viewerRef = React.useRef(null);

  const currentSegment = balloons.length > 0 && balloons[0].length > 0 ? balloons[0][0] : null;
  const START_ALTITUDE_M = currentSegment ? currentSegment.altitude * ALT_CONVERSION : 0;

  // Function to get current camera position
  const getCurrentCameraPosition = () => {
    if (!viewerRef.current) return null;

    const camera = viewerRef.current.cesiumElement.camera;
    const cartographic = camera.positionCartographic;

    return {
      latitude: CesiumMath.toDegrees(cartographic.latitude),
      longitude: CesiumMath.toDegrees(cartographic.longitude),
    };
  };

  // Load balloon data function
  const getBalloonData = async (userLat?: number, userLon?: number, customRadius?: number, customLimit?: number) => {
    try {
      setIsLoading(true);
      setError(null);

      const options: any = { limit: customLimit || limit };
      if (userLat !== undefined && userLon !== undefined) {
        options.lat = userLat;
        options.lon = userLon;
        options.radius = customRadius || radius;
        setLoadingLocation({ lat: userLat, lon: userLon, radius: customRadius || radius });
      } else {
        setLoadingLocation(null);
      }

      const response = await fetchBalloonData(options);
      const balloonData = response.balloons || response; // Support both old and new format
      setBalloons(balloonData);

      if (response.total) {
        setMetadata({
          total: response.total,
          filtered: response.filtered,
          displayed: response.displayed,
        });
      }
    } catch (error) {
      console.error("Error loading balloon data:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to load data";
      setError(errorMessage);
    } finally {
      setIsLoading(false);
      setLoadingLocation(null);
    }
  };

  // Function to refresh balloons at current camera position
  const refreshBalloonsHere = () => {
    const position = getCurrentCameraPosition();
    if (position) {
      getBalloonData(position.latitude, position.longitude);
    }
  };

  useEffect(() => {
    // Try to get user's location first
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        position => {
          const { latitude, longitude } = position.coords;
          getBalloonData(latitude, longitude);
        },
        error => {
          console.log("Location denied, using default view:", error);
          getBalloonData();
        }
      );
    } else {
      getBalloonData();
    }
  }, []);

  let modelVectorPoints = null;
  let actualVectorPoints = null;
  let startPosition = null;

  if (currentSegment) {
    const startLon = currentSegment.longitude;
    const startLat = currentSegment.latitude;
    const startAltM = currentSegment.altitude * ALT_CONVERSION;

    startPosition = Cartesian3.fromDegrees(startLon, startLat, startAltM);

    const turfStartPoint = turf.point([startLon, startLat]);

    const modelDir = currentSegment.weather.windDirection;
    const modelEndPoint = turf.destination(turfStartPoint, DISPLAY_LENGTH_KM, modelDir, { units: "kilometers" });
    const modelCoords = modelEndPoint.geometry.coordinates;
    const modelEndPosition = Cartesian3.fromDegrees(modelCoords[0], modelCoords[1], startAltM);
    modelVectorPoints = [startPosition, modelEndPosition];

    const actualDir = currentSegment.actualDirection;
    const actualEndPoint = turf.destination(turfStartPoint, DISPLAY_LENGTH_KM, actualDir, { units: "kilometers" });
    const actualCoords = actualEndPoint.geometry.coordinates;
    const actualEndPosition = Cartesian3.fromDegrees(actualCoords[0], actualCoords[1], startAltM);
    actualVectorPoints = [startPosition, actualEndPosition];
  }

  return (
    <>
      {loading && <Spinner location={loadingLocation} />}
      {error && !loading && <ErrorDisplay error={error} />}
      <Viewer full ref={viewerRef}>
        {/* Draw paths for all balloons */}
        {balloons.map((path, index) => (
          <BalloonPath key={index} path={path} />
        ))}

        {/* T=0 vectors and point for first balloon */}
        {startPosition && (
          <Entity position={startPosition} name={`Balloon ${currentSegment.balloonID} (T=0)`}>
            <PointGraphics pixelSize={15} color={Color.RED} outlineColor={Color.WHITE} outlineWidth={2} />
          </Entity>
        )}
        {modelVectorPoints && (
          <Entity name="Model Wind Vector">
            <PolylineGraphics
              positions={modelVectorPoints}
              width={5}
              material={Color.BLUE.withAlpha(0.8)}
              show={true}
            />
          </Entity>
        )}
        {actualVectorPoints && (
          <Entity name="Actual Movement Vector">
            <PolylineGraphics
              positions={actualVectorPoints}
              width={5}
              material={Color.GREEN.withAlpha(0.8)}
              show={true}
            />
          </Entity>
        )}
      </Viewer>

      {/* Control Panel Toggle Button */}
      {!loading && !error && (
        <button
          onClick={() => setShowControls(!showControls)}
          style={{
            position: "absolute",
            top: "20px",
            left: "20px",
            background: "rgba(0, 0, 0, 0.85)",
            color: "white",
            padding: "10px 15px",
            borderRadius: "8px",
            fontSize: "16px",
            zIndex: 1001,
            border: "1px solid rgba(255, 255, 255, 0.3)",
            cursor: "pointer",
            fontWeight: "bold",
          }}
        >
          {showControls ? "✕" : "☰"}
        </button>
      )}

      {/* Control Panel */}
      {!loading && !error && showControls && (
        <div
          style={{
            position: "absolute",
            top: "60px",
            left: "20px",
            background: "rgba(0, 0, 0, 0.85)",
            color: "white",
            padding: "20px",
            borderRadius: "8px",
            fontSize: "14px",
            zIndex: 1000,
            border: "1px solid rgba(255, 255, 255, 0.3)",
            minWidth: "250px",
          }}
        >
          <div style={{ fontWeight: "bold", fontSize: "16px", marginBottom: "15px" }}>🎯 Balloon Controls</div>

          <div style={{ marginBottom: "15px" }}>
            <label style={{ display: "block", marginBottom: "5px" }}>Search Radius: {radius}km</label>
            <input
              type="range"
              min="500"
              max="5000"
              step="100"
              value={radius}
              onChange={e => setRadius(Number(e.target.value))}
              style={{ width: "100%" }}
            />
          </div>

          <div style={{ marginBottom: "15px" }}>
            <label style={{ display: "block", marginBottom: "5px" }}>Max Balloons: {limit}</label>
            <input
              type="range"
              min="10"
              max="200"
              step="10"
              value={limit}
              onChange={e => setLimit(Number(e.target.value))}
              style={{ width: "100%" }}
            />
          </div>

          <button
            onClick={refreshBalloonsHere}
            disabled={loading}
            style={{
              width: "100%",
              padding: "10px",
              background: loading ? "#666" : "#4CAF50",
              color: "white",
              border: "none",
              borderRadius: "6px",
              fontSize: "14px",
              fontWeight: "bold",
              cursor: loading ? "not-allowed" : "pointer",
              marginBottom: "10px",
            }}
          >
            {loading ? "Loading..." : "🔄 Load Balloons Here"}
          </button>

          <button
            onClick={() => {
              if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(
                  position => {
                    getBalloonData(position.coords.latitude, position.coords.longitude);
                  },
                  error => {
                    console.error("Geolocation error:", error);
                  }
                );
              }
            }}
            disabled={loading}
            style={{
              width: "100%",
              padding: "10px",
              background: loading ? "#666" : "#2196F3",
              color: "white",
              border: "none",
              borderRadius: "6px",
              fontSize: "14px",
              fontWeight: "bold",
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            📍 Load My Location
          </button>
        </div>
      )}

      {!loading && !error && <Legend />}
      {!loading && !error && balloons.length > 0 && (
        <div
          style={{
            position: "absolute",
            top: "20px",
            right: "20px",
            background: "rgba(0, 0, 0, 0.85)",
            color: "white",
            padding: "15px 20px",
            borderRadius: "8px",
            fontSize: "14px",
            zIndex: 1000,
            border: "1px solid rgba(255, 255, 255, 0.3)",
            lineHeight: "1.6",
          }}
        >
          <div style={{ fontWeight: "bold", fontSize: "16px", marginBottom: "8px" }}>🎈 Balloon Tracker</div>
          <div>
            Displaying: <strong>{metadata.displayed || balloons.length}</strong>
          </div>
          {metadata.total > 0 && (
            <>
              <div>
                Available: <strong>{metadata.total}</strong>
              </div>
              {metadata.filtered !== metadata.total && (
                <div>
                  In Region: <strong>{metadata.filtered}</strong>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </>
  );
};

// const Map = () => {
//   //   const position = Cartesian3.fromDegrees(-74.0707383, 40.7117244, 100);
//   //   const pointGraphics = { pixelSize: 10 };

//   const [balloons, setBalloons] = useState([]);
//   const viewerRef = React.useRef(null);
//   // You need to ensure the altitude is in meters (10km per unit)

//   const currentSegment = balloons.length > 0 && balloons[0].length > 0 ? balloons[0][0] : null;
//   const START_ALTITUDE_M = currentSegment ? currentSegment.altitude * ALT_CONVERSION : 0;
//   useEffect(() => {
//     const getBalloonData = async () => {
//       const balloonData = await fetchBalloonData();
//       setBalloons(balloonData);

//       if (viewerRef.current && balloonData.length > 0) {
//         // Fly to the oldest position to ensure the entire path is visible
//         const firstBalloonStart = balloonData[balloonData.length - 1]; // T=23
//         const targetPosition = Cartesian3.fromDegrees(
//           firstBalloonStart.longitude,
//           firstBalloonStart.latitude,
//           firstBalloonStart.altitude * ALT_CONVERSION
//         );

//         viewerRef.current.cesiumElement.camera.flyTo({
//           destination: targetPosition,
//           duration: 4,
//           offset: new HeadingPitchRange(0, CesiumMath.toRadians(-90), 5000000),
//         });
//       }
//     };
//     getBalloonData();
//   }, []);

//   // ... inside your functional component ...

//   // Get the newest data point for the first balloon

//   let modelVectorPoints = null;
//   let actualVectorPoints = null;
//   let startPosition = null;

//   if (currentSegment) {
//     const startLon = currentSegment.longitude;
//     const startLat = currentSegment.latitude;
//     const startAltM = currentSegment.altitude * ALT_CONVERSION;

//     // 1. Define the START point (Cartesian3 for Cesium)
//     startPosition = Cartesian3.fromDegrees(startLon, startLat, startAltM);

//     // 2. Define the START point (Turf.js Point for calculation)
//     const turfStartPoint = turf.point([startLon, startLat]);

//     // --- A. Calculate Model Vector Endpoint (Blue) ---
//     const modelDir = currentSegment.weather.windDirection;
//     const modelEndPoint = turf.destination(turfStartPoint, DISPLAY_LENGTH_KM, modelDir, { units: "kilometers" });

//     // 3. Convert Model Endpoint to Cesium's Cartesian3
//     const modelCoords = modelEndPoint.geometry.coordinates; // Turf returns [lon, lat]
//     const modelEndPosition = Cartesian3.fromDegrees(modelCoords[0], modelCoords[1], startAltM);

//     modelVectorPoints = [startPosition, modelEndPosition];

//     // --- B. Calculate Actual Vector Endpoint (Green) ---
//     const actualDir = currentSegment.actualDirection; // Assumes you calculated this in Step 2.2
//     const actualEndPoint = turf.destination(turfStartPoint, DISPLAY_LENGTH_KM, actualDir, { units: "kilometers" });

//     // 4. Convert Actual Endpoint to Cesium's Cartesian3
//     const actualCoords = actualEndPoint.geometry.coordinates;
//     const actualEndPosition = Cartesian3.fromDegrees(actualCoords[0], actualCoords[1], startAltM);

//     actualVectorPoints = [startPosition, actualEndPosition];
//   }

//   //   const position = Cartesian3.fromDegrees(-74.0707383, 40.7117244, 100);

//   return (
//     <Viewer full ref={viewerRef}>
//       {/* Draw the entire path segmented by color */}
//       {balloons.length > 0 && balloons.map((path, index) => <BalloonPath key={index} path={path} />)}
//       {/* Draw the T=0 vectors and point for Balloon #0 (as before) */}
//       {startPosition && (
//         <Entity position={startPosition} name={`Balloon ${currentSegment.balloonID} (T=0)`}>
//           <PointGraphics pixelSize={15} color={Color.RED} outlineColor={Color.WHITE} outlineWidth={2} />
//         </Entity>
//       )}
//       {/* Model Vector (Blue) */}
//       {modelVectorPoints && (
//         <Entity name="Model Wind Vector">
//           <PolylineGraphics positions={modelVectorPoints} width={5} material={Color.BLUE.withAlpha(0.8)} show={true} />
//         </Entity>
//       )}
//       {/* Actual Vector (Green) */}
//       {actualVectorPoints && (
//         <Entity name="Actual Movement Vector">
//           <PolylineGraphics
//             positions={actualVectorPoints}
//             width={5}
//             material={Color.GREEN.withAlpha(0.8)}
//             show={true}
//           />
//         </Entity>
//       )}
//     </Viewer>
//   );
// };

export default Map;
