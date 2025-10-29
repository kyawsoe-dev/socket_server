const prisma = require("../config/prisma");

// List Conversations
exports.listConversations = async (userId, { page = 1, limit = 20 }) => {
    page = parseInt(page);
    limit = parseInt(limit);
    const skip = (page - 1) * limit;

    const total = await prisma.conversation.count({
        where: { members: { some: { userId } } },
    });

    const data = await prisma.conversation.findMany({
        where: { members: { some: { userId } } },
        include: {
            members: {
                include: {
                    user: {
                        select: { id: true, username: true, email: true, displayName: true },
                    },
                },
            },
            lastMessage: true,
        },
        orderBy: { updatedAt: "desc" },
        skip,
        take: limit,
    });

    return { page, limit, total, totalPages: Math.ceil(total / limit), data };
};

// Get Conversation
exports.getConversation = async (conversationId, userId) => {
    const conv = await prisma.conversation.findUnique({
        where: { id: Number(conversationId) },
        include: {
            members: { include: { user: true } },
            lastMessage: true,
        },
    });

    if (!conv) throw { status: 404, message: "Conversation not found" };
    if (!conv.members.some((m) => m.userId === userId))
        throw { status: 403, message: "Not authorized" };

    return conv;
};

// Create One-to-One
exports.createOneToOne = async (userId, otherUserId) => {
    if (!otherUserId) throw { status: 400, message: "Missing otherUserId" };

    const conv = await prisma.conversation.findFirst({
        where: {
            isGroup: false,
            members: { some: { userId: otherUserId } },
        },
        include: { members: true },
    });

    if (conv) {
        const ids = conv.members.map((m) => m.userId);
        if (ids.includes(userId) && ids.includes(Number(otherUserId))) return conv;
    }

    return prisma.conversation.create({
        data: {
            isGroup: false,
            members: {
                create: [
                    { user: { connect: { id: userId } }, role: "MEMBER" },
                    { user: { connect: { id: Number(otherUserId) } }, role: "MEMBER" },
                ],
            },
        },
        include: { members: { include: { user: true } } },
    });
};

// Create Group
exports.createGroup = async (creatorId, { title, memberIds }) => {
    const members = (memberIds || []).map((id) => ({
        user: { connect: { id } },
        role: id === creatorId ? "OWNER" : "MEMBER",
    }));

    if (!memberIds?.includes(creatorId))
        members.push({ user: { connect: { id: creatorId } }, role: "OWNER" });

    return prisma.conversation.create({
        data: { isGroup: true, title, members: { create: members } },
        include: { members: true },
    });
};

// Fetch Messages
exports.fetchMessages = async (conversationId, { cursor, limit = 30 }) => {
    const where = { conversationId: Number(conversationId) };
    const messages = await prisma.message.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: Number(limit),
        skip: cursor ? 1 : 0,
        cursor: cursor ? { id: Number(cursor) } : undefined,
    });
    return messages.reverse();
};

// Send Message
exports.sendMessage = async (userId, conversationId, { content, type = "TEXT", metadata }) => {
    if (!content && type === "TEXT") throw { status: 400, message: "Content required" };

    const conversation = await prisma.conversation.findFirst({
        where: { id: Number(conversationId), members: { some: { userId } } },
    });

    if (!conversation)
        throw { status: 404, message: "Conversation not found or not a member" };

    const message = await prisma.message.create({
        data: {
            conversation: { connect: { id: Number(conversationId) } },
            sender: { connect: { id: userId } },
            content,
            type,
            metadata,
        },
    });

    await prisma.conversation.update({
        where: { id: Number(conversationId) },
        data: { lastMessage: { connect: { id: message.id } } },
    });

    return message;
};

// Edit Message
exports.editMessage = async (userId, messageId, { content }) => {
    console.log(userId, messageId, content, "eidt serveic")
    const msg = await prisma.message.findUnique({
        where: { id: Number(messageId) },
    });

    if (!msg) throw { status: 404, message: "Message not found" };
    if (msg.senderId !== userId) throw { status: 403, message: "Not your message" };

    return prisma.message.update({
        where: { id: Number(messageId) },
        data: { content, updatedAt: new Date() },
    });
};

