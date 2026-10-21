// Shows and updates notifications belonging to the signed-in user.

// controllers/user-notifications-controller.js
// Every query below is filtered by the SESSION user's id, never by an id from the browser,
// so one user can never read or change another user's notifications.
const query = require("../config/query");

const CLAIM_RESULT_TYPES = ["claim_verified", "claim_rejected"];

const toId = (value) => {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
};

// Where the "View Claim" button goes. Only the claimant's own result
// notifications get one (other types keep their normal link).
const actionUrlFor = (n) =>
  n.claim_id && CLAIM_RESULT_TYPES.includes(n.type)
    ? `/user/claims/${n.claim_id}`
    : null;

async function countUnread(userId) {
  const rows = await query(
    "SELECT COUNT(*) AS total FROM notifications WHERE user_id = ? AND is_read = 0",
    [userId],
  );
  return Number(rows[0].total);
}

// ---------- Full notifications page (existing, now adds action_url) ----------
exports.getNotifications = async (req, res) => {
  try {
    const userId = req.session.user?.user_id;

    if (!userId) {
      return res.redirect("/auth/login");
    }

    const rows = await query(
      `SELECT
                n.notification_id,
                n.user_id,
                n.type,
                n.title,
                n.message,
                n.link,
                n.is_read,
                n.created_at,
                n.found_item_id,
                n.claim_id,
                n.related_user_id,

                fi.item_name,
                fi.description AS item_description,
                fi.location AS item_location,
                fi.date_found,
                fi.photo_path,
                fi.status AS item_status,

                cat.category_name,

                other_user.full_name AS related_user_name

             FROM notifications n

             LEFT JOIN found_items fi
                ON fi.found_item_id = n.found_item_id

             LEFT JOIN item_categories cat
                ON cat.category_id = fi.category_id

             LEFT JOIN users other_user
                ON other_user.user_id = n.related_user_id

             WHERE n.user_id = ?

             ORDER BY n.created_at DESC, n.notification_id DESC
             LIMIT 50`,
      [userId],
    );

    const notifications = rows.map((n) => ({
      ...n,
      action_url: actionUrlFor(n),
    }));

    res.render("user/notifications", {
      user: req.session.user,
      notifications,
    });
  } catch (error) {
    console.error("Error loading notifications:", error);
    req.flash("error", "Unable to load notifications.");
    res.redirect("/");
  }
};

// ---------- JSON API used by the bell (routes are mounted under /user/notifications/api) ----------

// GET /api/list?limit=8  -> latest notifications + unread count
exports.listApi = async (req, res) => {
  try {
    const userId = req.session.user.user_id;
    const limit = Math.min(toId(req.query.limit) || 8, 50); // validated integer, safe to inline

    const rows = await query(
      `SELECT notification_id, type, title, message, link, is_read, created_at,
                    found_item_id, claim_id
             FROM notifications
             WHERE user_id = ?
             ORDER BY created_at DESC, notification_id DESC
             LIMIT ${limit}`,
      [userId],
    );

    res.json({
      success: true,
      unread: await countUnread(userId),
      notifications: rows,
    });
  } catch (error) {
    console.error("Error listing notifications:", error);
    res
      .status(500)
      .json({ success: false, message: "Unable to load notifications." });
  }
};

// GET /api/unread-count
exports.unreadCountApi = async (req, res) => {
  try {
    res.json({
      success: true,
      unread: await countUnread(req.session.user.user_id),
    });
  } catch (error) {
    console.error("Error counting notifications:", error);
    res
      .status(500)
      .json({ success: false, message: "Unable to load the unread count." });
  }
};

// POST /api/:id/read  -> marks ONE notification as read (only if it belongs to this user)
exports.markOneRead = async (req, res) => {
  try {
    const userId = req.session.user.user_id;
    const notificationId = toId(req.params.id);

    if (!notificationId) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid notification ID." });
    }

    await query(
      "UPDATE notifications SET is_read = 1 WHERE notification_id = ? AND user_id = ?",
      [notificationId, userId],
    );

    res.json({ success: true, unread: await countUnread(userId) });
  } catch (error) {
    console.error("Error marking notification as read:", error);
    res
      .status(500)
      .json({ success: false, message: "Unable to mark as read." });
  }
};

// POST /api/read-all
exports.markAllRead = async (req, res) => {
  try {
    const userId = req.session.user.user_id;

    await query(
      "UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0",
      [userId],
    );

    res.json({ success: true, unread: 0 });
  } catch (error) {
    console.error("Error marking all notifications as read:", error);
    res
      .status(500)
      .json({ success: false, message: "Unable to mark all as read." });
  }
};
