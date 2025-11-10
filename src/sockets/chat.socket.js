const jwt = require("jsonwebtoken");
const prisma = require("../config/prisma");
const { sendToSubscriber } = require('../services/webpushr.service');


const JWT_SECRET = process.env.JWT_SECRET || "JWT_SECRET";

// Keep online tracking
const userSockets = new Map();
const onlineUsers = new Map();


const webpush = require('web-push');
const vapidKeys = {
    publicKey: process.env.VAPID_PUBLIC_KEY,
    privateKey: process.env.VAPID_PRIVATE_KEY
};

webpush.setVapidDetails(
    `mailto:${process.env.VAPID_EMAIL || 'kyawsoedeveloper@gmail.com'}`,
    vapidKeys.publicKey,
    vapidKeys.privateKey
);

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

                const conv = await prisma.conversation.findUnique({
                    where: { id: payload.conversationId },
                    include: { members: { include: { user: true } } },
                });

                if (!conv || !conv.members) return;

                for (const member of conv.members) {
                    if (!member.user || member.userId === userId) continue;

                    const recipientId = member.userId;
                    const sub = member.user.pushSubscription;

                    if (!onlineUsers.has(recipientId)) {
                        if (sub) {
                            try {
                                await webpush.sendNotification(
                                    sub,
                                    JSON.stringify({
                                        title: conv.isGroup
                                            ? `${socket.user.username} in ${conv.title || "Group"}`
                                            : `${socket.user.username}`,
                                        body: publicMsg.content || "(Attachment)",
                                        data: {
                                            conversationId: publicMsg.conversationId,
                                            isGroup: !!conv.isGroup,
                                        },
                                    }),
                                    { TTL: 3600 }
                                );
                            } catch (pushErr) {
                                console.error("Local push error:", pushErr);
                            }
                        } else if (member.user.webpushrSid) {

                            console.log(publicMsg, "-------------------webpushr-------------------");
                            
                            try {
                                await sendToSubscriber({
                                    sid: member.user.webpushrSid,
                                    title: conv.isGroup
                                        ? `${socket.user.username} in ${conv.title || "Group"}`
                                        : `${socket.user.username}`,
                                    message: publicMsg.content || "(Attachment)",
                                    target_url: `${process.env.APP_URL}/conversations/${publicMsg.conversationId}`,
                                });
                            } catch (pushErr) {
                                console.error("Webpushr push error:", pushErr);
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


        // Push subscription
        socket.on('subscribe push', async (subscription) => {
            try {
                await prisma.user.update({
                    where: { id: userId },
                    data: { pushSubscription: subscription }
                });
                console.log('Native push saved for', userId);
            } catch (e) {
                console.error('Native push save error', e);
            }
        });
        
        // Webpushr SID subscription
        socket.on('subscribe webpushr', async ({ sid }) => {
            try {
                await prisma.user.update({
                    where: { id: userId },
                    data: { webpushrSid: sid }
                });
                console.log(`Saved Webpushr SID for user ${userId}`);
            } catch (err) {
                console.error('Webpushr SID save error:', err);
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

        // WebRTC signalling

        ["group-offer", "group-answer", "group-candidate"].forEach((event) => {
            socket.on(`webrtc:${event}`, ({ conversationId, ...data }) => {
                io.to(`conv_${conversationId}`).emit(`webrtc:${event}`, { fromUserId: userId, fromUsername: username, ...data });
            });
        });

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