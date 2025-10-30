const express = require("express");
const cors = require("cors");
const authRoutes = require("./routes/auth.routes");
const conversationRoutes = require("./routes/conversation.routes");

const app = express();

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
