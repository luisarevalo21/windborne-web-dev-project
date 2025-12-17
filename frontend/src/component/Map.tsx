import { useEffect, useState, useRef } from "react";
import { Viewer, Entity, PointGraphics, PolylineGraphics, LabelGraphics } from "resium";
import { Cartesian3, Cartesian2, Color, Math as CesiumMath, PolylineArrowMaterialProperty } from "cesium";
import { fetchBalloonData } from "../ api/balloon";
import Legend from "./Legend";
import Spinner from "./Spinner";
import ErrorDisplay from "./Error";
import ControlPanel from "./ControlPanel";
import * as turf from "@turf/turf";

interface BalloonPoint {
  balloonID: string;
  time: number;
  longitude: number;
  latitude: number;
  altitude: number;
  segmentColor?: string;
  agreementScore?: number;
  actualSpeed?: number;
  actualDirection?: number;
  weather?: {
    windSpeed: number;
    windDirection: number;
  };
}

const ALT_CONVERSION = 10000;
const DISPLAY_LENGTH_KM = 20;

const BalloonPath = ({ path }: { path: BalloonPoint[] }) => {
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

    const colorName = P_end.segmentColor.toUpperCase() as keyof typeof Color;
    const color = (Color[colorName] as any).withAlpha(0.8);

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
  const [balloons, setBalloons] = useState<BalloonPoint[][]>([]);
  const [loading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [metadata, setMetadata] = useState({ total: 0, filtered: 0, displayed: 0 });
  const [radius, setRadius] = useState<number>(1000);
  const [limit, setLimit] = useState<number>(20);
  const [showControls, setShowControls] = useState<boolean>(true);
  const [loadingLocation, setLoadingLocation] = useState<{ lat: number; lon: number; radius: number } | undefined>(
    undefined
  );
  const [loadingStage, setLoadingStage] = useState<string>("");
  const viewerRef = useRef<any>(null);

  const currentSegment: BalloonPoint | null = balloons.length > 0 && balloons[0].length > 0 ? balloons[0][0] : null;

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
      setLoadingStage("Connecting to server...");

      const options: any = { limit: customLimit || limit };
      if (userLat !== undefined && userLon !== undefined) {
        options.lat = userLat;
        options.lon = userLon;
        options.radius = customRadius || radius;
        setLoadingLocation({ lat: userLat, lon: userLon, radius: customRadius || radius });
      } else {
        setLoadingLocation(undefined);
      }

      setLoadingStage("Fetching balloon positions...");

      // Simulate progress for better UX
      setTimeout(() => setLoadingStage("Filtering by region..."), 2000);
      setTimeout(() => setLoadingStage("Fetching weather data..."), 4000);
      setTimeout(() => setLoadingStage("Calculating trajectories..."), 20000);

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
      setLoadingLocation(undefined);
      setLoadingStage("");
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
    // Don't load automatically on production - wait for user interaction
    // This prevents timeout on initial load with 900+ balloons
    // Users can click "Load Balloons Here" or "Load My Location" button
    // Optionally, try to get user's location but don't auto-load
    // if (navigator.geolocation) {
    //   navigator.geolocation.getCurrentPosition(
    //     position => {
    //       const { latitude, longitude } = position.coords;
    //       getBalloonData(latitude, longitude);
    //     },
    //     error => {
    //       console.log("Location denied, using default view:", error);
    //     }
    //   );
    // }
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

    if (currentSegment.weather) {
      const modelDir = currentSegment.weather.windDirection;
      const modelEndPoint = turf.destination(turfStartPoint, DISPLAY_LENGTH_KM, modelDir, { units: "kilometers" });
      const modelCoords = modelEndPoint.geometry.coordinates;
      const modelEndPosition = Cartesian3.fromDegrees(modelCoords[0], modelCoords[1], startAltM);
      modelVectorPoints = [startPosition, modelEndPosition];
    }

    if (currentSegment.actualDirection !== undefined) {
      const actualDir = currentSegment.actualDirection;
      const actualEndPoint = turf.destination(turfStartPoint, DISPLAY_LENGTH_KM, actualDir, { units: "kilometers" });
      const actualCoords = actualEndPoint.geometry.coordinates;
      const actualEndPosition = Cartesian3.fromDegrees(actualCoords[0], actualCoords[1], startAltM);
      actualVectorPoints = [startPosition, actualEndPosition];
    }
  }

  return (
    <>
      {loading && <Spinner location={loadingLocation} stage={loadingStage} metadata={metadata} />}
      {error && !loading && <ErrorDisplay error={error} />}

      {/* Welcome message when no balloons loaded */}
      {!loading && !error && balloons.length === 0 && (
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            background: "rgba(0, 0, 0, 0.9)",
            color: "white",
            padding: "40px",
            borderRadius: "12px",
            zIndex: 2000,
            maxWidth: "600px",
            textAlign: "center",
            boxShadow: "0 4px 20px rgba(0, 0, 0, 0.5)",
          }}
        >
          <div style={{ fontSize: "48px", marginBottom: "20px" }}>🎈</div>
          <div style={{ fontSize: "28px", fontWeight: "bold", marginBottom: "20px" }}>
            Welcome to Weather Balloon Tracker
          </div>
          <div style={{ fontSize: "16px", lineHeight: "1.6", marginBottom: "25px" }}>
            Click <strong>"Load Balloons Here"</strong> to view balloons at your current map location,
            <br />
            or click <strong>"Load My Location"</strong> to find balloons near you.
            <br />
            <br />
            💡 <strong>Tip:</strong> Use "⚡ Fast" preset (10 balloons, 500km) for quick loads!
          </div>
          <div style={{ fontSize: "14px", color: "#aaa" }}>
            Default: 20 balloons within 1000km • First load may take 30-60 seconds
          </div>
        </div>
      )}

      <Viewer full ref={viewerRef}>
        {/* Draw paths for all balloons */}
        {balloons.map((path, index) => (
          <BalloonPath key={index} path={path} />
        ))}

        {/* T=0 vectors and point for first balloon */}
        {startPosition && currentSegment && (
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

      {!error && (
        <ControlPanel
          loading={loading}
          showControls={showControls}
          radius={radius}
          limit={limit}
          onToggleControls={() => setShowControls(!showControls)}
          onSetRadius={setRadius}
          onSetLimit={setLimit}
          onLoadBalloonsHere={refreshBalloonsHere}
          onLoadMyLocation={() => {
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
        />
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
            minWidth: "200px",
          }}
        >
          <div style={{ fontWeight: "bold", fontSize: "16px", marginBottom: "12px" }}>🎈 Balloon Tracker</div>

          {/* Display count with dropdown */}
          <div style={{ marginBottom: "10px" }}>
            <label style={{ display: "block", marginBottom: "5px" }}>
              Displaying: <strong>{metadata.displayed || balloons.length}</strong>
            </label>
            <div style={{ display: "flex", gap: "5px" }}>
              <select
                value={limit}
                onChange={e => {
                  const newLimit = Number(e.target.value);
                  setLimit(newLimit);
                }}
                style={{
                  flex: 1,
                  padding: "5px",
                  background: "rgba(255, 255, 255, 0.1)",
                  color: "white",
                  border: "1px solid rgba(255, 255, 255, 0.3)",
                  borderRadius: "4px",
                  fontSize: "12px",
                  cursor: "pointer",
                }}
              >
                <option value={10}>10 balloons</option>
                <option value={20}>20 balloons</option>
                <option value={30}>30 balloons</option>
                <option value={50}>50 balloons</option>
                <option value={75}>75 balloons</option>
                <option value={100}>100 balloons</option>
                <option value={150}>150 balloons</option>
                <option value={200}>200 balloons</option>
              </select>
              <button
                onClick={() => {
                  const position = getCurrentCameraPosition();
                  if (position) {
                    getBalloonData(position.latitude, position.longitude);
                  }
                }}
                style={{
                  padding: "5px 10px",
                  background: "#4CAF50",
                  color: "white",
                  border: "none",
                  borderRadius: "4px",
                  fontSize: "12px",
                  cursor: "pointer",
                  fontWeight: "bold",
                }}
                title="Reload with new limit"
              >
                🔄
              </button>
            </div>
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

export default Map;
