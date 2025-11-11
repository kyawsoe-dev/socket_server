const express = require("express");
const router = express.Router();
const conversationController = require("../controllers/conversation.controller");
const authenticate = require("../middleware/auth"); 
router.use(authenticate);

router.get("/", conversationController.listConversations);
router.get("/:id", conversationController.getConversation);
router.post("/one-to-one", conversationController.createOneToOne);
router.post("/group", conversationController.createGroup);
router.patch("/group/:conversationId/title", conversationController.updateGroupTitle);
router.get("/:conversationId/messages", conversationController.fetchMessages);
router.post("/:conversationId/messages", conversationController.sendMessage);
router.put("/messages/:messageId", conversationController.editMessage);
router.delete("/messages/:messageId", conversationController.deleteMessage);
router.post("/:conversationId/members", conversationController.addMember);
router.delete("/:conversationId/members/:userId", conversationController.removeMember);
router.get("/users/search", conversationController.searchUser);
router.get("/users/suggested", conversationController.suggestedUsers);
router.get("/users/:userId", conversationController.getUserDetails);

module.exports = router;