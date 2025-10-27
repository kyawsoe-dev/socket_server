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
    return res
      .status(400)
      .json({ error: "Username and password are required" });

  try {
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { username: { equals: username, mode: "insensitive" } },
          email ? { email: { equals: email, mode: "insensitive" } } : undefined,
        ].filter(Boolean),
      },
    });

    if (existingUser) {
      const message =
        existingUser.username.toLowerCase() === username.toLowerCase()
          ? "Username already taken"
          : "Email already registered";
      return res.status(409).json({ error: message });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: { username, email, passwordHash, displayName },
      select: { id: true, username: true, email: true, displayName: true },
    });

    const token = jwt.sign(
      { id: user.id },
      process.env.JWT_SECRET || "JWT_SECRET"
    );

    res.status(201).json({ token, user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Registration failed" });
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

// check user
router.get("/check", async (req, res) => {
  const { field, value } = req.query;
  if (!field || !value) return res.status(400).json({ available: false });

  const exists = await prisma.user.findFirst({ where: { [field]: value } });
  res.json({ available: !exists });
});

module.exports = router;
