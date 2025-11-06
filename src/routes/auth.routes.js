const express = require("express");
const router = express.Router();
const authController = require("../controllers/auth.controller");

router.post("/register", authController.register);
router.post("/login", authController.login);
router.get("/check", authController.checkAvailability);
router.get('/vapid-public-key', authController.getVapidPublicKey);

module.exports = router;
