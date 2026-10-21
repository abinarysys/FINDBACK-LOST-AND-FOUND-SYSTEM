// Copies the current session user into the locals used by EJS templates.

// Makes the current session user available to EJS templates as `user`.
// Guests receive null, so shared navigation can render either account state.
module.exports = (req, res, next) => {
  res.locals.user = req.session.user || null;
  next();
};
