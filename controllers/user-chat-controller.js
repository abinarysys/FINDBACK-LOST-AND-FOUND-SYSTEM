// Serves chat pages and checks conversation access before returning messages.

// controllers/user-chat-controller.js
// Rules that protect privacy (enforced HERE, on the server):
//  - the user id ALWAYS comes from the session, never from the browser
//  - every read/write first checks the user is a participant of that conversation
//  - a conversation that does not exist and one you are not part of look the same (404)
const db = require("../config/db");
const query = require("../config/query");

const MAX_LENGTH = 1000; // characters per message
const PAGE_SIZE = 50; // messages loaded at once

const toId = (value) => {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
};

// type in the URL -> which table holds the item (whitelist, so nothing from the URL reaches the SQL)
const ITEM_SOURCES = {
  found: { table: "found_items", idColumn: "found_item_id" },
  lost: { table: "lost_items", idColumn: "lost_item_id" },
};

const me = (req) => req.session.user.user_id;

// Returns the other person + BOTH read markers (mine and theirs), or null when I am NOT in this conversation.
async function getParticipation(conversationId, userId) {
  const rows = await query(
    `SELECT mine.last_read_message_id,
                theirs.last_read_message_id AS other_last_read,
                u.user_id AS other_id, u.full_name AS other_name, u.profile_image AS other_image
         FROM conversation_participants mine
         JOIN conversation_participants theirs
              ON theirs.conversation_id = mine.conversation_id AND theirs.user_id <> mine.user_id
         JOIN users u ON u.user_id = theirs.user_id
         WHERE mine.conversation_id = ? AND mine.user_id = ?
         LIMIT 1`,
    [conversationId, userId],
  );
  return rows[0] || null;
}

async function totalUnread(userId) {
  const rows = await query(
    `SELECT COUNT(*) AS total
         FROM messages m
         JOIN conversation_participants mine
              ON mine.conversation_id = m.conversation_id AND mine.user_id = ?
         WHERE m.message_id > mine.last_read_message_id AND m.sender_id <> ?`,
    [userId, userId],
  );
  return rows[0].total;
}

// One conversation per pair of people. A transaction + lock stops two clicks at the same
// moment from creating two conversations.
async function findOrCreateConversation(userA, userB) {
  const conn = await db.promise().getConnection();
  try {
    await conn.beginTransaction();
    // lock both user rows (lowest id first, always the same order -> no deadlock)
    const [first, second] = userA < userB ? [userA, userB] : [userB, userA];
    await conn.query(
      "SELECT user_id FROM users WHERE user_id IN (?, ?) ORDER BY user_id FOR UPDATE",
      [first, second],
    );

    const [found] = await conn.query(
      `SELECT a.conversation_id
             FROM conversation_participants a
             JOIN conversation_participants b ON b.conversation_id = a.conversation_id
             WHERE a.user_id = ? AND b.user_id = ?
               AND (SELECT COUNT(*) FROM conversation_participants x
                    WHERE x.conversation_id = a.conversation_id) = 2
             LIMIT 1`,
      [userA, userB],
    );
    if (found.length) {
      await conn.commit();
      return found[0].conversation_id;
    }

    const [created] = await conn.query(
      "INSERT INTO conversations () VALUES ()",
    );
    await conn.query(
      "INSERT INTO conversation_participants (conversation_id, user_id) VALUES (?, ?), (?, ?)",
      [created.insertId, userA, created.insertId, userB],
    );
    await conn.commit();
    return created.insertId;
  } catch (error) {
    await conn.rollback().catch(() => {});
    throw error;
  } finally {
    conn.release();
  }
}

// ---------------------------------------------------------------- pages

// GET /user/chat   (optional ?c=<conversation id>&about=found-7)
exports.getChatPage = async (req, res) => {
  try {
    const userId = me(req);
    let openId = null;
    let draft = "";

    const wanted = toId(req.query.c);
    if (wanted && (await getParticipation(wanted, userId))) {
      openId = wanted;

      // "about=found-7": prefill the message box with the item's NAME, read from the database
      const match = /^(found|lost)-(\d+)$/.exec(String(req.query.about || ""));
      if (match) {
        const source = ITEM_SOURCES[match[1]];
        const rows = await query(
          `SELECT item_name FROM ${source.table} WHERE ${source.idColumn} = ? LIMIT 1`,
          [Number(match[2])],
        );
        if (rows.length)
          draft = `Hi! I'm messaging about "${rows[0].item_name}".`;
      }
    }

    res.render("user/chat", {
      user: req.session.user,
      activePage: "chat",
      openId,
      draft,
    });
  } catch (error) {
    console.error("Error loading chat page:", error);
    req.flash("error", "Unable to load the chat right now.");
    res.redirect("/user/profile");
  }
};

