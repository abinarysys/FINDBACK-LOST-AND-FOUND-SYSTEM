// Applies the saved appearance settings and handles theme changes in the browser.

// public/js/theme.js  (Settings page only)
// Changes apply instantly (preview), then are saved to the database.
// If saving fails, the page goes back to the last saved look.
(() => {
  const panel = document.getElementById("themeSettings");
  if (!panel) return;

  const root = document.documentElement;
  const toggle = document.getElementById("darkToggle");
  const swatches = Array.from(document.querySelectorAll(".swatch"));
  const resetBtn = document.getElementById("resetTheme");
  const status = document.getElementById("themeStatus");

  const DEFAULT_THEME = { mode: "light", color: "#4F46E5" };

  // Paint each swatch with its colour (done here so the EJS file has no inline CSS).
  swatches.forEach((s) => {
    s.style.background = s.dataset.color;
  });

  let saved = { mode: panel.dataset.mode, color: panel.dataset.color };
  let current = { ...saved };
  let timer;

  function say(message, isError) {
    status.textContent = message;
    status.style.color = isError ? "var(--danger)" : "var(--muted)";
    clearTimeout(timer);
    if (message)
      timer = setTimeout(() => {
        status.textContent = "";
      }, 3000);
  }

  // Show a theme on the page (no saving here).
  function apply(theme) {
    if (theme.mode === "dark") root.setAttribute("data-theme", "dark");
    else root.removeAttribute("data-theme");
    root.style.setProperty("--accent", theme.color);

    toggle.checked = theme.mode === "dark";
    swatches.forEach((s) => {
      const on = s.dataset.color.toLowerCase() === theme.color.toLowerCase();
      s.classList.toggle("active", on);
      s.setAttribute("aria-pressed", String(on));
    });
  }

  async function save(theme) {
    current = { ...theme };
    apply(current);
    say("Saving…");

    try {
      const res = await fetch("/user/settings/theme", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(theme),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success)
        throw new Error(data.message || "Save failed");

      saved = { ...data.theme };
      say("Saved");
    } catch (error) {
      current = { ...saved };
      apply(current); // go back to what is really saved
      say("Could not save. Please try again.", true);
    }
  }

  toggle.addEventListener("change", () => {
    save({ mode: toggle.checked ? "dark" : "light", color: current.color });
  });

  swatches.forEach((s) => {
    s.addEventListener("click", () =>
      save({ mode: current.mode, color: s.dataset.color }),
    );
  });

  resetBtn.addEventListener("click", () => save({ ...DEFAULT_THEME }));
})();
