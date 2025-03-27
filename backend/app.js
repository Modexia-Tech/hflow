const dotenv = require("dotenv");
const express = require("express");
const cors = require("cors");
const { initDB } = require("./database");
const ussdRouter = require("./routes/ussd");
const apiRouter = require("./routes/api");
const bodyParser = require("body-parser");
dotenv.config();

const app = express();
app.use(cors());
app.use("/ussd", ussdRouter);
app.use("/api", apiRouter);
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

app.listen(5000, () => {
  console.log("[INFO]: Server has started at https://localhost:5000");
  initDB();
});
