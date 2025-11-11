const notificationService = require("../services/notification.service");

exports.getAll = async (req, res) => {
    try {
        const notifications = await notificationService.getAll(req.user.id);
        res.json(notifications);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
};

exports.getUnread = async (req, res) => {
    try {
        const notifications = await notificationService.getUnread(req.user.id);
        res.json(notifications);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
};

exports.getUnreadCount = async (req, res) => {
    try {
        const count = await notificationService.getUnreadCount(req.user.id);
        res.json({ count });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
};

exports.markAsRead = async (req, res) => {
    try {
        const { id } = req.params;
        await notificationService.markAsRead(req.user.id, Number(id));
        res.json({ success: true });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
};

exports.markAllAsRead = async (req, res) => {
    try {
        await notificationService.markAllAsRead(req.user.id);
        res.json({ success: true });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
};