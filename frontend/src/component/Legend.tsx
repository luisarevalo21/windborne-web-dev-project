const Legend = () => {
  return (
    <div
      style={{
        position: "absolute",
        bottom: "30px",
        left: "10px",
        background: "rgba(0, 0, 0, 0.85)",
        color: "white",
        padding: "15px",
        borderRadius: "8px",
        fontSize: "14px",
        zIndex: 1000,
        border: "1px solid rgba(255, 255, 255, 0.3)",
        minWidth: "200px",
      }}
    >
      <div style={{ fontWeight: "bold", marginBottom: "10px", fontSize: "16px" }}>Agreement Score Legend</div>
      <div style={{ display: "flex", alignItems: "center", marginBottom: "8px" }}>
        <div
          style={{
            width: "30px",
            height: "4px",
            backgroundColor: "#00ff00",
            marginRight: "10px",
          }}
        />
        <span>Green: ≥70% (Excellent)</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", marginBottom: "8px" }}>
        <div
          style={{
            width: "30px",
            height: "4px",
            backgroundColor: "#ffff00",
            marginRight: "10px",
          }}
        />
        <span>Yellow: 40-69% (Moderate)</span>
      </div>
      <div style={{ display: "flex", alignItems: "center" }}>
        <div
          style={{
            width: "30px",
            height: "4px",
            backgroundColor: "#ff0000",
            marginRight: "10px",
          }}
        />
        <span>Red: &lt;40% (Poor)</span>
      </div>
      <div
        style={{
          marginTop: "12px",
          fontSize: "12px",
          color: "#aaa",
          borderTop: "1px solid rgba(255,255,255,0.2)",
          paddingTop: "8px",
        }}
      >
        Model prediction accuracy vs actual balloon movement
      </div>
    </div>
  );
};

export default Legend;
