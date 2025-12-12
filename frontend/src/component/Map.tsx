import React from "react";
import { Viewer, Entity, PointGraphics, PolylineGraphics, LabelGraphics } from "resium";
import { Cartesian3, Cartesian2, Color, HeadingPitchRange, Math as CesiumMath } from "cesium";
import { useEffect, useState } from "react";
import { fetchBalloonData } from "../ api/balloon";
import Legend from "./Legend";
import Spinner from "./Spinner";
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
        <PolylineGraphics positions={[startPosition, endPosition]} width={4} material={color} />
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
  const viewerRef = React.useRef(null);

  const currentSegment = balloons.length > 0 && balloons[0].length > 0 ? balloons[0][0] : null;
  const START_ALTITUDE_M = currentSegment ? currentSegment.altitude * ALT_CONVERSION : 0;

  useEffect(() => {
    const getBalloonData = async (userLat?: number, userLon?: number) => {
      try {
        setIsLoading(true);
        const balloonData = await fetchBalloonData();
        setBalloons(balloonData);

        if (viewerRef.current && balloonData.length > 0 && balloonData[0].length > 0) {
          if (userLat !== undefined && userLon !== undefined) {
            // Fly to user's location
            const userPosition = Cartesian3.fromDegrees(userLon, userLat, 1000000);
            viewerRef.current.cesiumElement.camera.flyTo({
              destination: userPosition,
              duration: 3,
            });
          } else {
            // Default: fly to first balloon
            const firstBalloonStart = balloonData[0][balloonData[0].length - 1];
            const targetPosition = Cartesian3.fromDegrees(
              firstBalloonStart.longitude,
              firstBalloonStart.latitude,
              firstBalloonStart.altitude * ALT_CONVERSION
            );

            viewerRef.current.cesiumElement.camera.flyTo({
              destination: targetPosition,
              duration: 4,
              offset: new HeadingPitchRange(0, CesiumMath.toRadians(-90), 5000000),
            });
          }
        }
      } catch (error) {
        console.error("Error loading balloon data:", error);
      } finally {
        setIsLoading(false);
      }
    };

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
      {loading && <Spinner />}
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

      <Legend />
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
