interface ControlPanelProps {
  loading: boolean;
  showControls: boolean;
  radius: number;
  limit: number;
  onToggleControls: () => void;
  onSetRadius: (radius: number) => void;
  onSetLimit: (limit: number) => void;
  onLoadBalloonsHere: () => void;
  onLoadMyLocation: () => void;
}

const ControlPanel = ({
  loading,
  showControls,
  radius,
  limit,
  onToggleControls,
  onSetRadius,
  onSetLimit,
  onLoadBalloonsHere,
  onLoadMyLocation,
}: ControlPanelProps) => {
  return (
    <>
      {/* Control Panel Toggle Button */}
      {!loading && (
        <button
          onClick={onToggleControls}
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
      {!loading && showControls && (
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

          {/* Quick Preset Buttons */}
          <div style={{ marginBottom: "15px" }}>
            <label style={{ display: "block", marginBottom: "5px" }}>Quick Presets:</label>
            <div style={{ display: "flex", gap: "5px" }}>
              <button
                onClick={() => {
                  onSetRadius(500);
                  onSetLimit(10);
                }}
                style={{
                  flex: 1,
                  padding: "5px",
                  background: "#2196F3",
                  color: "white",
                  border: "none",
                  borderRadius: "4px",
                  fontSize: "11px",
                  cursor: "pointer",
                }}
              >
                ⚡ Fast
              </button>
              <button
                onClick={() => {
                  onSetRadius(1000);
                  onSetLimit(20);
                }}
                style={{
                  flex: 1,
                  padding: "5px",
                  background: "#FF9800",
                  color: "white",
                  border: "none",
                  borderRadius: "4px",
                  fontSize: "11px",
                  cursor: "pointer",
                }}
              >
                ⚖️ Balanced
              </button>
              <button
                onClick={() => {
                  onSetRadius(3000);
                  onSetLimit(100);
                }}
                style={{
                  flex: 1,
                  padding: "5px",
                  background: "#F44336",
                  color: "white",
                  border: "none",
                  borderRadius: "4px",
                  fontSize: "11px",
                  cursor: "pointer",
                }}
              >
                🌐 Full
              </button>
            </div>
          </div>

          <div style={{ marginBottom: "15px" }}>
            <label style={{ display: "block", marginBottom: "5px" }}>Search Radius: {radius}km</label>
            <input
              type="range"
              min="500"
              max="5000"
              step="100"
              value={radius}
              onChange={e => onSetRadius(Number(e.target.value))}
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
              onChange={e => onSetLimit(Number(e.target.value))}
              style={{ width: "100%" }}
            />
          </div>

          <button
            onClick={onLoadBalloonsHere}
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
            onClick={onLoadMyLocation}
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
    </>
  );
};

export default ControlPanel;
