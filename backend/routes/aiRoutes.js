const router = require("express").Router();
const ctrl = require("../controllers/aiController");
const requireAuth = require("../middlewares/auth");
const conversations = require("../controllers/aiConversationController");

router.post("/analyze", requireAuth, ctrl.analyze);
router.get("/conversations", requireAuth, conversations.list);
router.post("/conversations", requireAuth, conversations.create);
router.get("/conversations/:conversationId", requireAuth, conversations.get);
router.patch("/conversations/:conversationId", requireAuth, conversations.rename);
router.delete("/conversations/:conversationId", requireAuth, conversations.remove);
router.get("/conversations/:conversationId/messages", requireAuth, conversations.messages);
router.post("/conversations/:conversationId/messages", requireAuth, conversations.send);
router.get("/attachments/:attachmentId/content", requireAuth, conversations.content);

module.exports = router;
