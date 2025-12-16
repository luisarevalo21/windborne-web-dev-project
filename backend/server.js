const express = require("express");
const BalloonRoute = require("./routes/balloon/ballon");
const WeatherRoute = require("./routes/weather/weather");
const cors = require("cors");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || "development";

// CORS configuration
const corsOptions = {
  origin: process.env.FRONTEND_URL || "http://localhost:5173",
  credentials: true,
};

app.use(cors(corsOptions));
app.use(express.json());

// Health check endpoint
app.use("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString(), env: NODE_ENV });
});

// Warmup endpoint for cold starts (free tier)
app.use("/warmup", (req, res) => {
  res.json({ status: "ready", message: "Server is awake" });
});

// API routes
app.use("/api/balloon", BalloonRoute);
app.use("/api/weather", WeatherRoute);

// Serve static files in production
if (NODE_ENV === "production") {
  app.use(express.static(path.join(__dirname, "../frontend/dist")));

  // Catch-all route for client-side routing (Express 5 compatible)
  app.get("/*", (req, res) => {
    res.sendFile(path.join(__dirname, "../frontend/dist/index.html"));
  });
}

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: "Internal server error",
    message: NODE_ENV === "development" ? err.message : "Something went wrong",
  });
});

const server = app.listen(PORT, () => {
  console.log(`Server is listening on port ${PORT}`);
  console.log(`Environment: ${NODE_ENV}`);
});

// Increase timeout for long-running requests
server.timeout = 120000; // 2 minutes