// Delete Message
exports.deleteMessage = async (userId, messageId) => {
    const msg = await prisma.message.findUnique({
        where: { id: Number(messageId) },
        include: { conversation: true },
    });

    if (!msg) throw { status: 404, message: "Message not found" };
    if (msg.senderId !== userId) throw { status: 403, message: "Not your message" };

    await prisma.message.delete({ where: { id: Number(messageId) } });

    return { success: true, message: "Message deleted", messageId: msg.id, conversationId: msg.conversationId };
};


// Add Member
exports.addMember = async (ownerId, conversationId, userIdToAdd) => {
    const conv = await prisma.conversation.findUnique({
        where: { id: Number(conversationId) },
        include: { members: true },
    });

    if (!conv || !conv.isGroup) throw { status: 404, message: "Group not found" };

    const isOwner = conv.members.some((m) => m.userId === ownerId && m.role === "OWNER");
    if (!isOwner) throw { status: 403, message: "Only owner can add members" };

    if (conv.members.some((m) => m.userId === Number(userIdToAdd)))
        throw { status: 400, message: "Already a member" };

    const newMember = await prisma.conversationMember.create({
        data: {
            conversationId: conv.id,
            userId: Number(userIdToAdd),
            role: "MEMBER",
        },
        include: { user: true },
    });

    const updatedConv = await prisma.conversation.findUnique({
        where: { id: conv.id },
        include: { members: { include: { user: true } } },
    });

    return { message: "Member added", member: newMember, conversation: updatedConv };
};

// Remove Member
exports.removeMember = async (ownerId, conversationId, targetUserId) => {
    const conv = await prisma.conversation.findUnique({
        where: { id: Number(conversationId) },
        include: { members: true },
    });

    if (!conv || !conv.isGroup) throw { status: 404, message: "Group not found" };

    const isOwner = conv.members.some((m) => m.userId === ownerId && m.role === "OWNER");
    if (!isOwner) throw { status: 403, message: "Only owner can remove members" };
    if (Number(targetUserId) === ownerId) throw { status: 400, message: "Cannot remove self" };

    await prisma.conversationMember.deleteMany({
        where: { conversationId: conv.id, userId: Number(targetUserId) },
    });

    return { success: true };
};

// Search User
exports.searchUser = async (userId, query) => {
    if (!query) throw new Error("Query required");
    return prisma.user.findMany({
        where: {
            OR: [
                { username: { contains: query, mode: "insensitive" } },
                { displayName: { contains: query, mode: "insensitive" } },
            ],
            NOT: { id: userId },
        },
        select: { id: true, username: true, displayName: true },
        take: 10,
    });
};

// Suggested Users
exports.suggestedUsers = async (userId) => {
    const memberConvs = await prisma.conversationMember.findMany({
        where: { userId },
        select: { conversationId: true },
    });

    const conversationIds = memberConvs.map((c) => c.conversationId);

    const existingUsers = await prisma.conversationMember.findMany({
        where: {
            conversationId: { in: conversationIds },
            NOT: { userId },
        },
        select: { userId: true },
    });

    const excluded = Array.from(new Set(existingUsers.map((u) => u.userId)));
    excluded.push(userId);

    const validExcluded = excluded.filter((id) => typeof id === "number" && !isNaN(id));

    return prisma.user.findMany({
        where: {
            id: { notIn: validExcluded.length > 0 ? validExcluded : [userId] },
        },
        select: {
            id: true,
            username: true,
            displayName: true,
        },
        take: 5,
        orderBy: { createdAt: "desc" },
    });
};



// Details user
exports.getUserDetails = async (currentUserId, userId) => {
    if (!userId) throw { status: 400, message: "User ID required" };

    const user = await prisma.user.findUnique({
        where: { id: Number(userId) },
        select: {
            id: true,
            username: true,
            displayName: true,
            email: true,
            createdAt: true,
            updatedAt: true,
            members: {
                select: {
                    lastReadAt: true,
                    conversation: {
                        select: { id: true, title: true, isGroup: true },
                    },
                },
            },
            messages: {
                select: { createdAt: true },
                orderBy: { createdAt: "desc" },
                take: 1,
            },
        },
    });

    if (!user) throw { status: 404, message: "User not found" };

    let lastActive = null;
    if (user.messages.length > 0) {
        lastActive = user.messages[0].createdAt;
    } else if (user.members.length > 0) {
        lastActive = user.members
            .map((m) => m.lastReadAt)
            .filter(Boolean)
            .sort((a, b) => b - a)[0];
    }

    return {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        email: user.email,
        lastActive,
    };
};
