// Route for submitting feedback from a signed-in user.

// Set up the route and database connection.
const router = require("express").Router();
const db = require("../config/db.js");

// Feedback is accepted only from a signed-in user.
const authMiddleware = require("../middleware/auth-middleware.js");

// Save the feedback form submitted from the landing page.
router.post("/feedback", authMiddleware, (req, res) => {
  const { rate, msg } = req.body;

  // Confirm the session still contains a signed-in user.
  if (!req.session.user) {
    req.flash("error", "Please log in to submit feedback.");
    return res.redirect("/auth/login");
  }

  // Use the account ID from the session, not the submitted form.
  const userId = req.session.user.user_id;

  // Store the rating and message with the user's account ID.
  const giveFeedback = `INSERT INTO feedback (user_id, rating, message) VALUES (?, ?, ?)`;
  db.query(giveFeedback, [userId, rate, msg], (err) => {
    if (err) {
      console.log("Feedback error:", err);
      req.flash("error", "Feedback failed");
      return res.redirect("/");
    }
    req.flash("success", "Feedback Succeeded");
    return res.redirect("/");
  });
});

// Let the main app mount these feedback routes.
module.exports = router;
