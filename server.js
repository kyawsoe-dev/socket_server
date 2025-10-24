const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const jwt = require("jsonwebtoken");
const { PrismaClient } = require("@prisma/client");
const cors = require("cors");

const prisma = new PrismaClient();
const authRouter = require("./auth");
const convRouter = require("./conversations");
const JWT_SECRET = process.env.JWT_SECRET || "JWT_SECRET";

const app = express();

app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: "*",
  })
);
app.use(express.json());

app.use("/api/v1/auth", authRouter);
app.use("/api/v1/conversations", convRouter);

app.get("/", (req, res) => {
  res.status(200).json({
    status: res.statusCode,
    message: "Chat server is running successfully!",
    timestamp: new Date().toISOString(),
  });
});

app.use((req, res, next) => {
  res.status(404).json({
    status: res.statusCode,
    message: `Route ${req.originalUrl} not found`,
    timestamp: new Date().toISOString(),
  });
});

app.use((err, req, res, next) => {
  console.error("Internal Server Error:", err.stack || err.message);
  res.status(500).json({
    status: res.statusCode,
    message: "Internal Server Error",
    details: process.env.NODE_ENV === "development" ? err.message : undefined,
    timestamp: new Date().toISOString(),
  });
});

const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    allowedHeaders: "*",
  },
});

const userSockets = new Map();

io.use(async (socket, next) => {
  const token = socket.handshake.auth?.token || socket.handshake.query?.token;
  if (!token) return next(new Error("Auth error: token required"));
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
    });
    if (!user) return next(new Error("Auth error: invalid user"));
    socket.user = user;
    next();
  } catch (err) {
    next(new Error("Auth error"));
  }
});

io.on("connection", (socket) => {
  const userId = socket.user.id;
  console.log("socket connected", socket.id, "user", userId);

  const set = userSockets.get(userId) || new Set();
  set.add(socket.id);
  userSockets.set(userId, set);

  (async () => {
    const memberConvs = await prisma.conversation.findMany({
      where: { members: { some: { userId } } },
      select: { id: true },
    });
    memberConvs.forEach((c) => socket.join(`conv_${c.id}`));
  })();

  // Chat message
  socket.on("chat message", async (payload, ack) => {
    try {
      const msg = await prisma.message.create({
        data: {
          conversationId: payload.conversationId,
          senderId: userId,
          content: payload.content ?? null,
          type: payload.type ?? "TEXT",
          metadata: payload.metadata ?? {},
        },
      });
      await prisma.conversation.update({
        where: { id: payload.conversationId },
        data: { lastMessageId: msg.id, updatedAt: new Date() },
      });
      const publicMsg = {
        id: msg.id,
        uuid: msg.uuid,
        conversationId: msg.conversationId,
        senderId: msg.senderId,
        content: msg.content,
        type: msg.type,
        metadata: msg.metadata,
        createdAt: msg.createdAt,
      };
      io.to(`conv_${payload.conversationId}`).emit("chat message", publicMsg);
      if (ack) ack({ success: true, message: publicMsg });
    } catch (err) {
      console.error("error saving message", err);
      if (ack) ack({ success: false, error: err.message });
    }
  });

  // Typing
  socket.on("typing", (data) => {
    socket.to(`conv_${data.conversationId}`).emit("typing", {
      conversationId: data.conversationId,
      username: socket.user.displayName || socket.user.username,
    });
  });

  // Mark as read
  socket.on("markRead", async ({ conversationId }) => {
    await prisma.conversationMember.updateMany({
      where: { conversationId: Number(conversationId), userId },
      data: { lastReadAt: new Date() },
    });
    io.to(`conv_${conversationId}`).emit("read", {
      conversationId,
      userId,
      lastReadAt: new Date(),
    });
  });

  // WebRTC signaling
  ["offer", "answer", "candidate"].forEach((event) => {
    socket.on(`webrtc:${event}`, ({ toUserId, ...data }) => {
      const sockets = userSockets.get(toUserId) || new Set();
      sockets.forEach((sid) =>
        io.to(sid).emit(`webrtc:${event}`, { fromUserId: userId, ...data })
      );
    });
  });

  // Disconnect
  socket.on("disconnect", () => {
    console.log("disconnect", socket.id);
    const set = userSockets.get(userId);
    if (set) {
      set.delete(socket.id);
      if (set.size === 0) userSockets.delete(userId);
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log("Server listening on", PORT));
