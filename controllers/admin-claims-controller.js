// Loads submitted claims and applies admin decisions inside a transaction.

// controllers/admin-claims-controller.js
const db = require("../config/db");
const query = require("../config/query");
const { imgUrl } = require("../config/admin-ui");
const { logAdminAction } = require("../middleware/admin-activity");
const { createNotification, emitNotification } = require("../config/notify");

const MAX_NOTE_LENGTH = 255; // claims.admin_note is VARCHAR(255)

const toId = (value) => {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
};

// Get all claims for the admin claims page (unchanged)
exports.getClaims = async (req, res) => {
  try {
    const sql = `
            SELECT
                c.claim_id,
                c.user_id AS claimant_id,
                c.found_item_id,
                c.claim_details,
                c.status,
                c.created_at,
                c.reviewed_at,
                c.admin_note,
                fi.item_name,
                fi.description,
                fi.location,
                fi.date_found,
                fi.photo_path,
                fi.status AS item_status,
                fi.user_id AS finder_id,
                cat.category_name,
                u.full_name AS claimant,
                u.email AS claimant_email,
                u.contact_number AS claimant_contact,
                u.profile_image AS claimant_image,
                f.full_name AS finder
            FROM claims c
            INNER JOIN found_items fi
                ON fi.found_item_id = c.found_item_id
            INNER JOIN users u
                ON u.user_id = c.user_id
            LEFT JOIN users f
                ON f.user_id = fi.user_id
            LEFT JOIN item_categories cat
                ON cat.category_id = fi.category_id
            ORDER BY
                CASE WHEN c.status = 'pending' THEN 0 ELSE 1 END,
                c.created_at DESC
        `;

    const rows = await query(sql);
    const claims = rows.map((row) => ({
      ...row,
      photo: imgUrl(row.photo_path),
    }));

    res.render("admin/admin-claims", {
      title: "Claims",
      activePage: "claims",
      claims,
    });
  } catch (error) {
    console.error("Error loading admin claims:", error);
    req.flash("error", "Unable to load claims.");
    res.redirect("/admin");
  }
};

// Verify or reject a pending claim.
// Claim + item + notification are saved in ONE transaction: all succeed or none do.
exports.updateClaimStatus = async (req, res) => {
  const claimId = toId(req.params.id);
  const status = String(req.body.status || "")
    .trim()
    .toLowerCase();
  const note = String(req.body.note || "").trim();

  // 1. Validate input before touching the database
  if (!claimId) {
    return res
      .status(400)
      .json({ success: false, message: "Invalid claim ID." });
  }
  if (!["verified", "rejected"].includes(status)) {
    return res.status(400).json({
      success: false,
      message: "Status must be verified or rejected.",
    });
  }
  if (note.length > MAX_NOTE_LENGTH) {
    return res.status(400).json({
      success: false,
      message: `Note must be ${MAX_NOTE_LENGTH} characters or fewer.`,
    });
  }

  // NOTE: assumes the admin is stored in req.session.user (as app.js does).
  // If it is null, reviewed_by is simply saved as NULL.
  const adminId = req.session?.user?.user_id || null;

  let conn;
  let claim;
  let notification = null;

  try {
    conn = await db.promise().getConnection();
    await conn.beginTransaction();

    // Undo everything, then answer the browser.
    const abort = async (code, message) => {
      await conn.rollback();
      return res.status(code).json({ success: false, message });
    };

    // 2. Load and LOCK the claim and item rows. A second admin clicking at the
    //    same time waits here, then sees the claim is no longer pending.
    const [claimRows] = await conn.query(
      `SELECT
                c.claim_id,
                c.user_id AS claimant_id,
                c.found_item_id,
                c.status AS claim_status,
                fi.item_name,
                fi.status AS item_status,
                fi.user_id AS finder_id
             FROM claims c
             INNER JOIN found_items fi ON fi.found_item_id = c.found_item_id
             WHERE c.claim_id = ?
             LIMIT 1
             FOR UPDATE OF c, fi`,
      [claimId],
    );

    if (!claimRows.length) {
      return await abort(404, "Claim not found.");
    }
    claim = claimRows[0];

    // 3. Business rules
    if (claim.claim_status !== "pending") {
      return await abort(409, "This claim has already been reviewed.");
    }
    if (status === "verified" && claim.item_status !== "available") {
      return await abort(409, "This item is no longer available.");
    }

    // 4. Update the claim (the status = 'pending' guard is a second safety check)
    const [claimUpdate] = await conn.query(
      `UPDATE claims
             SET status = ?, reviewed_by = ?, reviewed_at = NOW(), admin_note = ?
             WHERE claim_id = ? AND status = 'pending'`,
      [status, adminId, note || null, claimId],
    );
    if (!claimUpdate.affectedRows) {
      return await abort(
        409,
        "The claim was already reviewed. Refresh the page.",
      );
    }

    // 5. Verified: the item leaves the public "available" list
    if (status === "verified") {
      const [itemUpdate] = await conn.query(
        `UPDATE found_items SET status = 'claimed'
                 WHERE found_item_id = ? AND status = 'available'`,
        [claim.found_item_id],
      );
      if (!itemUpdate.affectedRows) {
        return await abort(
          409,
          "The item is no longer available. Refresh and try again.",
        );
      }
    }

    // 6. Save the notification INSIDE the same transaction.
    //    Approval means "you may go to the office", NOT "item handed over".
    const message =
      status === "verified"
        ? `Your claim for "${claim.item_name}" has been approved. You may proceed to the designated office to claim your item. Please follow the office's collection instructions and bring any required identification or supporting documents.${note ? ` Admin note: ${note}` : ""}`
        : `Your claim for "${claim.item_name}" was not approved.${note ? ` Reason: ${note}` : ""}`;

    const run = async (sql, params) => (await conn.query(sql, params))[0];

    notification = await createNotification(run, claim.claimant_id, {
      type: status === "verified" ? "claim_verified" : "claim_rejected",
      title: status === "verified" ? "Claim Approved" : "Claim Not Approved",
      message,
      link: `/user/claims/${claim.claim_id}`, // becomes the claim page in a later step
      found_item_id: claim.found_item_id,
      claim_id: claim.claim_id,
      related_user_id: claim.finder_id,
    });

    // 7. Everything worked: make it permanent
    await conn.commit();
  } catch (error) {
    if (conn) {
      try {
        await conn.rollback();
      } catch (_) {
        /* connection already gone */
      }
    }
    console.error("Error updating claim status:", error);
    if (!res.headersSent) {
      return res
        .status(500)
        .json({ success: false, message: "Unable to update claim status." });
    }
    return;
  } finally {
    if (conn) conn.release();
  }

  // 8. AFTER commit: live alert (the database copy already exists, so a missed
  //    socket event is harmless) and the admin activity log.
  emitNotification(req.app.get("io"), notification);

  try {
    await logAdminAction(req, {
      action: status === "verified" ? "Verified claim" : "Rejected claim",
      details: `Claim #${claim.claim_id} for "${claim.item_name}".`,
    });
  } catch (logError) {
    console.error("Admin activity log failed:", logError);
  }

  return res.json({
    success: true,
    message:
      status === "verified"
        ? "Claim verified successfully."
        : "Claim rejected successfully.",
  });
};
