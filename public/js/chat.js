// Loads conversations and keeps the chat interface current over HTTP and Socket.IO.

// public/js/chat.js  -  the chat page (views/user/chat.ejs).
// The database is the source of truth: this file only shows what the server returns,
// and live messages only add to what is already saved.
// READ RECEIPTS (Messenger-style "Seen"):
//  - A message counts as READ only when the conversation is open on screen, the browser tab is
//    visible and focused, and the reader is at the bottom of the thread. Sent, delivered by socket
//    or merely loaded into the page is NOT "read".
//  - The browser tells the server "I have read up to message N" (POST .../read). The server saves it
//    in MySQL (conversation_participants.last_read_message_id) and tells the other person live
//    ("chat:read"). On the sender's side the avatar of the reader appears under the last message
//    they have read.
(() => {
  const root = document.getElementById("chat");
  if (!root) return;

  const ME = Number(root.dataset.me);
  const API = "/user/chat/api";

  const $ = (id) => document.getElementById(id);
  const listEl = $("chatList"),
    searchEl = $("chatSearch");
  const emptyEl = $("chatEmpty"),
    threadEl = $("chatThread");
  const nameEl = $("threadName"),
    avatarEl = $("threadAvatar");
  const messagesEl = $("chatMessages"),
    olderBtn = $("chatOlder");
  const errorEl = $("chatError"),
    formEl = $("chatForm");
  const inputEl = $("chatInput"),
    backBtn = $("chatBack");

  let conversations = []; // the list on the left
  let openId = Number(root.dataset.open) || null; // conversation shown on the right
  let renderedId = null; // conversation whose messages are on screen NOW
  let openPerson = null; // { other_id, other_name, other_image }
  let hasMore = false;
  let pendingDraft = root.dataset.draft || "";

  const peerReadMap = {}; // conversation id -> newest message id the OTHER person has read
  const readSent = {}; // conversation id -> newest message id I have already reported as read
  const pendingLive = []; // live messages that arrived while a conversation was still loading

  // ---------- helpers ----------

  // Text is always inserted with textContent (never innerHTML), so a message can't inject HTML.
  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = text;
    return node;
  }

  async function api(path, options = {}) {
    const res = await fetch(`${API}${path}`, {
      credentials: "same-origin",
      headers: {
        Accept: "application/json",
        ...(options.body ? { "Content-Type": "application/json" } : {}),
      },
      ...options,
    });
    let data = null;
    try {
      data = await res.json();
    } catch (e) {
      /* not JSON */
    }
    if (res.status === 401) {
      window.location.href = "/auth/login";
      throw new Error("Please log in.");
    }
    if (!res.ok)
      throw new Error(
        (data && data.message) || `Request failed (${res.status})`,
      );
    return data;
  }

  function formatTime(value) {
    const date = new Date(value);
    if (isNaN(date)) return "";
    const now = new Date();
    if (date.toDateString() === now.toDateString()) {
      return date.toLocaleTimeString("en-PH", {
        hour: "numeric",
        minute: "2-digit",
      });
    }
    const sameYear = date.getFullYear() === now.getFullYear();
    return date.toLocaleDateString(
      "en-PH",
      sameYear ? { month: "short", day: "numeric" } : { dateStyle: "medium" },
    );
  }

  function avatar(target, name, image) {
    target.replaceChildren();
    if (image) {
      const img = document.createElement("img");
      img.src = image;
      img.alt = "";
      img.addEventListener("error", () => {
        target.replaceChildren(document.createTextNode(initial(name)));
      });
      target.append(img);
    } else {
      target.textContent = initial(name);
    }
  }
  const initial = (name) => {
    const parts = String(name || "?").trim().split(/\s+/).filter(Boolean);
    return (parts.length > 1
      ? parts[0][0] + parts[parts.length - 1][0]
      : (parts[0] || "?").slice(0, 2)).toUpperCase();
  };

  function showError(message) {
    errorEl.textContent = message || "";
    errorEl.hidden = !message;
  }

  // ---------- conversation list ----------

  function renderList() {
    const term = searchEl.value.trim().toLowerCase();
    const shown = conversations.filter(
      (c) => !term || String(c.other_name).toLowerCase().includes(term),
    );
    listEl.replaceChildren();

    if (!shown.length) {
      listEl.append(
        el(
          "div",
          "chat-placeholder",
          conversations.length
            ? "No one matches your search."
            : "No conversations yet. Press Message on an item to start one.",
        ),
      );
      return;
    }

    shown.forEach((c) => {
      const row = el(
        "button",
        `chat-item${c.conversation_id === openId ? " active" : ""}${c.unread > 0 ? " unread" : ""}`,
      );
      row.type = "button";
      row.dataset.id = c.conversation_id;

      const av = el("span", "avatar");
      avatar(av, c.other_name, c.other_image);

      const top = el("div", "chat-item-top");
      top.append(
        el("strong", "", c.other_name),
        el("time", "", c.last_at ? formatTime(c.last_at) : ""),
      );

      const bottom = el("div", "chat-item-bottom");
      const preview =
        (c.last_sender === ME ? "You: " : "") + (c.last_text || "");
      bottom.append(el("span", "chat-item-preview", preview));
      if (c.unread > 0)
        bottom.append(
          el("span", "nav-count", c.unread > 99 ? "99+" : String(c.unread)),
        );

      const body = el("div", "chat-item-body");
      body.append(top, bottom);
      row.append(av, body);
      listEl.append(row);
    });
  }

  async function loadList() {
    try {
      const data = await api("/conversations");
      conversations = data.conversations;
      renderList();
    } catch (error) {
      listEl.replaceChildren(
        el("div", "chat-placeholder", "Unable to load conversations."),
      );
    }
  }

  // ---------- messages ----------

  function messageNode(m) {
    const mine = m.sender_id === ME;
    const wrap = el("div", `chat-msg ${mine ? "mine" : "theirs"}`);
    wrap.dataset.id = m.message_id;
    wrap.append(
      el("div", "chat-bubble", m.message_text),
      el("time", "", formatTime(m.sent_at)),
    );
    return wrap;
  }

  const hasMessage = (id) =>
    !!messagesEl.querySelector(`.chat-msg[data-id="${id}"]`);
  const nearBottom = () =>
    messagesEl.scrollHeight - messagesEl.scrollTop - messagesEl.clientHeight <
    120;
  const scrollToBottom = () => {
    messagesEl.scrollTop = messagesEl.scrollHeight;
  };

  // newest message from the OTHER person that is on screen
  function lastIncomingId() {
    let max = 0;
    messagesEl.querySelectorAll(".chat-msg.theirs").forEach((n) => {
      max = Math.max(max, Number(n.dataset.id));
    });
    return max;
  }

  function showThread(person) {
    openPerson = person;
    emptyEl.hidden = true;
    threadEl.hidden = false;
    root.classList.add("is-open");
    nameEl.textContent = person.other_name;
    avatar(avatarEl, person.other_name, person.other_image);
  }

  // ---------- read receipts ----------

  const isPhone = () => window.matchMedia("(max-width: 800px)").matches;

  // Is the open conversation REALLY in front of the person right now?
  function canRead() {
    if (!openId || renderedId !== openId || threadEl.hidden) return false;
    if (isPhone() && !root.classList.contains("is-open")) return false; // phone: list view is showing
    return document.visibilityState === "visible" && document.hasFocus();
  }

  // Tell the server which messages I have read (only when they were genuinely on screen).
  async function maybeMarkRead() {
    if (!canRead() || !nearBottom()) return;

    const id = openId;
    const upTo = lastIncomingId();
    if (!upTo || upTo <= (readSent[id] || 0)) return; // nothing new to report

    const previous = readSent[id] || 0;
    readSent[id] = upTo; // set first, so two triggers don't double-post
    try {
      await api(`/conversations/${id}/read`, {
        method: "POST",
        body: JSON.stringify({ upTo }),
      });
      const c = conversations.find((x) => x.conversation_id === id);
      if (c && id === openId && lastIncomingId() <= upTo) c.unread = 0;
      renderList();
    } catch (error) {
      readSent[id] = previous; // not saved: try again on the next trigger
    }
  }

  function setPeerRead(conversationId, messageId) {
    peerReadMap[conversationId] = Math.max(
      peerReadMap[conversationId] || 0,
      messageId || 0,
    );
    if (conversationId === openId) updateReceipts();
  }

  // Messenger rules for MY messages:
  //  - the other person's small avatar sits under the LAST of my messages they have read ("Seen")
  //  - if I sent something newer than that, my newest message says "Sent"
  function updateReceipts() {
    messagesEl.querySelectorAll(".chat-receipt").forEach((n) => n.remove());
    if (!openPerson || renderedId !== openId) return;

    const mine = Array.from(messagesEl.querySelectorAll(".chat-msg.mine"));
    if (!mine.length) return;

    const read = peerReadMap[openId] || 0;
    const lastMine = mine[mine.length - 1];
    let lastSeen = null;
    for (let i = mine.length - 1; i >= 0; i--) {
      if (Number(mine[i].dataset.id) <= read) {
        lastSeen = mine[i];
        break;
      }
    }

    if (lastSeen) {
      const seen = el("span", "chat-receipt chat-seen");
      seen.title = `Seen by ${openPerson.other_name}`;
      seen.setAttribute("aria-label", `Seen by ${openPerson.other_name}`);
      const av = el("span", "avatar chat-seen-avatar");
      avatar(av, openPerson.other_name, openPerson.other_image);
      seen.append(av, el("span", "", "Seen"));
      lastSeen.append(seen);
    }
    if (lastMine !== lastSeen)
      lastMine.append(el("span", "chat-receipt chat-sent", "Sent"));
  }

  // ---------- opening a conversation ----------

  async function openConversation(id, { keepDraft = false } = {}) {
    openId = id;
    renderedId = null; // the old messages on screen are not this conversation
    showError("");
    renderList();
    try {
      const data = await api(`/conversations/${id}/messages`);
      if (openId !== id) return; // user clicked another one meanwhile
      showThread(data.conversation);
      hasMore = data.hasMore;
      olderBtn.hidden = !hasMore;
      messagesEl.querySelectorAll(".chat-msg").forEach((n) => n.remove());
      data.messages.forEach((m) => messagesEl.append(messageNode(m)));
      renderedId = id;

      // read markers saved in MySQL (they survive reloads and logins)
      readSent[id] = Math.max(
        readSent[id] || 0,
        Number(data.conversation.my_last_read_id) || 0,
      );
      peerReadMap[id] = Math.max(
        peerReadMap[id] || 0,
        Number(data.conversation.peer_last_read_id) || 0,
      );

      // messages that arrived live while this was loading
      pendingLive.splice(0).forEach((m) => {
        if (m.conversation_id === id && !hasMessage(m.message_id))
          messagesEl.append(messageNode(m));
      });

      scrollToBottom();
      updateReceipts();

      // a chat started from an item card that has no messages yet is not in the list: show it
      if (!conversations.some((c) => c.conversation_id === id)) {
        conversations.unshift({
          conversation_id: id,
          other_id: data.conversation.other_id,
          other_name: data.conversation.other_name,
          other_image: data.conversation.other_image,
          last_text: "",
          last_sender: null,
          last_at: null,
          unread: 0,
        });
      }
      await maybeMarkRead();
      renderList();

      if (!keepDraft && pendingDraft && !inputEl.value) {
        inputEl.value = pendingDraft;
        autosize();
      }
      pendingDraft = "";
      inputEl.focus({ preventScroll: true });
    } catch (error) {
      showError(error.message);
    }
  }

  async function loadOlder() {
    const first = messagesEl.querySelector(".chat-msg");
    if (!first || !openId) return;
    olderBtn.disabled = true;
    try {
      const data = await api(
        `/conversations/${openId}/messages?before=${first.dataset.id}`,
      );
      const before = messagesEl.scrollHeight;
      const anchor = olderBtn.nextSibling;
      data.messages.forEach((m) =>
        messagesEl.insertBefore(messageNode(m), anchor),
      );
      messagesEl.scrollTop += messagesEl.scrollHeight - before; // keep the reader's place
      hasMore = data.hasMore;
      olderBtn.hidden = !hasMore;
      updateReceipts();
    } catch (error) {
      showError(error.message);
    } finally {
      olderBtn.disabled = false;
    }
  }

  // ---------- sending ----------

  function autosize() {
    inputEl.style.height = "auto";
    inputEl.style.height = `${Math.min(inputEl.scrollHeight, 140)}px`;
  }

  async function send() {
    const text = inputEl.value.trim();
    if (!text || !openId) return;
    showError("");

    // Clear the box RIGHT AWAY: anything the person types next is a new message and must never
    // be wiped when the server answers. If sending fails, the text is put back below.
    inputEl.value = "";
    autosize();

    try {
      const data = await api(`/conversations/${openId}/messages`, {
        method: "POST",
        body: JSON.stringify({ text }),
      });
      addMessage(data.message, { fromMe: true }); // the live event for the same id is ignored (no duplicate)
    } catch (error) {
      showError(error.message);
      if (!inputEl.value) {
        inputEl.value = text;
        autosize();
      } // nothing is lost
    } finally {
      inputEl.focus();
    }
  }

  // Shows a message in the thread (if open) and updates the list on the left.
  function addMessage(m, { fromMe = false } = {}) {
    const isOpen = m.conversation_id === openId;
    const mine = m.sender_id === ME;
    let readNow = false; // will the person actually SEE it right now?

    if (isOpen && renderedId !== openId) {
      pendingLive.push(m); // still loading: shown as soon as it finishes
    } else if (isOpen && !hasMessage(m.message_id)) {
      const stick = fromMe || mine || nearBottom();
      messagesEl.append(messageNode(m));
      if (stick) scrollToBottom();
      updateReceipts();
      readNow = !mine && stick && canRead();
    }

    const c = conversations.find(
      (x) => x.conversation_id === m.conversation_id,
    );
    if (!c) {
      loadList();
      return;
    } // a brand-new conversation: reload the list
    if (c.last_id !== m.message_id) {
      c.last_id = m.message_id;
      c.last_text = m.message_text;
      c.last_sender = m.sender_id;
      c.last_at = m.sent_at;
      if (!mine && !readNow) c.unread = (c.unread || 0) + 1; // not on screen = still unread
    }
    conversations = [c, ...conversations.filter((x) => x !== c)];
    renderList();
    if (readNow) maybeMarkRead();
  }

  // ---------- events ----------

  listEl.addEventListener("click", (event) => {
    const row = event.target.closest(".chat-item");
    if (row) openConversation(Number(row.dataset.id), { keepDraft: true });
  });
  searchEl.addEventListener("input", renderList);
  olderBtn.addEventListener("click", loadOlder);
  backBtn.addEventListener("click", () => {
    root.classList.remove("is-open");
  });

  formEl.addEventListener("submit", (event) => {
    event.preventDefault();
    send();
  });
  inputEl.addEventListener("input", autosize);
  inputEl.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
      event.preventDefault(); // Enter sends, Shift+Enter = new line
      send();
    }
  });

  // Reading starts (or resumes) when the person comes back to the tab or scrolls to the newest message.
  window.addEventListener("focus", maybeMarkRead);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") maybeMarkRead();
  });
  let scrollQueued = false;
  messagesEl.addEventListener("scroll", () => {
    if (scrollQueued) return;
    scrollQueued = true;
    requestAnimationFrame(() => {
      scrollQueued = false;
      maybeMarkRead();
    });
  });

  // ---------- live updates ----------

  if (typeof window.io === "function") {
    const socket = window.io();
    // "connect" fires on the first connection AND after every reconnect:
    // reload from MySQL so nothing sent (or read) while we were disconnected is missed.
    socket.on("connect", () => {
      loadList();
      if (openId && renderedId === openId && openPerson) {
        const id = openId;
        api(`/conversations/${id}/messages`)
          .then((data) => {
            if (openId !== id) return;
            data.messages.forEach((m) => {
              if (!hasMessage(m.message_id)) messagesEl.append(messageNode(m));
            });
            setPeerRead(id, Number(data.conversation.peer_last_read_id) || 0);
            updateReceipts();
            if (nearBottom()) scrollToBottom();
            maybeMarkRead();
          })
          .catch(() => {});
      }
    });
    socket.on("chat:message", (m) => {
      if (m) addMessage(m);
    });

    // The server says somebody's read position moved. Only the two people in the conversation get this.
    socket.on("chat:read", (p) => {
      const conversationId = Number(p && p.conversation_id);
      const messageId = Number(p && p.last_read_message_id);
      if (!conversationId || !messageId) return;

      if (Number(p.reader_id) === ME) {
        // Only react if it was ANOTHER tab/window of mine (this tab already knows its own reads)
        if (messageId > (readSent[conversationId] || 0)) {
          readSent[conversationId] = messageId;
          loadList(); // refresh my unread dots here too
        }
      } else {
        setPeerRead(conversationId, messageId); // the other person read my messages -> "Seen"
      }
    });
    socket.on("connect_error", (error) =>
      console.warn("Live chat unavailable:", error.message),
    );
  } else {
    console.warn(
      "Socket.IO client was not loaded; new messages appear after a refresh.",
    );
  }

  // ---------- start ----------
  (async () => {
    await loadList();
    if (openId) openConversation(openId);
  })();
})();
