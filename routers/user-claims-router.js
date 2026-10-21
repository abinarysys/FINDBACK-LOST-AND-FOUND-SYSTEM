// Routes for the signed-in user's claim list and individual claim details.

// routers/user-claims-router.js
// Mounted in app.js at /user/claims
const router = require("express").Router();
const authMiddleware = require("../middleware/auth-middleware.js");
const {
  viewClaim,
  listClaims,
} = require("../controllers/user-claims-controller.js");

router.get("/", authMiddleware, listClaims); // /user/claims      (My Claims tab)
router.get("/:id", authMiddleware, viewClaim); // /user/claims/12   (one claim)

module.exports = router;
