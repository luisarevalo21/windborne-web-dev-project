import * as React from "react";

interface ErrorProps {
  error: string;
}

const Error = ({ error }: ErrorProps) => {
  return (
    <div
      style={{
        position: "absolute",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        background: "rgba(255, 0, 0, 0.95)",
        color: "white",
        padding: "30px 40px",
        borderRadius: "12px",
        zIndex: 2000,
        maxWidth: "500px",
        textAlign: "center",
        boxShadow: "0 4px 20px rgba(0, 0, 0, 0.5)",
      }}
    >
      <div style={{ fontSize: "48px", marginBottom: "15px" }}>⚠️</div>
      <div style={{ fontSize: "24px", fontWeight: "bold", marginBottom: "15px" }}>Error Loading Data</div>
      <div style={{ fontSize: "16px", lineHeight: "1.5" }}>{error}</div>
      <button
        onClick={() => window.location.reload()}
        style={{
          marginTop: "20px",
          padding: "10px 20px",
          background: "white",
          color: "#ff0000",
          border: "none",
          borderRadius: "6px",
          fontSize: "16px",
          fontWeight: "bold",
          cursor: "pointer",
        }}
      >
        Retry
      </button>
    </div>
  );
};

export default Error;
