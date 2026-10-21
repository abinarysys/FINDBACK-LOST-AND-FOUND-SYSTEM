// Sends visitors without a signed-in session to the login page.

// Protects a page or action that requires a signed-in user.
// Input: the Express request/session. Output: continue when signed in, otherwise redirect.
module.exports = (req, res, next) => {
  if (!req.session.user) {
    req.flash("error", "Please login first");
    return res.redirect("/auth/login");
  }

  next();
};
