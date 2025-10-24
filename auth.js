const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const JWT_SECRET = process.env.JWT_SECRET || "JWT_SECRET";
const JWT_EXPIRES = process.env.JWT_EXPIRES || "1d";

// register
router.post("/register", async (req, res) => {
  const { username, email, password, displayName } = req.body;
  if (!username || !password)
    return res.status(400).json({ error: "Username & password required" });

  const hash = await bcrypt.hash(password, 10);
  try {
    const user = await prisma.user.create({
      data: { username, email, passwordHash: hash, displayName },
    });
    const token = jwt.sign({ userId: user.id }, JWT_SECRET, {
      expiresIn: JWT_EXPIRES,
    });
    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
      },
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// login
router.post("/login", async (req, res) => {
  const { usernameOrEmail, password } = req.body;
  const user = await prisma.user.findFirst({
    where: { OR: [{ username: usernameOrEmail }, { email: usernameOrEmail }] },
  });
  if (!user) return res.status(401).json({ error: "Invalid credentials" });

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.status(401).json({ error: "Invalid credentials" });

  const token = jwt.sign({ userId: user.id }, JWT_SECRET, {
    expiresIn: JWT_EXPIRES,
  });
  res.json({
    token,
    user: {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
    },
  });
});

module.exports = router;