// GET /user/chat/start/found/7   (the "Message" button on an item card)
exports.startConversation = async (req, res) => {
  try {
    const userId = me(req);
    const type = String(req.params.type || "").toLowerCase();
    const itemId = toId(req.params.id);
    const source = ITEM_SOURCES[type];

    if (!source || !itemId) {
      req.flash("error", "That item could not be found.");
      return res.redirect("/browse");
    }

    const items = await query(
      `SELECT user_id FROM ${source.table} WHERE ${source.idColumn} = ? LIMIT 1`,
      [itemId],
    );
    if (!items.length) {
      req.flash("error", "That item could not be found.");
      return res.redirect("/browse");
    }

    const ownerId = items[0].user_id; // who posted it: from the DATABASE, not from the browser
    if (ownerId === userId) {
      req.flash(
        "error",
        "This is your own post, so there is nobody to message.",
      );
      return res.redirect("/browse");
    }

    const conversationId = await findOrCreateConversation(userId, ownerId);
    res.redirect(`/user/chat?c=${conversationId}&about=${type}-${itemId}`);
  } catch (error) {
    console.error("Error starting conversation:", error);
    req.flash("error", "Unable to start the chat right now.");
    res.redirect("/browse");
  }
};

// ---------------------------------------------------------------- JSON API

// GET /user/chat/api/conversations  -> my conversations that have at least one message
exports.listConversations = async (req, res) => {
  try {
    const userId = me(req);
    const rows = await query(
      `SELECT c.conversation_id,
                    u.user_id AS other_id, u.full_name AS other_name, u.profile_image AS other_image,
                    lm.message_id AS last_id, lm.message_text AS last_text,
                    lm.sender_id AS last_sender, lm.sent_at AS last_at,
                    (SELECT COUNT(*) FROM messages m
                     WHERE m.conversation_id = c.conversation_id
                       AND m.message_id > mine.last_read_message_id
                       AND m.sender_id <> ?) AS unread
             FROM conversation_participants mine
             JOIN conversations c ON c.conversation_id = mine.conversation_id
             JOIN conversation_participants theirs
                  ON theirs.conversation_id = c.conversation_id AND theirs.user_id <> mine.user_id
             JOIN users u ON u.user_id = theirs.user_id
             JOIN messages lm
                  ON lm.message_id = (SELECT MAX(message_id) FROM messages
                                      WHERE conversation_id = c.conversation_id)
             WHERE mine.user_id = ?
             ORDER BY lm.sent_at DESC, lm.message_id DESC`,
      [userId, userId],
    );
    res.json({ success: true, conversations: rows });
  } catch (error) {
    console.error("Error listing conversations:", error);
    res
      .status(500)
      .json({ success: false, message: "Unable to load conversations." });
  }
};

// GET /user/chat/api/unread-count
exports.unreadCount = async (req, res) => {
  try {
    res.json({ success: true, unread: await totalUnread(me(req)) });
  } catch (error) {
    console.error("Error counting unread messages:", error);
    res
      .status(500)
      .json({ success: false, message: "Unable to count messages." });
  }
};

// GET /user/chat/api/conversations/:id/messages[?before=<message id>]
exports.getMessages = async (req, res) => {
  try {
    const userId = me(req);
    const conversationId = toId(req.params.id);
    const before = toId(req.query.before);
    if (!conversationId)
      return res
        .status(404)
        .json({ success: false, message: "Conversation not found." });

    const person = await getParticipation(conversationId, userId);
    if (!person)
      return res
        .status(404)
        .json({ success: false, message: "Conversation not found." });

    const params = [conversationId];
    let beforeSql = "";
    if (before) {
      beforeSql = "AND message_id < ?";
      params.push(before);
    }

    // newest first, one extra row tells us whether older messages exist
    const rows = await query(
      `SELECT message_id, conversation_id, sender_id, message_text, sent_at
             FROM messages
             WHERE conversation_id = ? ${beforeSql}
             ORDER BY message_id DESC
             LIMIT ${PAGE_SIZE + 1}`,
      params,
    );
    const hasMore = rows.length > PAGE_SIZE;
    const messages = rows.slice(0, PAGE_SIZE).reverse(); // oldest -> newest for display

    res.json({
      success: true,
      conversation: {
        conversation_id: conversationId,
        other_id: person.other_id,
        other_name: person.other_name,
        other_image: person.other_image,
        my_last_read_id: person.last_read_message_id, // what I have read
        peer_last_read_id: person.other_last_read, // what THEY have read -> "Seen"
      },
      messages,
      hasMore,
    });
  } catch (error) {
    console.error("Error loading messages:", error);
    res
      .status(500)
      .json({ success: false, message: "Unable to load messages." });
  }
};

