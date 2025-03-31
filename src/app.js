require("module-alias/register");

const dotenv = require("dotenv");
const express = require("express");
const cors = require("cors");
const path = require("path");
const bodyParser = require("body-parser");
const compression = require("compression");

dotenv.config();

const { PORT, PUBLIC_FOLDER } = require("@/constants");

const { initDB } = require("@services/database");

const { verifyToken, requireRole } = require("@middleware/auth");

const ussdRouter = require("@routes/ussd");
const userRouter = require("@routes/user");
const transactionRouter = require("@routes/transaction");
const adminRouter = require("@routes/admin");
// const webRouter = require("@routes/web");

const app = express();

app.use(cors());
app.use(compression());

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(bodyParser.text({ type: "text/plain" }));

// app.set("view engine", "ejs");
// app.set("views", path.join(__dirname, "views"));

app.use(express.static(PUBLIC_FOLDER));

// routes
app.use("/ussd", ussdRouter);
app.use("/user", userRouter);
app.use("/transaction", transactionRouter);
app.use("/admin", adminRouter);
// app.use("/", webRouter);

app.use((req, res) => {
  res.status(404).sendFile(path.join(PUBLIC_FOLDER, "404.html"));
});

app.listen(PORT, () => {
  console.log(`[INFO]: Server has started at http://localhost:${PORT}`);
  initDB();
});
