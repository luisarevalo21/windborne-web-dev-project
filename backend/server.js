const express = require("express");
const BalloonRoute = require("./routes/balloon/ballon");
const WeatherRoute = require("./routes/weather/weather");
const cors = require("cors");

const app = express();

app.use(cors());

app.use("/health", (req, res) => {
  console.log("server running! ");
  return res.send("Server is running!");
});

app.use("/api/balloon", BalloonRoute);
app.use("/api/weather", WeatherRoute);

app.listen(3000, () => {
  console.log("Server is listening on port 3000");
});
