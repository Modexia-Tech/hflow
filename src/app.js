const dotenv = require("dotenv");
const express = require("express");
const cors = require("cors");
const { initDB } = require("./database");
const ussdRouter = require("./routes/ussd");
const apiRouter = require("./routes/api");
const bodyParser = require("body-parser");
const compression = require("compression");
const path = require("path");
dotenv.config();

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

// api routes
app.use("/ussd", ussdRouter);
app.use("/api", apiRouter);

app.get("/", (req, res) => {
  res.render("index", { title: "Home Page" });
});

app.listen(PORT, () => {
  console.log(`[INFO]: Server has started at http://localhost:${PORT}`);
  initDB();
});
