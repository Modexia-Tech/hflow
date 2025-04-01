const router = require("express").Router();

router.get("/", (req, res) => {
  res.render("index", { title: "hflow" });
});

module.exports = router;
