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


    async function sendNotification(userId, notification) {
        const dbNotif = await prisma.notification.create({
            data: {
                userId,
                type: notification.type,
                title: notification.title,
                body: notification.body,
                data: notification.data || {},
            },
        });

        const sockets = userSockets.get(userId);
        if (sockets) {
            const payload = {
                id: dbNotif.id,
                type: dbNotif.type,
                title: dbNotif.title,
                body: dbNotif.body,
                data: dbNotif.data,
                read: dbNotif.read,
                timestamp: dbNotif.createdAt.toISOString(),
            };

            sockets.forEach((socketId) => {
                io.to(socketId).emit("notification", payload);
            });
        }

        return dbNotif;
    }

    io.on("connection", async (socket) => {
        const userId = socket.user.id;
        const username = socket.user.displayName || socket.user.username;
        console.log(`Connected: user - ${username} - ${userId}, socket ${socket.id}`);

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

        // SEND MESSAGE + NOTIFY
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

                // NOTIFY OFFLINE/UNREAD MEMBERS
                const members = await prisma.conversationMember.findMany({
                    where: { conversationId: payload.conversationId },
                    select: { userId: true, lastReadAt: true },
                });

                for (const member of members) {
                    if (member.userId === userId) continue;

                    const isUnread = !member.lastReadAt || member.lastReadAt < msg.createdAt;

                    if (isUnread) {
                        sendNotification(member.userId, {
                            type: "NEW_MESSAGE",
                            title: `${username} sent a message`,
                            body: payload.content || "[Media]",
                            conversationId: payload.conversationId,
                            messageId: msg.id,
                            sender: { id: userId, username },
                        });
                    }
                }

                // MENTION DETECTION & NOTIFY
                if (payload.content && payload.type === "TEXT") {
                    const mentionRegex = /@([a-zA-Z0-9_]+)/g;
                    const mentions = [...payload.content.matchAll(mentionRegex)].map(m => m[1]);

                    if (mentions.length > 0) {
                        const mentionedUsers = await prisma.user.findMany({
                            where: { username: { in: mentions } },
                            select: { id: true, username: true },
                        });

                        for (const mu of mentionedUsers) {
                            if (mu.id !== userId) {
                                sendNotification(mu.id, {
                                    type: "MENTION",
                                    title: `${username} mentioned you`,
                                    body: payload.content,
                                    conversationId: payload.conversationId,
                                    messageId: msg.id,
                                });
                            }
                        }
                    }
                }

                if (ack) ack({ success: true, message: publicMsg });
            } catch (err) {
                console.error("Message error:", err);
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
                console.error("Edit message error:", err);
                ack({ success: false, error: "Edit failed" });
            }
        });

        // Delete message
        socket.on("delete message", async ({ messageId }, ack) => {
            try {
                const result = await prisma.message.findUnique({
                    where: { id: Number(messageId) },
                    include: { conversation: true },
                });

                if (!result) return ack({ success: false, error: "Message not found" });
                if (result.senderId !== socket.user.id)
                    return ack({ success: false, error: "Not your message" });

                await prisma.message.delete({ where: { id: Number(messageId) } });

                io.to(`conv_${result.conversationId}`).emit("message deleted", { messageId: result.id });
                ack({ success: true, messageId: result.id });
            } catch (err) {
                console.error("Delete message error:", err);
                ack({ success: false, error: "Delete failed" });
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

        // WebRTC signalling (group)
        ["group-offer", "group-answer", "group-candidate"].forEach((event) => {
            socket.on(`webrtc:${event}`, ({ conversationId, ...data }) => {
                io.to(`conv_${conversationId}`).emit(`webrtc:${event}`, { fromUserId: userId, fromUsername: username, ...data });
            });
        });

        // WebRTC signalling (1:1)
        ["offer", "answer", "candidate", "end"].forEach((event) => {
            socket.on(`webrtc:${event}`, ({ toUserId, ...data }) => {
                const sockets = userSockets.get(toUserId) || new Set();
                sockets.forEach((sid) =>
                    io.to(sid).emit(`webrtc:${event}`, { fromUserId: userId, fromUsername: username, ...data })
                );
            });
        });

        socket.on("webrtc:group-end", ({ conversationId }) => {
            io.to(`conv_${conversationId}`).emit("webrtc:group-end", { fromUserId: userId });
        });

        // Call rejected
        socket.on("callRejected", ({ convId, from }) => {
            console.log(`Call rejected by user ${from} in conversation ${convId}`);
            io.to(`conv_${convId}`).emit("callRejectedNotification", { from });
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