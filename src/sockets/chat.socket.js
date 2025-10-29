const jwt = require("jsonwebtoken");
const prisma = require("../config/prisma");

const JWT_SECRET = process.env.JWT_SECRET || "JWT_SECRET";

// Keep online tracking
const userSockets = new Map();
const onlineUsers = new Map();

function setupChatSocket(io) {
    io.use(async (socket, next) => {
        const token = socket.handshake.auth?.token || socket.handshake.query?.token;
        if (!token) return next(new Error("Auth error: token required"));
        try {
            const payload = jwt.verify(token, JWT_SECRET);
            const user = await prisma.user.findUnique({ where: { id: payload.userId } });
            if (!user) return next(new Error("Auth error: invalid user"));
            socket.user = user;
            next();
        } catch {
            next(new Error("Auth error"));
        }
    });

    io.on("connection", async (socket) => {
        const userId = socket.user.id;
        console.log(`Connected: user ${userId}, socket ${socket.id}`);

        // Track connections
        const socketSet = userSockets.get(userId) || new Set();
        socketSet.add(socket.id);
        userSockets.set(userId, socketSet);

        const onlineSet = onlineUsers.get(userId) || new Set();
        onlineSet.add(socket.id);
        onlineUsers.set(userId, onlineSet);
        socket.broadcast.emit("user online", { userId });
        socket.emit("users online", Array.from(onlineUsers.keys()));

        // Join all conversation rooms
        const convs = await prisma.conversation.findMany({
            where: { members: { some: { userId } } },
            select: { id: true },
        });
        convs.forEach((c) => socket.join(`conv_${c.id}`));

        // Send message
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
                console.error("💥 Message error:", err);
                if (ack) ack({ success: false, error: err.message });
            }
        });

        // Edit message
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
                console.error("💥 Edit message error:", err);
                ack({ success: false, error: "Edit failed" });
            }
        });

        // Typing indicator
        socket.on("typing", (data) => {
            socket.to(`conv_${data.conversationId}`).emit("typing", {
                conversationId: data.conversationId,
                username: socket.user.displayName || socket.user.username,
            });
        });

        // Mark messages as read
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

        // WebRTC signalling
        ["offer", "answer", "candidate"].forEach((event) => {
            socket.on(`webrtc:${event}`, ({ toUserId, ...data }) => {
                const sockets = userSockets.get(toUserId) || new Set();
                sockets.forEach((sid) =>
                    io.to(sid).emit(`webrtc:${event}`, { fromUserId: userId, ...data })
                );
            });
        });

        // Disconnect cleanup
        socket.on("disconnect", () => {
            console.log(`Disconnected: user ${userId}, socket ${socket.id}`);
            const sSet = userSockets.get(userId);
            if (sSet) {
                sSet.delete(socket.id);
                if (sSet.size === 0) userSockets.delete(userId);
            }

            const oSet = onlineUsers.get(userId);
            if (oSet) {
                oSet.delete(socket.id);
                if (oSet.size === 0) {
                    onlineUsers.delete(userId);
                    socket.broadcast.emit("user offline", { userId });
                }
            }
        });
    });
}

module.exports = { setupChatSocket };
