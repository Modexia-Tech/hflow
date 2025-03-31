const { getUser } = require("@services/database");
const path = require("path");
const jwt = require("jsonwebtoken");

function verifyToken(req, res, next) {
  const token = req.headers.authorization?.split(" ")[1]; // Expecting "Bearer TOKEN"

  if (!token) return res.status(401).send("Unauthorized");

  jwt.verify(token, process.env.SECRET_KEY, (err, user) => {
    if (err) return res.status(403).send("Forbidden");
    req.user = user;
    next();
  });
}
function requireRole(role) {
  return (req, res, next) => {
    if (!req.user || req.user.role !== role) {
      return res.status(403).sendFile(
        path.join(__dirname, "public", "403.html"),
      );
    }
    next();
  };
}
module.exports = { verifyToken, requireRole };
