// Applies security headers and prevents browsers from caching protected pages.

// middleware/security.js
// applySecurity(app) -> secure HTTP headers (call it BEFORE session and routes)
// noStore            -> stops browsers/proxies from caching login and register pages
const helmet = require("helmet");

const applySecurity = (app) => {
  app.disable("x-powered-by");
  app.use(
    helmet({
      // Your pages use inline <script> and onclick="" handlers, so a strict CSP would break them.
      // Turn it on later after moving inline scripts to files.
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
      crossOriginResourcePolicy: { policy: "same-site" },
      referrerPolicy: { policy: "strict-origin-when-cross-origin" },
    }),
  );
};

const noStore = (req, res, next) => {
  res.set({
    "Cache-Control": "no-store, no-cache, must-revalidate, private",
    Pragma: "no-cache",
    Expires: "0",
  });
  next();
};

module.exports = { applySecurity, noStore };
