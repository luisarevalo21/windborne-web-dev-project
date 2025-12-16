const router = require("express").Router();
const fetchBalloonData = require("../../util/fetchBallonData");
router.get("/", async (req, res) => {
  try {
    // Parse query parameters
    const limit = parseInt(req.query.limit) || 50;
    const lat = req.query.lat ? parseFloat(req.query.lat) : null;
    const lon = req.query.lon ? parseFloat(req.query.lon) : null;
    const radius = parseInt(req.query.radius) || 2000;

    console.log(`Fetching balloons with params: limit=${limit}, lat=${lat}, lon=${lon}, radius=${radius}`);

    const data = await fetchBalloonData({ limit, lat, lon, radius });

    if (!data || !data.balloons || data.balloons.length === 0) {
      return res.status(404).json({
        error: "No balloon data available",
        message: "Could not fetch any balloon trajectories",
      });
    }

    return res.json(data);
  } catch (err) {
    console.error("Balloon route error:", err);

    return res.status(500).json({
      error: "Failed to fetch balloon data",
      message: err.message,
    });
  }
});

module.exports = router;
