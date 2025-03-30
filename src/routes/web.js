const router = require("express").Router();

router.get("/", (req, res) => {
  res.render("index", { title: "hpesa" });
});

module.exports = router;
