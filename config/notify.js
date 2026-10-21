// Saves notifications and sends live updates to the intended user's socket room.

// config/notify.js
// Two jobs, kept separate on purpose:
//   createNotification() -> save to MySQL (can run inside a transaction)
//   emitNotification()   -> send live to the user's socket room (run AFTER commit)
// notifyUser() does both and keeps the old signature, so existing callers still work.
const query = require("./query");

const INSERT_SQL = `INSERT INTO notifications
    (user_id, type, title, message, link, found_item_id, claim_id, related_user_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;

/**
 * @param {Function} run  async (sql, params) => result of the query.
 *                        Pass a transaction's function, or the plain `query`.
 * @returns the saved notification, or null if it already existed (duplicate).
 */
async function createNotification(run, userId, notification) {
  if (!userId) {
    throw new Error("A valid user ID is required.");
  }

  const {
    type,
    title,
    message,
    link = "/user/notifications",
    found_item_id = null,
    claim_id = null,
    related_user_id = null,
  } = notification;

  let result;
  try {
    result = await run(INSERT_SQL, [
      userId,
      type,
      title,
      message,
      link,
      found_item_id,
      claim_id,
      related_user_id,
    ]);
  } catch (error) {
    // The UNIQUE (claim_id, type) key refused a second copy: not an error for us.
    if (error.code === "ER_DUP_ENTRY") return null;
    throw error;
  }

  return {
    notification_id: result.insertId,
    user_id: userId,
    type,
    title,
    message,
    link,
    found_item_id,
    claim_id,
    related_user_id,
    is_read: 0,
    created_at: new Date(),
  };
}

// Only the room "user:<id>" receives it. Rooms are joined in app.js
// using the logged-in SESSION user, never an ID sent by the browser.
function emitNotification(io, notification) {
  if (!io || !notification) return;
  io.to(`user:${notification.user_id}`).emit("notification", notification);
}

async function notifyUser(io, userId, notification) {
  const saved = await createNotification(query, userId, notification);
  emitNotification(io, saved);
  return saved;
}

module.exports = { createNotification, emitNotification, notifyUser };
