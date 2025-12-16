import * as React from "react";

interface SpinnerProps {
  location?: { lat: number; lon: number; radius: number };
}

const Spinner = ({ location }: SpinnerProps) => {
  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(0, 0, 0, 0.8)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 2000,
        color: "white",
      }}
    >
      <div style={{ fontSize: "24px", marginBottom: "20px" }}>🎈 Loading Balloon Data...</div>
      {location ? (
        <div style={{ fontSize: "16px", color: "#aaa", textAlign: "center", marginBottom: "10px" }}>
          Searching within {location.radius}km of
          <br />
          📍 {location.lat.toFixed(2)}°, {location.lon.toFixed(2)}°
        </div>
      ) : (
        <div style={{ fontSize: "16px", color: "#aaa" }}>Fetching trajectories and weather data...</div>
      )}
      <div
        style={{
          marginTop: "30px",
          width: "50px",
          height: "50px",
          border: "5px solid rgba(255, 255, 255, 0.3)",
          borderTop: "5px solid white",
          borderRadius: "50%",
          animation: "spin 1s linear infinite",
        }}
      />

      {/* Progress bar */}
      <div
        style={{
          marginTop: "30px",
          width: "300px",
          height: "4px",
          background: "rgba(255, 255, 255, 0.2)",
          borderRadius: "2px",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: "30%",
            height: "100%",
            background: "linear-gradient(90deg, #4CAF50, #8BC34A)",
            animation: "progress 1.5s ease-in-out infinite",
          }}
        />
      </div>

      <div style={{ marginTop: "15px", fontSize: "14px", color: "#888" }}>
        Please wait, this may take 30-60 seconds...
      </div>

      <style>{`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
            @keyframes progress {
              0% { transform: translateX(-100%); }
              100% { transform: translateX(400%); }
            }
          `}</style>
    </div>
  );
};

export default Spinner;
