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
