// Loads notifications, marks them read, and handles live notification events.

// public/js/notify.js
// Loaded by the global bell (config/global-bell.js), which app.js injects into every page for logged-in users.
// The database is the source of truth: this file only displays what the server tells it.
(() => {
  // The bell is added at the END of <body> by app.js. A copy of this script that runs earlier
  // (for example one a page loads itself) would find no bell yet. So: only mark the script as
  // "loaded" once the bell really exists, and wait for the page to finish loading if it is not there yet.
  function start() {
    if (window.__fbNotifyLoaded) return; // already running: never start twice
    const bell = document.getElementById("notifBell");
    if (!bell) return; // no bell on this page (guests, admin pages)
    window.__fbNotifyLoaded = true;
    init(bell);
  }

  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", start);
  start();

  function init(bell) {
    const badge = document.getElementById("notifBadge");
    const panel = document.getElementById("notifPanel");
    const panelList = document.getElementById("notifList");
    const panelMarkAll = document.getElementById("notifMarkAll");

    const API = "/user/notifications/api";
    const CLAIM_RESULT_TYPES = ["claim_verified", "claim_rejected"];

    let unread = 0;

    // ---------- helpers ----------

    // Always build text with textContent (never innerHTML) so notification text can't inject HTML.
    function el(tag, className, text) {
      const node = document.createElement(tag);
      if (className) node.className = className;
      if (text !== undefined && text !== null) node.textContent = text;
      return node;
    }

    async function api(path, method = "GET") {
      const res = await fetch(`${API}${path}`, {
        method,
        credentials: "same-origin",
        keepalive: method !== "GET", // lets a mark-as-read finish even if the page navigates
        headers: { Accept: "application/json" },
      });
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      return res.json();
    }

    // Same rule as the server: only the claimant's result notifications get a View Claim link.
    function actionUrl(n) {
      return n.claim_id && CLAIM_RESULT_TYPES.includes(n.type)
        ? `/user/claims/${n.claim_id}`
        : null;
    }

    function timeAgo(value) {
      const date = new Date(value);
      if (isNaN(date)) return "";
      const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
      if (seconds < 60) return "Just now";
      const minutes = Math.floor(seconds / 60);
      if (minutes < 60) return `${minutes} min ago`;
      const hours = Math.floor(minutes / 60);
      if (hours < 24) return `${hours} hr ago`;
      const days = Math.floor(hours / 24);
      if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`;
      return date.toLocaleDateString("en-PH", { dateStyle: "medium" });
    }

    function setBadge() {
      badge.textContent = unread > 99 ? "99+" : String(unread);
      badge.hidden = unread < 1;

      // The sidebar link on dashboard pages shows the same number (element exists only there).
      const navCount = document.getElementById("navNotifCount");
      if (navCount) {
        navCount.textContent = unread > 99 ? "99+" : String(unread);
        navCount.hidden = unread < 1;
      }
      bell.setAttribute(
        "aria-label",
        unread > 0 ? `Notifications, ${unread} unread` : "Notifications",
      );
    }

    // ---------- dropdown panel ----------

    function panelRow(n) {
      const row = el(
        "a",
        `notif-row ${Number(n.is_read) === 1 ? "read" : "unread"}`,
      );
      row.href = actionUrl(n) || n.link || "/user/notifications";
      row.dataset.id = n.notification_id;

      const body = el("div", "notif-row-body");
      body.append(
        el("strong", "", n.title || "Notification"),
        el("span", "notif-row-msg", n.message),
        el("small", "notif-row-time", timeAgo(n.created_at)),
      );
      row.append(el("span", "notif-row-dot"), body);
      return row;
    }

    function renderPanel(list) {
      panelList.replaceChildren();
      if (!list.length) {
        panelList.append(el("div", "notif-empty", "No notifications yet"));
        return;
      }
      list.forEach((n) => panelList.append(panelRow(n)));
    }

    async function loadPanel() {
      try {
        const data = await api("/list?limit=8");
        unread = data.unread;
        setBadge();
        renderPanel(data.notifications);
      } catch (error) {
        panelList.replaceChildren(
          el("div", "notif-empty", "Unable to load notifications."),
        );
      }
    }

    function openPanel() {
      panel.hidden = false;
      bell.setAttribute("aria-expanded", "true");
      loadPanel();
    }

    function closePanel() {
      panel.hidden = true;
      bell.setAttribute("aria-expanded", "false");
    }

    // ---------- full notifications page (only exists on /user/notifications) ----------

    function updatePageCount() {
      const label = document.querySelector(".notification-count");
      if (!label) return;
      const total = document.querySelectorAll(
        ".notification-list .notification-item",
      ).length;
      label.textContent = `${total} ${total === 1 ? "notification" : "notifications"}`;
    }

    function pageItem(n) {
      const article = el("article", "notification-item unread just-arrived");
      article.dataset.notificationId = n.notification_id;

      const icon = el(
        "div",
        `notification-icon ${n.type}`,
        n.type === "claim_verified"
          ? "✓"
          : n.type === "claim_rejected"
            ? "×"
            : "●",
      );

      const titleRow = el("div", "notification-title-row");
      titleRow.append(
        el("h3", "", n.title || "Notification"),
        el("span", "new-badge", "New"),
      );

      const details = el("div", "notification-details");
      details.append(
        titleRow,
        el("p", "notification-message", n.message),
        el(
          "span",
          "notification-date",
          new Date(n.created_at).toLocaleString("en-PH", {
            dateStyle: "medium",
            timeStyle: "short",
          }),
        ),
      );

      const url = actionUrl(n);
      if (url) {
        const link = el("a", "view-claim-button", "View Claim");
        link.href = url;
        details.append(link);
      }

      const markBtn = el("button", "mark-read-btn", "Mark as read");
      markBtn.type = "button";
      markBtn.dataset.id = n.notification_id;
      details.append(markBtn);

      article.append(icon, details, el("span", "unread-dot"));
      return article;
    }

    function insertIntoPage(n) {
      const root = document.querySelector(".notifications-content");
      if (!root) return;

      let list = root.querySelector(".notification-list");
      if (!list) {
        // The "No notifications yet" state is replaced by a real list.
        list = el("div", "notification-list");
        const empty = root.querySelector(".empty-notifications");
        if (empty) empty.replaceWith(list);
        else root.querySelector(".notifications-card")?.append(list);
      }

      if (list.querySelector(`[data-notification-id="${n.notification_id}"]`))
        return; // no duplicates
      list.prepend(pageItem(n));
      updatePageCount();
    }

    function markPageItemRead(id) {
      const item = document.querySelector(
        `.notification-item[data-notification-id="${id}"]`,
      );
      if (!item) return;
      item.classList.remove("unread", "just-arrived");
      item.classList.add("read");
      item
        .querySelectorAll(".new-badge, .unread-dot, .mark-read-btn")
        .forEach((node) => node.remove());
    }

    function markPanelRowRead(id) {
      const row = panelList.querySelector(`.notif-row[data-id="${id}"]`);
      if (row) {
        row.classList.remove("unread");
        row.classList.add("read");
      }
    }

    // ---------- actions (each one saves to the database FIRST, then updates the screen) ----------

    async function markOne(id) {
      const data = await api(`/${id}/read`, "POST");
      unread = data.unread;
      setBadge();
      markPageItemRead(id);
      markPanelRowRead(id);
    }

    async function markAll() {
      const data = await api("/read-all", "POST");
      unread = data.unread;
      setBadge();
      document
        .querySelectorAll(".notification-item.unread")
        .forEach((item) => markPageItemRead(item.dataset.notificationId));
      panelList.querySelectorAll(".notif-row.unread").forEach((row) => {
        row.classList.remove("unread");
        row.classList.add("read");
      });
    }

    async function refreshCount() {
      try {
        const data = await api("/unread-count");
        unread = data.unread;
        setBadge();
      } catch (error) {
        /* offline or logged out: keep whatever is shown */
      }
    }

    // ---------- events ----------

    bell.addEventListener("click", (event) => {
      event.stopPropagation();
      if (panel.hidden) openPanel();
      else closePanel();
    });

    document.addEventListener("click", (event) => {
      if (!panel.hidden && !panel.contains(event.target)) closePanel();

      const markBtn = event.target.closest(".mark-read-btn");
      if (markBtn) {
        markBtn.disabled = true;
        markOne(markBtn.dataset.id).catch(() => {
          markBtn.disabled = false;
        });
        return;
      }

      const pageAll = event.target.closest("#pageMarkAll");
      if (pageAll) {
        pageAll.disabled = true;
        markAll()
          .catch(() => {})
          .finally(() => {
            pageAll.disabled = false;
          });
      }
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !panel.hidden) {
        closePanel();
        bell.focus();
      }
    });

    panelMarkAll.addEventListener("click", () => {
      markAll().catch(() => {});
    });

    // Clicking a dropdown row: save "read", then open the link.
    panelList.addEventListener("click", async (event) => {
      const row = event.target.closest(".notif-row");
      if (!row) return;
      event.preventDefault();
      if (row.classList.contains("unread")) {
        try {
          await markOne(row.dataset.id);
        } catch (error) {
          /* open it anyway */
        }
      }
      window.location.href = row.href;
    });

    // ---------- live updates ----------

    function onNotification(n) {
      if (!n) return;
      unread += 1;
      setBadge();
      if (!panel.hidden) loadPanel(); // refresh the open dropdown from the database
      insertIntoPage(n);
    }

    if (typeof window.io === "function") {
      const socket = window.io();

      // "connect" fires on the first connection AND after every reconnect, so anything that
      // arrived while the socket was down (or while the tab was asleep) is recounted from MySQL.
      socket.on("connect", refreshCount);
      socket.on("notification", onNotification);
      socket.on("connect_error", (error) => {
        console.warn("Live notifications unavailable:", error.message);
      });
    } else {
      console.warn(
        "Socket.IO client was not loaded; the bell updates on page load only.",
      );
      refreshCount();
    }

    // Returning to a tab that was in the background: recount.
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") refreshCount();
    });

    setBadge();
  }
})();
