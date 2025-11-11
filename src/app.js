const express = require("express");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const authRoutes = require("./routes/auth.routes");
const conversationRoutes = require("./routes/conversation.routes");
const notificationRoutes = require("./routes/notifications.routes");
const RATE_LIMIT_MAX = process.env.RATE_LIMIT_MAX || 100;

const app = express();

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: RATE_LIMIT_MAX,
    message: "Too many requests, please try again later.",
});

app.use(limiter);
app.use(
    cors({
        origin: "*",
        methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
        allowedHeaders: "*",
    })
);
app.use(express.json());

app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/conversations", conversationRoutes);
app.use("/api/v1/notifications", notificationRoutes);

app.get("/", (req, res) => {
    res.status(200).json({
        status: 200,
        message: "Chat server is running!",
        timestamp: new Date().toISOString(),
    });
});

app.use((req, res) => {
    res.status(404).json({ status: 404, message: `Route ${req.originalUrl} not found` });
});

app.use((err, req, res, next) => {
    console.error("Error:", err.stack || err.message);
    res.status(500).json({
        status: 500,
        message: "Internal Server Error",
        details: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
});

module.exports = app;