const weatherRouter = require("express").Router();

weatherRouter.get("/", (req, res) => {
  res.json({ message: "Weather route is working!" });
});

module.exports = weatherRouter;
