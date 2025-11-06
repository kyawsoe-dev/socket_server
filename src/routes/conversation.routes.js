const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const conversationController = require("../controllers/conversation.controller");

router.get("/", auth, conversationController.listConversations);
router.get("/:id", auth, conversationController.getConversation);
router.post("/one-to-one", auth, conversationController.createOneToOne);
router.post("/group", auth, conversationController.createGroup);
router.patch("/group/:conversationId/title", auth, conversationController.updateGroupTitle);
router.get("/:conversationId/messages", auth, conversationController.fetchMessages);
router.post("/:conversationId/messages", auth, conversationController.sendMessage);
router.put("/messages/:messageId", auth, conversationController.editMessage);
router.delete("/messages/:messageId", auth, conversationController.deleteMessage);
router.post("/:conversationId/members", auth, conversationController.addMember);
router.delete("/:conversationId/members/:userId", auth, conversationController.removeMember);
router.get("/users/search", auth, conversationController.searchUser);
router.get("/users/suggested", auth, conversationController.suggestedUsers);
router.get("/users/:userId", auth, conversationController.getUserDetails);

module.exports = router;
