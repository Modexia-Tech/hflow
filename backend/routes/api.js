const router = require("express").Router();
router.post("/", async (req, res) => {
  try {
    console.log("Success");
    res.send("Success");
  } catch (err) {
    console.log("Failure");
    res.send("Failure");
  }
});
module.exports = router;
