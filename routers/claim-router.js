// Routes for submitting claims against found-item posts.

// routers/claim-router.js
const router = require("express").Router();
const query = require("../config/query.js");
const authMiddleware = require("../middleware/auth-middleware.js");

// SHOW CLAIM PAGE (found items only - lost items can't be claimed)
router.get("/:type/:item_id", authMiddleware, async (req, res) => {
  const { type, item_id } = req.params;

  if (type !== "found") {
    req.flash("error", "Only found items can be claimed.");
    return res.redirect("/");
  }

  try {
    const rows = await query(
      `SELECT found_item_id AS item_id, item_name, description, location, photo_path, status
               FROM found_items WHERE found_item_id = ?`,
      [item_id],
    );

    if (!rows.length) {
      req.flash("error", "Item not found.");
      return res.redirect("/");
    }
    if (rows[0].status !== "available") {
      req.flash("error", "This item is no longer available for claiming.");
      return res.redirect("/");
    }

    const item = { ...rows[0], type, picture: rows[0].photo_path };
    res.render("claim", { item });
  } catch (err) {
    console.error("Claim item query error:", err);
    req.flash("error", "Failed to retrieve item.");
    res.redirect("/");
  }
});

// SUBMIT A CLAIM -> saved as 'pending' for the admin
router.post("/:type/:item_id/submit", authMiddleware, async (req, res) => {
  const { type, item_id } = req.params;
  const back = `/claim/${type}/${item_id}`;
  const claimDetails = String(req.body.claim_details || "").trim();
  const user = req.session.user;

  if (type !== "found") {
    req.flash("error", "Only found items can be claimed.");
    return res.redirect("/");
  }
  if (!user?.user_id) {
    req.flash("error", "Please log in first.");
    return res.redirect("/auth/login");
  }
  if (claimDetails.length < 10 || claimDetails.length > 2000) {
    req.flash("error", "Claim details must be between 10 and 2000 characters.");
    return res.redirect(back);
  }

  try {
    const items = await query(
      "SELECT found_item_id, user_id, item_name, status FROM found_items WHERE found_item_id = ?",
      [item_id],
    );
    const item = items[0];

    if (!item) {
      req.flash("error", "Item not found.");
      return res.redirect("/");
    }
    if (item.user_id === user.user_id) {
      req.flash("error", "You can't claim an item that you posted yourself.");
      return res.redirect("/");
    }
    if (item.status !== "available") {
      req.flash("error", "This item is no longer available for claiming.");
      return res.redirect("/");
    }

    const dup = await query(
      "SELECT claim_id FROM claims WHERE found_item_id = ? AND user_id = ? AND status = 'pending'",
      [item.found_item_id, user.user_id],
    );
    if (dup.length) {
      req.flash("error", "You already have a pending claim for this item.");
      return res.redirect("/");
    }

    const result = await query(
      "INSERT INTO claims (found_item_id, user_id, claim_details) VALUES (?, ?, ?)",
      [item.found_item_id, user.user_id, claimDetails],
    );

    // live alert for any admin who is online
    const io = req.app.get("io");
    if (io)
      io.to("admins").emit("claim:new", {
        claim_id: result.insertId,
        item_name: item.item_name,
        claimant: user.full_name || user.username || "A user",
      });

    req.flash(
      "success",
      "Claim submitted! Please wait for the verification notification.",
    );
    res.redirect("/");
  } catch (err) {
    console.error("Submit claim error:", err);
    req.flash("error", "Failed to submit your claim. Please try again.");
    res.redirect(back);
  }
});

module.exports = router;
