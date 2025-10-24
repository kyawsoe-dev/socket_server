const jwt = require("jsonwebtoken");
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || "JWT_SECRET";

async function authMiddleware(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: "Missing token" });
  const token = auth.split(" ")[1];
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
    });
    if (!user) throw new Error("No user");
    req.user = user;
    next();
  } catch (err) {
    res.status(401).json({ error: "Invalid token" });
  }
}

module.exports = authMiddleware;
