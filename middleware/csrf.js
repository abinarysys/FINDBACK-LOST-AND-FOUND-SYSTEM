// Creates session-bound tokens and checks them on state-changing requests.

// middleware/csrf.js
// Small session-based CSRF protection (no extra package needed).
//   ensureCsrf  -> makes sure the session has a token and exposes it to views as `csrfToken`
//   verifyCsrf  -> rejects a POST whose token is missing or wrong
// In a form add:  <input type="hidden" name="_csrf" value="<%= csrfToken %>">
// For fetch/AJAX send the header:  x-csrf-token: <token>
// For multipart forms run multer BEFORE verifyCsrf so req.body is filled in.
const crypto = require("crypto");
const fs = require("fs");

const ensureCsrf = (req, res, next) => {
  if (!req.session)
    return next(new Error("Sessions must be enabled before CSRF protection."));
  if (!req.session.csrfToken)
    req.session.csrfToken = crypto.randomBytes(32).toString("hex");
  res.locals.csrfToken = req.session.csrfToken;
  next();
};

const verifyCsrf = (req, res, next) => {
  const expected = req.session && req.session.csrfToken;
  const sent = String(
    (req.body && req.body._csrf) || req.get("x-csrf-token") || "",
  );

  let ok = false;
  if (
    expected &&
    sent &&
    Buffer.byteLength(sent) === Buffer.byteLength(expected)
  ) {
    ok = crypto.timingSafeEqual(Buffer.from(sent), Buffer.from(expected));
  }
  if (ok) return next();

  if (req.file) fs.unlink(req.file.path, () => {}); // don't keep files from rejected requests
  if (typeof req.flash === "function")
    req.flash("error", "Your session expired. Please try again.");
  return res.redirect(303, req.originalUrl.split("?")[0]);
};

module.exports = { ensureCsrf, verifyCsrf };