// POST /user/chat/api/conversations/:id/messages   body: { text }
exports.sendMessage = async (req, res) => {
  try {
    const userId = me(req);
    const conversationId = toId(req.params.id);
    const text = String(req.body?.text ?? "").trim();

    if (!conversationId)
      return res
        .status(404)
        .json({ success: false, message: "Conversation not found." });
    if (!text)
      return res
        .status(400)
        .json({ success: false, message: "Type a message first." });
    if (text.length > MAX_LENGTH) {
      return res.status(400).json({
        success: false,
        message: `Messages can be at most ${MAX_LENGTH} characters.`,
      });
    }

    const person = await getParticipation(conversationId, userId);
    if (!person)
      return res
        .status(404)
        .json({ success: false, message: "Conversation not found." });

    // 1. save to MySQL FIRST
    const result = await query(
      "INSERT INTO messages (conversation_id, sender_id, message_text) VALUES (?, ?, ?)",
      [conversationId, userId, text],
    );
    const saved = (
      await query(
        `SELECT message_id, conversation_id, sender_id, message_text, sent_at
             FROM messages WHERE message_id = ?`,
        [result.insertId],
      )
    )[0];

    // NOTE: sending does NOT touch my read marker. Reading is recorded only by markRead() below,
    // when the browser reports which messages were really on screen.

    // 2. THEN push it live to the two people in this conversation (their private rooms)
    const io = req.app.get("io");
    if (io) {
      const payload = { ...saved, sender_name: req.session.user.full_name };
      io.to(`user:${person.other_id}`)
        .to(`user:${userId}`)
        .emit("chat:message", payload);
    }

    res.status(201).json({ success: true, message: saved });
  } catch (error) {
    console.error("Error sending message:", error);
    res
      .status(500)
      .json({ success: false, message: "Unable to send your message." });
  }
};

// POST /user/chat/api/conversations/:id/read   body: { upTo: <id of the newest message the browser showed> }
// Security / correctness rules:
//  - only MY row (conversation + session user) can change: nobody can mark things read for someone else
//  - I must be a participant (same 404 as "not found" otherwise)
//  - the marker only moves FORWARD, and it always lands on a real message of THIS conversation
//    (so it can never point at, or reveal anything about, another conversation)
//  - the other person is told ("chat:read") only when the marker really moved
exports.markRead = async (req, res) => {
  try {
    const userId = me(req);
    const conversationId = toId(req.params.id);
    if (!conversationId)
      return res
        .status(404)
        .json({ success: false, message: "Conversation not found." });

    const person = await getParticipation(conversationId, userId);
    if (!person)
      return res
        .status(404)
        .json({ success: false, message: "Conversation not found." });

    // upTo is optional (older pages send nothing = "everything so far")
    let upTo = null;
    if (req.body && req.body.upTo !== undefined && req.body.upTo !== null) {
      upTo = toId(req.body.upTo);
      if (!upTo)
        return res
          .status(400)
          .json({ success: false, message: "Invalid message id." });
    }

    // newest message of THIS conversation that is not newer than upTo
    const params = [conversationId];
    let limitSql = "";
    if (upTo) {
      limitSql = "AND message_id <= ?";
      params.push(upTo);
    }
    const rows = await query(
      `SELECT COALESCE(MAX(message_id), 0) AS target
             FROM messages WHERE conversation_id = ? ${limitSql}`,
      params,
    );

    const target = Number(rows[0].target);
    const previous = Number(person.last_read_message_id);

    if (target > previous) {
      await query(
        `UPDATE conversation_participants
                 SET last_read_message_id = GREATEST(last_read_message_id, ?)
                 WHERE conversation_id = ? AND user_id = ?`,
        [target, conversationId, userId],
      );

      // tell the other person (their "Seen" updates live) and my own other tabs (unread dot clears)
      const io = req.app.get("io");
      if (io) {
        io.to(`user:${person.other_id}`)
          .to(`user:${userId}`)
          .emit("chat:read", {
            conversation_id: conversationId,
            reader_id: userId,
            last_read_message_id: target,
          });
      }
    }

    res.json({
      success: true,
      last_read_message_id: Math.max(previous, target),
      unread: await totalUnread(userId),
    });
  } catch (error) {
    console.error("Error marking messages as read:", error);
    res
      .status(500)
      .json({ success: false, message: "Unable to update messages." });
  }
};
