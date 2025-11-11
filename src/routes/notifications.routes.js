const express = require("express");
const router = express.Router();
const notificationController = require("../controllers/notification.controller");
const authenticate = require("../middleware/auth");
router.use(authenticate);

router.get("/", notificationController.getAll);
router.get("/unread", notificationController.getUnread);
router.get("/unread/count", notificationController.getUnreadCount);
router.post("/:id/read", notificationController.markAsRead);
router.post("/read-all", notificationController.markAllAsRead);

module.exports = router;