const router = require("express").Router();
const fetchBalloonData = require("../../util/fetchBallonData");
router.get("/", async (req, res) => {
  try {
    // res.send("Balloon route is working! now");

    const data = await fetchBalloonData();

    // console.log("Fetched balloon data:", data);
    return res.json(data);
  } catch (err) {
    res.status(500).send("Server error");
  }
});

module.exports = router;
