// Accepts only supported theme values before they reach a page or database.

// config/theme.js
// The ONLY place that decides which theme values are valid. Used by the middleware,
// the settings route and the settings page, so a user can never save (or inject) anything else.

// Every accent has white-text contrast of at least 5:1, so buttons stay readable.
const ACCENTS = [
  { name: "Indigo", value: "#4F46E5" },
  { name: "Blue", value: "#2563EB" },
  { name: "Teal", value: "#0F766E" },
  { name: "Emerald", value: "#047857" },
  { name: "Violet", value: "#6D28D9" },
  { name: "Rose", value: "#BE123C" },
  { name: "Slate", value: "#334155" },
];

const DEFAULT_THEME = { mode: "light", color: ACCENTS[0].value };

const isMode = (mode) => mode === "light" || mode === "dark";
const isAccent = (color) =>
  ACCENTS.some(
    (a) => a.value.toLowerCase() === String(color || "").toLowerCase(),
  );

// Anything missing or invalid falls back to the safe default.
function sanitize(input) {
  const color = ACCENTS.find(
    (a) => a.value.toLowerCase() === String(input?.color || "").toLowerCase(),
  );
  return {
    mode: input?.mode === "dark" ? "dark" : "light",
    color: color ? color.value : DEFAULT_THEME.color,
  };
}

// Tiny script placed at the top of <head>, so the right theme is applied BEFORE the first paint
// (no flash of the wrong theme). Values were validated above, so nothing unsafe can be printed.
function themeScript(theme, applyDark) {
  const t = sanitize(theme);
  return `<script>(function(){var r=document.documentElement;r.style.setProperty('--accent','${t.color}');${
    applyDark && t.mode === "dark" ? "r.setAttribute('data-theme','dark');" : ""
  }})();</script>`;
}

module.exports = {
  ACCENTS,
  DEFAULT_THEME,
  isMode,
  isAccent,
  sanitize,
  themeScript,
};
