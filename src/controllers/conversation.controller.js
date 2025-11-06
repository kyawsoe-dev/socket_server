const conversationService = require("../services/conversation.service");
require('dotenv').config();

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

// Update Group Title
exports.updateGroupTitle = async (req, res) => {
    try {
        const { conversationId } = req.params;
        const { title } = req.body;

        const updatedGroup = await conversationService.updateGroupTitle(
            req.user.id,
            conversationId,
            title
        );

        res.json({ message: "Group title updated", group: updatedGroup });
    } catch (err) {
        res.status(400).json({ error: err.message });
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


// TURN server config
const METERED_API_KEY = process.env.METERED_API_KEY;
const METERED_DOMAIN = process.env.METERED_DOMAIN || "socket-client-w3cc.metered.live";
const EXPIRY_SECONDS = Number(process.env.EXPIRY_SECONDS) || 3600;
const USE_TIME_LIMITED = process.env.USE_TIME_LIMITED !== "false";

const FALLBACK_STUN = [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
];

exports.fetchTurnCredentials = async (req, res) => {
    try {
        if (!METERED_API_KEY) {
            return res.status(500).json({
                status: "error",
                message: "METERED_API_KEY is missing in environment variables",
            });
        }

        const url = `https://${METERED_DOMAIN}/api/v1/turn/credentials?apiKey=${METERED_API_KEY}`;
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`Failed to fetch TURN credentials: ${response.statusText}`);
        }

        const iceServers = await response.json();

        const finalIceServers = iceServers?.length > 1
            ? iceServers
            : FALLBACK_STUN;

        return res.status(200).json({
            status: "success",
            data: {
                iceServers: finalIceServers,
                expirySeconds: EXPIRY_SECONDS,
                useTimeLimited: USE_TIME_LIMITED,
            },
        });
    } catch (error) {
        console.error("Error fetching TURN credentials:", error);
        return res.status(500).json({
            status: "error",
            message: "Failed to fetch TURN credentials",
            details: error.message,
        });
    }
};
