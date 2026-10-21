// Records admin actions; a logging failure must not break the main request.

// middleware/admin-activity.js
// Records what admins do so it shows on  Activity Logs > Admin Activity.
const query = require("../config/query");

let warned = false;

/**
 *   await logAdminAction(req, 'APPROVE_USER', { targetType: 'user', targetId: 5, details: 'Verified Ann' });
 *   await logAdminAction(req, 'LOGIN', { adminId: user.user_id });   // when the session isn't set yet
 * Never throws: a logging problem must not break the real action.
 */
async function logAdminAction(req, action, opts = {}) {
  try {
    const adminId = opts.adminId ?? req.session?.user?.user_id;
    if (!adminId) return;

    const fwd = req.headers?.["x-forwarded-for"];
    const ip =
      String(
        fwd
          ? String(fwd).split(",")[0]
          : req.ip || req.socket?.remoteAddress || "",
      )
        .trim()
        .replace(/^::ffff:/, "")
        .slice(0, 45) || null;

    await query(
      `INSERT INTO admin_activity_logs
                (admin_id, action, target_type, target_id, details, ip_address)
             VALUES (?, ?, ?, ?, ?, ?)`,
      [
        adminId,
        String(action).slice(0, 50),
        opts.targetType || null,
        opts.targetId ?? null,
        opts.details ? String(opts.details).slice(0, 255) : null,
        ip,
      ],
    );
  } catch (err) {
    if (err.code === "ER_NO_SUCH_TABLE") {
      if (!warned) {
        warned = true;
        console.warn(
          "[admin] Table admin_activity_logs is missing. Run sql/admin-update.sql once.",
        );
      }
    } else {
      console.error("logAdminAction failed:", err.message);
    }
  }
}

module.exports = { logAdminAction };
