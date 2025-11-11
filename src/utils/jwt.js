const jwt = require("jsonwebtoken");
const JWT_SECRET = process.env.JWT_SECRET || "JWT_SECRET";
const JWT_EXPIRES = process.env.JWT_EXPIRES || "7d";

exports.signToken = (payload) => jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES });
exports.verifyToken = (token) => jwt.verify(token, JWT_SECRET);
