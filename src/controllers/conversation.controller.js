const conversationService = require("../services/conversation.service");

// List conversations
exports.listConversations = async (req, res) => {
    try {
        const data = await conversationService.listConversations(req.user.id, req.query);
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Get single conversation
exports.getConversation = async (req, res) => {
    try {
        const data = await conversationService.getConversation(req.params.id, req.user.id);
        res.json(data);
    } catch (err) {
        res.status(err.status || 500).json({ error: err.message });
    }
};

// Create one-to-one
exports.createOneToOne = async (req, res) => {
    try {
        const data = await conversationService.createOneToOne(req.user.id, req.body.otherUserId);
        res.json(data);
    } catch (err) {
        res.status(err.status || 500).json({ error: err.message });
    }
};

// Create group
exports.createGroup = async (req, res) => {
    try {
        const data = await conversationService.createGroup(req.user.id, req.body);
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Fetch messages
exports.fetchMessages = async (req, res) => {
    try {
        const data = await conversationService.fetchMessages(req.params.conversationId, req.query);
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Send message
exports.sendMessage = async (req, res) => {
    try {
        const data = await conversationService.sendMessage(req.user.id, req.params.conversationId, req.body);
        res.status(201).json(data);
    } catch (err) {
        res.status(err.status || 500).json({ error: err.message });
    }
};

// Edit message
exports.editMessage = async (req, res) => {
    try {
        const data = await conversationService.editMessage(req.user.id, req.params.messageId, req.body);
        res.json(data);
    } catch (err) {
        res.status(err.status || 500).json({ error: err.message });
    }
};

// Delete Message
exports.deleteMessage = async (req, res) => {
    try {
        const userId = req.user.id;
        const { messageId } = req.params;

        const data = await conversationService.deleteMessage(userId, messageId);
        res.json({ success: true, data });
    } catch (err) {
        console.error("Delete message error:", err);
        res.status(err.status || 500).json({ success: false, error: err.message });
    }
};

// Add member
exports.addMember = async (req, res) => {
    try {
        const data = await conversationService.addMember(req.user.id, req.params.conversationId, req.body.userId);
        res.json(data);
    } catch (err) {
        res.status(err.status || 500).json({ error: err.message });
    }
};

// Remove member
exports.removeMember = async (req, res) => {
    try {
        const data = await conversationService.removeMember(req.user.id, req.params.conversationId, req.params.userId);
        res.json(data);
    } catch (err) {
        res.status(err.status || 500).json({ error: err.message });
    }
};

// Search users
exports.searchUser = async (req, res) => {
    try {
        const data = await conversationService.searchUser(req.user.id, req.query.query);
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Suggested users
exports.suggestedUsers = async (req, res) => {
    try {
        const data = await conversationService.suggestedUsers(req.user.id);
        res.json(data);
    } catch (err) {
        console.log(err, "error")
        res.status(500).json({ error: err.message });
    }
};

// Details user
exports.getUserDetails = async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const userId = req.params.userId;

    const data = await conversationService.getUserDetails(currentUserId, userId);
    res.json({ success: true, data });
  } catch (err) {
    console.error("Get user details error:", err);
    res.status(err.status || 500).json({ success: false, error: err.message });
  }
};