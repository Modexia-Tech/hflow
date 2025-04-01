const path = require("path");
const APP_FOLDER = __dirname;
const PUBLIC_FOLDER = path.join(__dirname, "public");
const PORT = process.env.PORT || 5000;

module.exports = { PUBLIC_FOLDER, PORT, APP_FOLDER };
