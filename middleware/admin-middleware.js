// Adds admin-only view helpers and checks that the admin account is still active.

// middleware/admin-middleware.js
const query = require("../config/query");
const ui = require("../config/admin-ui");

// 1) Runs on EVERY /admin route (including login): view helpers.
function adminLocals(req, res, next) {
  res.locals.icon = ui.icon;
  res.locals.esc = ui.esc;
  res.locals.avatar = ui.avatar;
  res.locals.imgUrl = ui.imgUrl;
  res.locals.fmtDate = ui.fmtDate;
  res.locals.fmtDateTime = ui.fmtDateTime;
  res.locals.timeAgo = ui.timeAgo;
  res.locals.badge = ui.badge;
  res.locals.cap = ui.cap;
  res.locals.actionLabel = ui.actionLabel;
  res.locals.actionTone = ui.actionTone;
  res.locals.activePage = "";
  next();
}

// 2) Protects every route after it: must be a logged-in, ACTIVE admin.
async function requireAdmin(req, res, next) {
  const wantsJson =
    req.originalUrl.startsWith("/api/") ||
    req.method !== "GET" ||
    req.xhr ||
    (req.headers.accept || "").includes("application/json");

  if (!req.session || !req.session.user) {
    if (wantsJson)
      return res
        .status(401)
        .json({ success: false, message: "Please log in first." });
    req.flash("error", "Please login first.");
    return res.redirect("/admin/login");
  }

  if (req.session.user.role !== "admin") {
    if (wantsJson)
      return res
        .status(403)
        .json({ success: false, message: "Admin access only." });
    return res.status(403).send("403 - Admin access only.");
  }

  try {
    // Re-check the database so a disabled admin is locked out immediately.
    const rows = await query(
      `SELECT user_id, full_name, email, contact_number, profile_image, role, account_status, created_at
               FROM users WHERE user_id = ? LIMIT 1`,
      [req.session.user.user_id],
    );
    const admin = rows[0];

    if (!admin || admin.role !== "admin" || admin.account_status !== "active") {
      delete req.session.user;
      if (wantsJson)
        return res.status(401).json({
          success: false,
          message: "Your admin session is no longer valid.",
        });
      req.flash("error", "Your admin account is not active.");
      return res.redirect("/admin/login");
    }

    req.admin = admin;
    res.locals.admin = admin;
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = requireAdmin;
module.exports.locals = adminLocals;
