// Routes for changing appearance settings and requesting account deletion.

// routers/usersettings-router.js
// Mounted in app.js at /user/settings
const argon2 = require("argon2");
const crypto = require("crypto");
const { verifyPassword } = require("../config/password.js");
const router = require("express").Router();
const query = require("../config/query.js");
const authMiddleware = require("../middleware/auth-middleware.js");
const {
  ACCENTS,
  DEFAULT_THEME,
  isMode,
  isAccent,
  sanitize,
} = require("../config/theme.js");

// For fetch() calls: answer 401 JSON instead of redirecting to the login page.
const apiAuth = (req, res, next) =>
  req.session?.user?.user_id
    ? next()
    : res.status(401).json({ success: false, message: "Please log in." });

// Settings page
router.get("/", authMiddleware, (req, res) => {
  res.render("user/settings", {
    user: req.session.user,
    accents: ACCENTS,
    theme: req.session.user.theme || DEFAULT_THEME,
  });
});

// Save appearance. The user id ALWAYS comes from the session, never from the request body.
router.post("/theme", apiAuth, async (req, res) => {
  const { mode, color } = req.body || {};

  if (!isMode(mode) || !isAccent(color)) {
    return res.status(400).json({ success: false, message: "Invalid theme." });
  }

  const theme = sanitize({ mode, color });

  try {
    await query(
      "UPDATE users SET theme_mode = ?, theme_color = ? WHERE user_id = ?",
      [theme.mode, theme.color, req.session.user.user_id],
    );
    req.session.user.theme = theme; // next page load already uses it
    res.json({ success: true, theme });
  } catch (error) {
    console.error("Error saving theme:", error);
    res.status(500).json({
      success: false,
      message: "Unable to save your appearance settings.",
    });
  }
});

/* Show delete-profile confirmation page */
router.get("/delete-account", authMiddleware, (req, res) => {
  res.render("user/delete-account", {
    user: req.session.user,
  });
});

/* Verify password and anonymize the account */
router.post("/delete-account", authMiddleware, async (req, res) => {
  const userId = req.session.user.user_id;
  const password = req.body.password;

  if (typeof password !== "string" || !password) {
    return res.status(400).render("user/delete-account", {
      user: req.session.user,
      error: "Please enter your password.",
    });
  }

  try {
    const users = await query(
      "SELECT password_hash FROM users WHERE user_id = ? LIMIT 1",
      [userId],
    );

    if (!users.length) {
      return res.status(404).send("Account not found.");
    }

    const result = await verifyPassword(password, users[0].password_hash);

    if (!result.ok) {
      return res.status(400).render("user/delete-account", {
        user: req.session.user,
        error: "Incorrect password. Your account has not been changed.",
      });
    }

    // Generate credentials that the account owner does not know.
    const randomPassword = crypto.randomBytes(48).toString("hex");
    const passwordHash = await argon2.hash(randomPassword);

    await query(
      `UPDATE users
             SET full_name = ?,
                 email = ?,
                 password_hash = ?,
                 profile_image = NULL,
                 contact_number = ''
             WHERE user_id = ?`,
      [
        "Deleted User",
        `deleted-${userId}@deleted.invalid`,
        passwordHash,
        userId,
      ],
    );

    // End the session only after the database update succeeds.
    req.session.destroy((err) => {
      if (err) {
        console.error("Session destruction error:", err);
        return res
          .status(500)
          .send(
            "Your account was anonymized, but logout failed. Please close your browser session.",
          );
      }

      res.clearCookie("connect.sid");
      return res.redirect("/");
    });
  } catch (error) {
    console.error("Delete profile error:", error);

    return res.status(500).render("user/delete-account", {
      user: req.session.user,
      error: "Unable to process your request. Please try again.",
    });
  }
});

module.exports = router;
