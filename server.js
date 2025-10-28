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
    status: 200,
    message: "Chat server is running!",
    timestamp: new Date().toISOString(),
  });
});

app.use((req, res) => {
  res
    .status(404)
    .json({ status: 404, message: `Route ${req.originalUrl} not found` });
});

app.use((err, req, res, next) => {
  console.error("Error:", err.stack || err.message);
  res.status(500).json({
    status: 500,
    message: "Internal Server Error",
    details: process.env.NODE_ENV === "development" ? err.message : undefined,
  });
});

const server = http.createServer(app);
const io = socketIo(server, {
  cors: { origin: "*", methods: ["GET", "POST"], allowedHeaders: "*" },
});

// Presence tracking
const userSockets = new Map();
const onlineUsers = new Map();

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
  console.log("Connected:", socket.id, "User:", userId);

  // Online tracking
  const onlineSet = onlineUsers.get(userId) || new Set();
  onlineSet.add(socket.id);
  onlineUsers.set(userId, onlineSet);
  socket.broadcast.emit("user online", { userId });

  // Current online users
  const onlineIds = Array.from(onlineUsers.keys());
  socket.emit("users online", onlineIds);

  // Room routing (existing)
  const roomSet = userSockets.get(userId) || new Set();
  roomSet.add(socket.id);
  userSockets.set(userId, roomSet);

  // Join conversation rooms
  (async () => {
    const convs = await prisma.conversation.findMany({
      where: { members: { some: { userId } } },
      select: { id: true },
    });
    convs.forEach((c) => socket.join(`conv_${c.id}`));
  })();

  // Events
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
      console.error("Message error:", err);
      if (ack) ack({ success: false, error: err.message });
    }
  });

  socket.on("edit message", async ({ messageId, content }, ack) => {
    try {
      const msg = await prisma.message.findUnique({
        where: { id: messageId },
        include: { conversation: true },
      });
      if (!msg) return ack({ success: false, error: "Message not found" });
      if (msg.senderId !== userId)
        return ack({ success: false, error: "Not your message" });
      const updated = await prisma.message.update({
        where: { id: messageId },
        data: { content, updatedAt: new Date() },
      });
      io.to(`conv_${msg.conversationId}`).emit("message edited", updated);
      ack({ success: true, message: updated });
    } catch (err) {
      console.error("Edit message error:", err);
      ack({ success: false, error: "Edit failed" });
    }
  });

  socket.on("typing", (data) => {
    socket.to(`conv_${data.conversationId}`).emit("typing", {
      conversationId: data.conversationId,
      username: socket.user.displayName || socket.user.username,
    });
  });

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

  ["offer", "answer", "candidate"].forEach((event) => {
    socket.on(`webrtc:${event}`, ({ toUserId, ...data }) => {
      const sockets = userSockets.get(toUserId) || new Set();
      sockets.forEach((sid) =>
        io.to(sid).emit(`webrtc:${event}`, { fromUserId: userId, ...data })
      );
    });
  });

  socket.on("disconnect", () => {
    console.log("Disconnected:", socket.id);

    // Remove from room map
    const roomSet = userSockets.get(userId);
    if (roomSet) {
      roomSet.delete(socket.id);
      if (roomSet.size === 0) userSockets.delete(userId);
    }

    // Remove from online map
    const onlineSet = onlineUsers.get(userId);
    if (onlineSet) {
      onlineSet.delete(socket.id);
      if (onlineSet.size === 0) {
        onlineUsers.delete(userId);
        socket.broadcast.emit("user offline", { userId });
      }
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
