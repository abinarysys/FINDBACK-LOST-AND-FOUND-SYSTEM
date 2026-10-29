(function () {
  function initScrollReveal() {
    if (document.body.dataset.scrollRevealInitialized === "true") return;
    document.body.dataset.scrollRevealInitialized = "true";
    document.body.classList.add("page-entering");
    window.addEventListener("pageshow", function () {
      document.body.classList.remove("page-leaving");
    });
    document.addEventListener("click", function (event) {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey ||
        window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ) return;
      var link = event.target.closest("a[href]");
      if (!link || link.target || link.hasAttribute("download")) return;
      var target;
      try { target = new URL(link.href, window.location.href); } catch (_) { return; }
      if (target.origin !== window.location.origin) return;
      if (target.href === window.location.href || (target.pathname === window.location.pathname && target.hash)) return;
      event.preventDefault();
      document.body.classList.add("page-leaving");
      window.setTimeout(function () { window.location.assign(target.href); }, 190);
    });

    var selectors = [
      // Semantic page sections provide a reliable baseline across every public
      // page, including pages whose one-off classes are not listed below.
      "main > article",
      "main > *",
      "main article",
      "main .card",
      "main > h1",
      "main > h2",
      "main > form",
      ".page-home > section",
      ".page-browse main > section",
      ".page-hiw main > section",
      ".page-contact main > section",
      ".page-content > section",
      ".page-content > article",
      ".page-content > .card",
      ".content > section",
      ".content > article",
      ".content > .card",
      ".browse > *",
      ".category-page > *",
      ".claim-container > *",
      ".top > *",
      ".steps > *",
      ".tips > *",
      ".page-home .header",
      ".page-home .search",
      ".page-home .lostFound-button",
      ".page-home .top-layer > *",
      ".page-home .top-layer .right",
      ".page-home > .categories",
      ".page-home .categories a",
      ".page-home .recent-items > .recent-head",
      ".page-home .recent-head",
      ".page-home > .recent-items",
      ".page-home .item-card",
      ".page-home > .feedback",
      ".page-home .feedback > h2",
      ".page-home .feedback-form",
      ".page-home > .feedback-list",
      ".page-home .feedback-list > h3",
      ".page-home .feedback-list > .feedback-sub",
      ".page-home .feedback-card",
      ".page-home .feedback-empty",
      ".page-home .footer .help-band",
      ".page-home .footer .footer-bar",
      ".u-hero-in",
      ".u-tabs",
      ".u-main > *",
      ".browse > .hero",
      ".browse > .search-wrap",
      ".browse > .categories",
      ".browse .posts-head",
      ".browse .card",
      ".contact-hero",
      ".contact-info h2",
      ".contact-info-intro",
      ".hiw-card",
      ".hiw-hero",
      ".hiw-about h2",
      ".hiw-feature",
      ".contact-info-item",
      ".contact-info-note",
      ".contact-form h2",
      ".contact-form .contact-field",
      ".contact-form button[type='submit']",
      ".category-banner",
      ".category-content .item-card",
      ".claim-card",
      ".top",
      ".steps .step",
      ".tips",
      ".lostItem-form",
      ".foundItem-form",
      ".auth-shell",
      ".auth-brand",
      ".auth .auth-card",
      ".admin-main > .page-heading",
      ".main > .page-head",
      ".main > .stats .stat",
      ".main > .grid-2 > .panel",
      ".main > .panel",
      ".main > .stack > *",
    ];
    var currentPath = window.location.pathname.replace(/\/$/, "") || "/";
    var isUserProfileOrDashboard = /^\/user\/(?:profile|dashboard)(?:\/|$)/.test(currentPath);
    var isAdminPage = /^\/admin(?:\/|$)/.test(currentPath);
    // The landing page has its own inline reveal observer in index.ejs so its
    // sections never depend on the shared selector list or run two effects.
    var allowScrollReveal = !isUserProfileOrDashboard && !isAdminPage && !document.body.classList.contains("page-home");
    var elements = allowScrollReveal
      ? Array.from(document.querySelectorAll(selectors.join(",")))
      : [];

    elements.forEach(function (element, index) {
      element.classList.add("scroll-reveal");
      element.style.setProperty("--reveal-delay", Math.min(index % 5, 3) * 45 + "ms");
    });

    if (!elements.length) return;
    if (!("IntersectionObserver" in window)) {
      elements.forEach(function (element) {
        element.classList.add("is-visible");
      });
      return;
    }

    var updateQueued = false;
    function updateRevealState() {
      updateQueued = false;
      var viewportHeight = document.documentElement.clientHeight || window.innerHeight;
      elements.forEach(function (element) {
        var bounds = element.getBoundingClientRect();
        var inView = bounds.bottom > viewportHeight * 0.04 && bounds.top < viewportHeight * 0.94;
        element.classList.toggle("is-visible", inView);
      });
    }
    function scheduleRevealUpdate() {
      if (updateQueued) return;
      updateQueued = true;
      window.requestAnimationFrame(updateRevealState);
    }

    window.addEventListener("scroll", scheduleRevealUpdate, { passive: true });
    window.addEventListener("resize", scheduleRevealUpdate, { passive: true });
    // Allow the initial hidden style to paint before revealing the first viewport.
    window.setTimeout(scheduleRevealUpdate, 40);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initScrollReveal, { once: true });
  } else {
    initScrollReveal();
  }
})();
