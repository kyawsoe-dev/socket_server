const authService = require("../services/auth.service");

exports.register = async (req, res) => {
    try {
        const data = await authService.register(req.body);
        res.status(201).json(data);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
};

exports.login = async (req, res) => {
    try {
        const data = await authService.login(req.body);
        res.json(data);
    } catch (err) {
        res.status(401).json({ error: err.message });
    }
};

exports.checkAvailability = async (req, res) => {
    try {
        const { field, value } = req.query;
        const available = await authService.checkAvailability(field, value);
        res.json({ available });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
};


exports.getVapidPublicKey = (req, res) => {
    const key = process.env.VAPID_PUBLIC_KEY;
    if (!key) return res.status(500).json({ error: "VAPID key missing" });
    res.json({ publicKey: key });
};