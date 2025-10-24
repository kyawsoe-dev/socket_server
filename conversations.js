const express = require("express");
const router = express.Router();
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const auth = require("./middleware/auth");

// list conversations for user
router.get("/", auth, async (req, res) => {
  const convs = await prisma.conversation.findMany({
    where: { members: { some: { userId: req.user.id } } },
    include: {
      members: { include: { user: true } },
      lastMessage: true,
    },
    orderBy: { updatedAt: "desc" },
  });
  res.json(convs);
});

// create 1:1 conversation
router.post("/one-to-one", auth, async (req, res) => {
  const { otherUserId } = req.body;
  if (!otherUserId) {
    return res.status(400).json({
      status: "error",
      message: "Missing required field: otherUserId",
    });
  }

  const userId = req.user.id;

  const conv = await prisma.conversation.findFirst({
    where: {
      isGroup: false,
      members: {
        some: {
          userId: otherUserId,
        },
      },
    },
    include: { members: true },
  });

  if (conv) {
    const ids = conv.members.map((m) => m.userId);
    if (ids.includes(userId) && ids.includes(otherUserId))
      return res.json(conv);
  }

  const newConv = await prisma.conversation.create({
    data: {
      isGroup: false,
      members: {
        create: [
          { user: { connect: { id: userId } }, role: "MEMBER" },
          { user: { connect: { id: otherUserId } }, role: "MEMBER" },
        ],
      },
    },
    include: { members: true },
  });
  res.json(newConv);
});

// create group
router.post("/group", auth, async (req, res) => {
  const { title, memberIds } = req.body;
  const creatorId = req.user.id;
  const memberData = (memberIds || []).map((id) => ({
    user: { connect: { id } },
    role: id === creatorId ? "OWNER" : "MEMBER",
  }));
  if (!memberIds || !memberIds.includes(creatorId))
    memberData.push({ user: { connect: { id: creatorId } }, role: "OWNER" });

  const group = await prisma.conversation.create({
    data: { isGroup: true, title, members: { create: memberData } },
    include: { members: true },
  });
  res.json(group);
});

// fetch messages
router.get("/:conversationId/messages", auth, async (req, res) => {
  const { conversationId } = req.params;
  const { cursor, limit = 30 } = req.query;
  const where = { conversationId: Number(conversationId) };
  const messages = await prisma.message.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: Number(limit),
    skip: cursor ? 1 : 0,
    cursor: cursor ? { id: Number(cursor) } : undefined,
  });
  res.json(messages.reverse());
});

// send message
router.post("/:conversationId/messages", auth, async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { content, type = "TEXT", metadata } = req.body;
    const senderId = req.user.id;

    if (!content && type === "TEXT") {
      return res.status(400).json({
        status: "error",
        message: "Message content is required for text messages",
      });
    }

    const conversation = await prisma.conversation.findFirst({
      where: {
        id: Number(conversationId),
        members: { some: { userId: senderId } },
      },
    });

    if (!conversation) {
      return res.status(404).json({
        status: "error",
        message: "Conversation not found or you are not a member",
      });
    }

    const message = await prisma.message.create({
      data: {
        conversation: { connect: { id: Number(conversationId) } },
        sender: { connect: { id: senderId } },
        content,
        type,
        metadata,
      },
    });

    await prisma.conversation.update({
      where: { id: Number(conversationId) },
      data: { lastMessage: { connect: { id: message.id } } },
    });

    res.status(201).json(message);
  } catch (err) {
    console.error("Send message error:", err);
    res.status(500).json({ status: "error", message: "Internal Server Error" });
  }
});

// search user
router.get("/users/search", auth, async (req, res) => {
  const { query } = req.query;
  if (!query) return res.status(400).json({ error: "Query required" });
  try {
    const users = await prisma.user.findMany({
      where: {
        OR: [
          { username: { contains: query, mode: "insensitive" } },
          { displayName: { contains: query, mode: "insensitive" } },
        ],
        NOT: { id: req.user.id },
      },
      select: { id: true, username: true, displayName: true },
      take: 10,
    });
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: "Search failed" });
  }
});

module.exports = router;
