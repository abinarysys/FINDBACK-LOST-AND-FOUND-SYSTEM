// Connects sign-in and registration URLs to their controller and safeguards.

// routes/auth.js   (mounted at /auth)
const router = require("express").Router();
const auth = require("../controllers/secure-auth");
const { ensureCsrf, verifyCsrf } = require("../middleware/csrf");
const { noStore } = require("../middleware/security");
const {uploadPfp, verifyImage,} = require("../middleware/upload-middleware.js");

router.use(noStore, ensureCsrf);

router.get("/login", auth.getLogin);
router.post("/login", auth.loginLimiter, verifyCsrf, auth.login);

router.get("/register", auth.getRegister);
// limiter first (so flooders can't upload), multer parses the form, then CSRF, then the image check
router.post(
  "/register",
  auth.registerLimiter,
  uploadPfp,
  verifyCsrf,
  verifyImage,
  auth.register,
);

router.get("/logout", auth.logout);

module.exports = router;
