// Shared markup helpers for the admin templates.

// SVG path fragments used by the admin navigation and action buttons.
const ICONS = {
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/>',
  users:
    '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  box: '<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><path d="M3.27 6.96 12 12.01l8.73-5.05"/><path d="M12 22.08V12"/>',
  shield:
    '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>',
  chart:
    '<line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>',
  file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>',
  clock:
    '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
  logout:
    '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>',
  user: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  search:
    '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',
  plus: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
  download:
    '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
  check: '<polyline points="20 6 9 17 4 12"/>',
  x: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
  search2:
    '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',
  message:
    '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
  flag: '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/>',
  key: '<path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.78 7.78 5.5 5.5 0 0 1 7.78-7.78zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/>',
  image:
    '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>',
};


// Escaping HTML SPECIAL CHARACTERS
const esc = (v) =>
    String(v ?? "").replace(/[&<>"']/g, (c) =>({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" 
    })[
        c
      ],
  );

// Build an SVG from the built-in icon paths above.
const icon = (name, cls = "") =>
  `<svg class="ico ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ""}</svg>`;

// imgUrl() function is used to clean and standardize image paths so your FINDBACK application can display uploaded images correctly.
const imgUrl = (p) => {
    if (!p) return "";
    const s = String(p).trim().replace(/\\/g, "/");
    if (/^(https?:)?\/\//i.test(s) || s.startsWith("data:")) return s;
    const file = s.replace(/^\/+/, "").replace(/^uploads\/?/i, "");
    return file ? "/uploads/" + file : "";
};

// Build a short initials fallback from the first and last words of a person's name.
const initials = (name) =>
  String(name || "?").trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "?";

// Render an image avatar when available; otherwise show escaped initials as the fallback.
const avatar = (name, img, size = "") => {
  const src = imgUrl(img);
  return src
    ? `<img class="avatar ${size}" src="${esc(src)}" alt="${esc(name)}" loading="lazy" onerror="this.outerHTML='<span class=&quot;avatar ${size}&quot;>${esc(initials(name))}</span>'">`
    : `<span class="avatar ${size}">${esc(initials(name))}</span>`;
};

// Format a date for compact admin tables; show a placeholder for missing or invalid values.
const fmtDate = (d) => {
  if (!d) return "—";
  const x = new Date(d);
  return isNaN(x)
    ? "—"
    : x.toLocaleDateString("en-US", {
        month: "short",
        day: "2-digit",
        year: "numeric",
      });
};

// Format a timestamp with both date and time for detailed admin records.
const fmtDateTime = (d) => {
  if (!d) return "—";
  const x = new Date(d);
  return isNaN(x)
    ? "—"
    : x.toLocaleString("en-US", {
        month: "short",
        day: "2-digit",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
};

// Show recent timestamps as relative ages, then use a calendar date for older records.
const timeAgo = (d) => {
  const x = new Date(d);
  if (!d || isNaN(x)) return "—";
  const s = Math.max(1, Math.round((Date.now() - x.getTime()) / 1000));
  if (s < 60) return "just now";
  if (s < 3600) return Math.floor(s / 60) + " min ago";
  if (s < 86400) return Math.floor(s / 3600) + " hr ago";
  if (s < 604800) return Math.floor(s / 86400) + " d ago";
  return fmtDate(d);
};

// Map known record states to the CSS class that colors the admin status badge.
const badge = (status) => {
  const s = String(status || "").toLowerCase();
  if (
    [
      "active",
      "verified",
      "approved",
      "available",
      "found",
      "returned",
      "claimed",
      "resolved",
    ].includes(s)
  )
    return "badge-success";
  if (["pending"].includes(s)) return "badge-warning";
  if (["inactive", "rejected", "suspended", "denied", "cancelled"].includes(s))
    return "badge-danger";
  if (["lost"].includes(s)) return "badge-primary";
  return "badge-neutral";
};

// Capitalize a label when there is no explicit human-readable action name.
const cap = (s) => {
  s = String(s ?? "");
  return s.charAt(0).toUpperCase() + s.slice(1);
};

// Provide readable names for audit action codes used by the admin activity log.
const ACTION_LABELS = {
  LOGIN: "Logged in",
  LOGOUT: "Logged out",
  ADD_ADMIN: "Added admin",
  ENABLE_ADMIN: "Enabled admin",
  DISABLE_ADMIN: "Disabled admin",
  ACTIVATE_USER: "Activated user",
  DEACTIVATE_USER: "Deactivated user",
  APPROVE_USER: "Verified user",
  REJECT_USER: "Rejected user",
  RESET_VERIFICATION: "Reset verification",
  UPDATE_PROFILE: "Updated profile",
  CHANGE_PASSWORD: "Changed password",
  SETUP_ADMIN: "Created first admin",
};
// Convert an action code to a known label or a title-cased fallback.
const actionLabel = (a) =>
  ACTION_LABELS[a] ||
  cap(
    String(a || "")
      .toLowerCase()
      .replace(/_/g, " "),
  );
// Choose a badge color from the action category to make activity rows easier to scan.
const actionTone = (a) => {
  a = String(a || "");
  if (/^(DISABLE|DEACTIVATE|REJECT)/.test(a)) return "badge-danger";
  if (/^(ADD|ENABLE|ACTIVATE|APPROVE|SETUP)/.test(a)) return "badge-success";
  if (/^(LOGIN|LOGOUT)/.test(a)) return "badge-primary";
  return "badge-neutral";
};

// Share these display helpers with admin middleware and the admin view layer.
module.exports = {
  ICONS,
  esc,
  icon,
  imgUrl,
  initials,
  avatar,
  fmtDate,
  fmtDateTime,
  timeAgo,
  badge,
  cap,
  actionLabel,
  actionTone,
};
