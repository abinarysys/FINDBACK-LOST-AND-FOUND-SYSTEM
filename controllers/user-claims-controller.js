// Loads a user's claim pages and scopes every lookup to the signed-in account.
const query = require("../config/query");

const sendNotFound = (res) =>
  res
    .status(404)
    .send(
      '<p style="font-family:sans-serif;padding:40px">Claim not found. ' +
        '<a href="/user/notifications">Back to notifications</a></p>',
    );

exports.viewClaim = async (req, res) => {
  try {
    const userId = req.session.user?.user_id;
    if (!userId) return res.redirect("/auth/login");

    const claimId = Number(req.params.id);
    if (!Number.isInteger(claimId) || claimId < 1) return sendNotFound(res);

    const rows = await query(
      `SELECT
                c.claim_id,
                c.claim_details,
                c.status,
                c.created_at,
                c.reviewed_at,
                c.admin_note,
                fi.found_item_id,
                fi.item_name,
                fi.description AS item_description,
                fi.location AS item_location,
                fi.date_found,
                fi.photo_path,
                cat.category_name
             FROM claims c
             INNER JOIN found_items fi ON fi.found_item_id = c.found_item_id
             LEFT JOIN item_categories cat ON cat.category_id = fi.category_id
             WHERE c.claim_id = ? AND c.user_id = ?
             LIMIT 1`,
      [claimId, userId],
    );

    // Same answer whether the claim doesn't exist or belongs to someone else,
    // so nobody can probe which claim ids exist.
    if (!rows.length) return sendNotFound(res);

    // Opening the claim counts as reading its notifications.
    await query(
      "UPDATE notifications SET is_read = 1 WHERE user_id = ? AND claim_id = ? AND is_read = 0",
      [userId, claimId],
    );

    res.render("user/claim-details", {
      user: req.session.user,
      claim: rows[0],
    });
  } catch (error) {
    console.error("Error loading claim:", error);
    res.status(500).send("Unable to load this claim.");
  }
};

// "My Claims" tab: every claim the logged-in user has made (filtered by the session user only).
exports.listClaims = async (req, res) => {
  try {
    const userId = req.session.user?.user_id;
    if (!userId) return res.redirect("/auth/login");

    const claims = await query(
      `SELECT
                c.claim_id,
                c.status,
                c.created_at,
                c.reviewed_at,
                c.admin_note,
                fi.item_name,
                fi.location AS item_location
             FROM claims c
             INNER JOIN found_items fi ON fi.found_item_id = c.found_item_id
             WHERE c.user_id = ?
             ORDER BY c.created_at DESC, c.claim_id DESC`,
      [userId],
    );

    res.render("user/claims", { user: req.session.user, claims });
  } catch (error) {
    console.error("Error loading claims list:", error);
    req.flash("error", "Unable to load your claims.");
    res.redirect("/user/profile");
  }
};
