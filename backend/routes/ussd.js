const router = require("express").Router();

router.post("/", async (req, res) => {
  try {
    console.log(req.body);
    res.send("END hello");
  } catch (err) {
    console.log(err.message);
    res.send("END Failed");
  }
});

module.exports = router;
