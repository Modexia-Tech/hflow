const { getUser } = require("@services/database");
const jwt = require("jsonwebtoken");

function verifyUserToken(req, res, next) {
  const token = req.headers.authorization?.split(" ")[1]; // Expecting "Bearer TOKEN"

  if (!token) return res.status(401).send("Unauthorized");

  jwt.verify(token, process.env.SECRET_KEY, (err, user) => {
    if (err) return res.status(403).send("Forbidden");
    req.user = user;
    next();
  });
}

module.exports = { verifyUserToken };
