const jwt = require("jsonwebtoken");
const JWT_SECRET = process.env.JWT_SECRET || "JWT_SECRET";

exports.signToken = (payload) => jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
exports.verifyToken = (token) => jwt.verify(token, JWT_SECRET);
