const path = require("path");
const PUBLIC_FOLDER = path.join(__dirname, "public");
const PORT = process.env.PORT || 5000;

module.exports = { PUBLIC_FOLDER, PORT };
