// Routes for the signed-in user's profile, items, and profile updates.

// Set up database helpers and file cleanup tools used by these routes.
const router = require("express").Router();
const path = require("path");
const fs = require("fs");
const db = require("../config/db.js");
const query = require("../config/query.js");
// Protect profile pages and handle uploaded profile pictures.
const authMiddleware = require("../middleware/auth-middleware.js");
const upload = require("../middleware/upload-middleware.js");
// Load profile details, claims, and recent item posts for the signed-in user.
// Loads only the columns the page needs (never password_hash), plus the user's
// reported items and claims. Everything is filtered by the SESSION user's id.
router.get("/profile", authMiddleware, async (req, res) => {
  try {
    const userId = req.session.user.user_id;

    const users = await query(
      `SELECT user_id, full_name, email, contact_number, role, profile_image,
                    account_status, verification_status, created_at
             FROM users WHERE user_id = ?`,
      [userId],
    );

    if (!users.length) {
      req.flash("error", "User not found.");
      return res.redirect("/auth/login");
    }

    const [foundRows, lostRows, claimRows] = await Promise.all([
      query(
        `SELECT fi.*, c.category_name
                 FROM found_items fi
                 LEFT JOIN item_categories c ON c.category_id = fi.category_id
                 WHERE fi.user_id = ?`,
        [userId],
      ),
      query(
        `SELECT li.*, c.category_name
                 FROM lost_items li
                 LEFT JOIN item_categories c ON c.category_id = li.category_id
                 WHERE li.user_id = ?`,
        [userId],
      ),
      query(
        `SELECT cl.claim_id, cl.status, cl.created_at, cl.reviewed_at, fi.item_name
                 FROM claims cl
                 INNER JOIN found_items fi ON fi.found_item_id = cl.found_item_id
                 WHERE cl.user_id = ?
                 ORDER BY cl.created_at DESC, cl.claim_id DESC`,
        [userId],
      ),
    ]);

    const shape = (item, type) => ({
      type,
      title: item.item_name || item.category_name || "Unnamed item",
      category_name: item.category_name,
      location: item.location,
      status: item.status,
      created_at: item.created_at,
    });

    const items = [
      ...foundRows.map((i) => shape(i, "found")),
      ...lostRows.map((i) => shape(i, "lost")),
    ]
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 6);

    res.render("user/user-profile", {
      user: users[0],
      stats: {
        found: foundRows.length,
        lost: lostRows.length,
        claims: claimRows.length,
        approved: claimRows.filter((c) => c.status === "verified").length,
      },
      claims: claimRows.slice(0, 5),
      items,
    });
  } catch (error) {
    console.error("Error loading profile:", error);
    req.flash("error", "Failed to retrieve user profile.");
    res.redirect("/");
  }
});
// Load the existing account details into the profile edit form.
router.get("/profile/edit", authMiddleware, (req, res) => {
  const userId = req.session.user.user_id;
  const edit = `SELECT user_id, full_name, email, contact_number, profile_image FROM users WHERE user_id = ?`;
  db.query(edit, [userId], (err, results) => {
    if (err) {
      console.error(err);
      req.flash("error", "Failed to load edit profile page.");
      return res.redirect("/user/profile");
    }
    if (results.length === 0) {
      req.flash("error", "User not found.");
      return res.redirect("/auth/login");
    }
    res.render("user/profile_edit", { user: results[0] });
  });
});
// Save changed profile fields and, when supplied, a new profile photo.
router.post(
  "/profile/update",
  authMiddleware,
  (req, res, next) => {
    upload.single("profile_image")(req, res, (err) => {
      if (err) {
        console.error("Upload profile picture error: ", err);
        req.flash("error", err.message || "Profile picture upload failed.");
        return res.redirect("/user/profile/edit");
      }
      next();
    });
  },
  (req, res) => {
    const userId = req.session.user.user_id;
    const { full_name, contact_number } = req.body;
    if (!full_name?.trim() || !contact_number?.trim()) {
      req.flash("error", "Full name and contact number are required.");
      return res.redirect("/user/profile/edit");
    }
    if (full_name.trim().length > 100 || contact_number.trim().length > 11) {
      req.flash("error", "Please check the length of your information.");
      return res.redirect("/user/profile/edit");
    }
    let sql = `UPDATE users SET full_name = ?, contact_number = ?`;
    const params = [full_name.trim(), contact_number.trim()];
    if (req.file) {
      sql += ", profile_image = ?";
      params.push("/uploads/" + req.file.filename);
    }
    sql += " WHERE user_id = ?";
    params.push(userId);
    db.query(sql, params, (err) => {
      if (err) {
        console.error("Database update error:", err);
        req.flash("error", "Failed to update your profile.");
        return res.redirect("/user/profile/edit");
      }
      req.session.user.full_name = full_name.trim();
      req.session.user.username = full_name.trim();
      req.session.user.num = contact_number.trim();
      if (req.file) {
        req.session.user.profile_image = "/uploads/" + req.file.filename;
      }
      req.flash("success", "Profile updated successfully.");
      return res.redirect("/user/profile");
    });
  },
);
// MY ITEMS (replaces the old "activity logs" page)
router.get("/items", authMiddleware, async (req, res) => {
  try {
    const userId = req.session.user.user_id;

    const [lostRows, foundRows] = await Promise.all([
      query(
        `SELECT li.*, c.category_name
                 FROM lost_items li
                 LEFT JOIN item_categories c ON c.category_id = li.category_id
                 WHERE li.user_id = ?`,
        [userId],
      ),
      query(
        `SELECT fi.*, c.category_name
                 FROM found_items fi
                 LEFT JOIN item_categories c ON c.category_id = fi.category_id
                 WHERE fi.user_id = ?`,
        [userId],
      ),
    ]);

    const shape = (item, type) => ({
      type,
      title: item.item_name || item.category_name || "Unnamed item",
      category_name: item.category_name,
      location: item.location,
      status: item.status,
      created_at: item.created_at,
    });

    const items = [
      ...lostRows.map((i) => shape(i, "lost")),
      ...foundRows.map((i) => shape(i, "found")),
    ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    res.render("user/items", {
      user: req.session.user,
      items,
      stats: {
        total: items.length,
        lost: lostRows.length,
        found: foundRows.length,
      },
    });
  } catch (error) {
    console.error("Error loading items:", error);
    req.flash("error", "Could not load your items.");
    res.redirect("/user/profile");
  }
});

// Old address kept only so bookmarks / the old sidebar link don't break. Safe to delete later.
router.get("/activity-logs", (req, res) => res.redirect(301, "/user/items"));

module.exports = router;
