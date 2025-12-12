import * as React from "react";
const Spinner = () => {
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
      <div style={{ fontSize: "16px", color: "#aaa" }}>Hang tight! Fetching trajectories and weather data.</div>
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
      <style>{`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}</style>
    </div>
  );
};

export default Spinner;
