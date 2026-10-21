// Routes for chat pages and the conversation and message APIs.

// routers/userchat-router.js  (mounted in app.js at /user/chat)
const router = require("express").Router();
const authMiddleware = require("../middleware/auth-middleware.js");
const chat = require("../controllers/user-chat-controller.js");

// For fetch() calls: answer with JSON 401 instead of redirecting to the login page.
const apiAuth = (req, res, next) => {
  if (!req.session?.user) {
    return res
      .status(401)
      .json({ success: false, message: "Please log in first." });
  }
  next();
};

// pages
router.get("/", authMiddleware, chat.getChatPage);
router.get("/start/:type/:id", authMiddleware, chat.startConversation);

// JSON API used by public/js/chat.js
router.get("/api/conversations", apiAuth, chat.listConversations);
router.get("/api/unread-count", apiAuth, chat.unreadCount);
router.get("/api/conversations/:id/messages", apiAuth, chat.getMessages);
router.post("/api/conversations/:id/messages", apiAuth, chat.sendMessage);
router.post("/api/conversations/:id/read", apiAuth, chat.markRead);

module.exports = router;
