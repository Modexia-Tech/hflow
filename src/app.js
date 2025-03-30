require("module-alias/register");

const dotenv = require("dotenv");
const express = require("express");
const cors = require("cors");
const path = require("path");
const bodyParser = require("body-parser");
const compression = require("compression");

dotenv.config();

const { initDB } = require("./database");
const ussdRouter = require("@routes/ussd");
const apiRouter = require("@routes/api");
const webRouter = require("@routes/web");

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(compression());

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(bodyParser.text({ type: "text/plain" }));

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use(express.static(path.join(__dirname, "public")));

// routes
app.use("/ussd", ussdRouter);
app.use("/api", apiRouter);
app.use("/", webRouter);

app.use((req, res) => {
  res.status(404).sendFile(path.join(__dirname, "public", "404.html"));
});

app.listen(PORT, () => {
  console.log(`[INFO]: Server has started at http://localhost:${PORT}`);
  initDB();
});
