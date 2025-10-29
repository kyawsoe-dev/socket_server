const prisma = require("../config/prisma");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "JWT_SECRET";
const JWT_EXPIRES = process.env.JWT_EXPIRES || "1d";

// Register
exports.register = async ({ username, email, password, displayName }) => {
    if (!username || !password) throw new Error("Username and password are required");

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
        throw new Error(message);
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
        data: { username, email, passwordHash, displayName },
        select: { id: true, username: true, email: true, displayName: true },
    });

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: JWT_EXPIRES });

    return { token, user };
};

// Login
exports.login = async ({ usernameOrEmail, password }) => {
    if (!usernameOrEmail || !password) throw new Error("Username or password missing");

    const user = await prisma.user.findFirst({
        where: { OR: [{ username: usernameOrEmail }, { email: usernameOrEmail }] },
    });

    if (!user) throw new Error("Invalid credentials");

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) throw new Error("Invalid credentials");

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: JWT_EXPIRES });

    return {
        token,
        user: {
            id: user.id,
            username: user.username,
            displayName: user.displayName,
            email: user.email,
        },
    };
};

// Check availability
exports.checkAvailability = async (field, value) => {
    if (!field || !value) throw new Error("Missing field or value");
    const allowedFields = ["username", "email"];
    if (!allowedFields.includes(field)) throw new Error("Invalid field");

    const exists = await prisma.user.findFirst({
        where: { [field]: { equals: value, mode: "insensitive" } },
    });

    return !exists;
};
