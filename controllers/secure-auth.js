// Handles sign-in, registration, logout, rate limits, and session setup.

// controllers/secure-auth.js
// ONE login for everyone (users + admins). The backend reads users.role and decides where to send the person.
// Brute-force protection (3 layers):
//   1. IP rate limit      - max 30 failed login attempts per 15 minutes per IP
//   2. Account lockout    - 5 wrong passwords = 15 min lock, 10 = 1 hour, 15+ = 24 hours
//   3. Argon2id hashing   - every guess is expensive, even if the database leaks
// Every failure shows the same message, and unknown emails cost the same time as real ones.

// MODULES AND IMPORTS
const rateLimit = require("express-rate-limit");
const fs = require("fs");
const query = require("../config/query");
const {hashPassword, verifyPassword, checkPasswordStrength, MAX_PASSWORD_LENGTH,} = require("../config/password");
const { logAdminAction } = require("../middleware/admin-activity");

const GENERIC_LOGIN_ERROR =
  "Invalid email or password, or the account is temporarily locked. Please try again.";

const validEmail = (v) =>
  v.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
const validPhone = (v) => /^\d{10,11}$/.test(v);
const validName = (v) => /^[\p{L}][\p{L}\p{M}\s.'-]{1,79}$/u.test(v);

// ---------- rate limiters ----------
const tooMany = (target) => (req, res) => {
  req.flash("error", "Too many attempts. Please wait a while and try again.");
  res.redirect(303, target);
};

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // only failed logins count
  requestWasSuccessful: (req, res) => res.locals.loginOk === true,
  handler: tooMany("/auth/login"),
});

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: tooMany("/auth/register"),
});

// ---------- helpers ----------
const flashes = (req, res) => ({
  success: res.locals.success || req.flash("success"),
  error: res.locals.error || req.flash("error"),
});

const adminCount = async () => {
  const rows = await query(
    "SELECT COUNT(*) AS total FROM users WHERE role = 'admin'",
  );
  return Number(rows[0].total) || 0;
};

const discardUpload = (req) => {
  if (req.file) fs.unlink(req.file.path, () => {});
};

// =====================================================
// Validate credentials and create the session after a successful login.
// =====================================================
exports.loginLimiter = loginLimiter;
exports.registerLimiter = registerLimiter;

exports.getLogin = async (req, res) => {
  try {
    const current = req.session && req.session.user;
    if (current) return res.redirect(current.role === "admin" ? "/admin" : "/");

    res.render("login", {
      user: null,
      allowSetup: (await adminCount()) === 0,
      ...flashes(req, res),
    });
  } catch (err) {
    console.error("Login page error:", err);
    res.status(500).send("Could not load the login page.");
  }
};

exports.login = async (req, res) => {
  const fail = (msg = GENERIC_LOGIN_ERROR) => {
    req.flash("error", msg);
    return res.redirect(303, "/auth/login");
  };

  try {
    const email = String(req.body.email || "")
      .trim()
      .toLowerCase();
    const pw = String(req.body.pw || "");
    if (!email || !pw) return fail("Please enter your email and password.");
    if (email.length > 254 || pw.length > MAX_PASSWORD_LENGTH) return fail();

    const rows = await query(
      `SELECT user_id, full_name, email, password_hash, profile_image, contact_number,
                    role, account_status, verification_status,
                    (locked_until IS NOT NULL AND locked_until > NOW()) AS is_locked
               FROM users WHERE email = ? LIMIT 1`,
      [email],
    );
    const user = rows[0];

    // Always run a hash check (even for unknown emails / locked accounts) so timing doesn't leak anything
    const { ok, needsRehash } = await verifyPassword(
      pw,
      user && user.password_hash,
    );

    if (!user) return fail();
    if (Number(user.is_locked)) return fail(); // locked: even the right password is refused

    if (!ok) {
      // locked_until is computed from the count BEFORE it is incremented (MySQL updates left to right)
      await query(
        `UPDATE users SET
                    locked_until = CASE
                        WHEN failed_login_attempts + 1 >= 15 THEN DATE_ADD(NOW(), INTERVAL 24 HOUR)
                        WHEN failed_login_attempts + 1 >= 10 THEN DATE_ADD(NOW(), INTERVAL 1 HOUR)
                        WHEN failed_login_attempts + 1 >= 5  THEN DATE_ADD(NOW(), INTERVAL 15 MINUTE)
                        ELSE locked_until END,
                    failed_login_attempts = failed_login_attempts + 1
                  WHERE user_id = ?`,
        [user.user_id],
      );
      console.warn(
        `[auth] failed login for user_id=${user.user_id} ip=${req.ip}`,
      );
      return fail();
    }

    if (user.account_status !== "active") {
      return fail(
        user.role === "admin"
          ? "Your admin account is inactive."
          : "Your account is inactive. Please contact support.",
      );
    }

    // Success: clear the failure counter and upgrade the hash if its settings are outdated
    await query(
      "UPDATE users SET failed_login_attempts = 0, locked_until = NULL, last_login_at = NOW() WHERE user_id = ?",
      [user.user_id],
    );
    if (needsRehash) {
      try {
        await query("UPDATE users SET password_hash = ? WHERE user_id = ?", [
          await hashPassword(pw),
          user.user_id,
        ]);
      } catch (e) {
        console.error("Rehash failed:", e);
      }
    }

    const isAdmin = user.role === "admin";

    // New session id on login (prevents session fixation)
    req.session.regenerate((err) => {
      if (err) {
        console.error(err);
        return fail("Could not create a secure login session.");
      }

      req.session.user = {
        user_id: user.user_id,
        username: user.full_name,
        full_name: user.full_name,
        email: user.email,
        profile_image: user.profile_image,
        num: user.contact_number,
        contact_number: user.contact_number,
        verification_status: user.verification_status,
        role: isAdmin ? "admin" : "user",
      };

      req.session.save(async (saveErr) => {
        if (saveErr) {
          console.error(saveErr);
          return fail("Could not save the login session.");
        }
        res.locals.loginOk = true;
        if (isAdmin)
          await logAdminAction(req, "LOGIN", {
            adminId: user.user_id,
            details: "Signed in",
          });
        req.flash("success", `Welcome back, ${user.full_name}!`);
        res.redirect(303, isAdmin ? "/admin" : "/");
      });
    });
  } catch (err) {
    console.error("Login error:", err);
    fail("Login failed. Please try again.");
  }
};

// =====================================================
// REGISTER (regular users; the first admin is created at /admin/register)
// =====================================================
exports.getRegister = (req, res) => {
  const current = req.session && req.session.user;
  if (current) return res.redirect(current.role === "admin" ? "/admin" : "/");

  let form = {};
  try {
    form = JSON.parse((req.flash("old") || [])[0] || "{}");
  } catch {
    form = {};
  }

  res.render("register", { user: null, form, ...flashes(req, res) });
};

exports.register = async (req, res) => {
  const fail = (msg, body = req.body) => {
    discardUpload(req);
    req.flash(
      "old",
      JSON.stringify({
        name: String(body.name || "").slice(0, 80),
        email: String(body.email || "").slice(0, 254),
        num: String(body.num || "").slice(0, 11),
      }),
    );
    req.flash("error", msg);
    return res.redirect(303, "/auth/register");
  };

  try {
    const name = String(req.body.name || "")
      .trim()
      .replace(/\s+/g, " ");
    const email = String(req.body.email || "")
      .trim()
      .toLowerCase();
    const num = String(req.body.num || "").trim();
    const pw = String(req.body.pw || "");
    const confirmPw = String(req.body.confirm_pw || "");

    if (!name || !email || !num || !pw)
      return fail("Please fill in every field.");
    if (!validName(name))
      return fail("Please enter your real full name (letters only).");
    if (!validEmail(email)) return fail("Please enter a valid email address.");
    if (!validPhone(num))
      return fail("Contact number must be 10 to 11 digits.");

    const weak = checkPasswordStrength(pw, { email, name });
    if (weak) return fail(weak);
    if (pw !== confirmPw)
      return fail("Password and confirmation do not match.");

    await query(
      `INSERT INTO users
                (full_name, email, password_hash, profile_image, contact_number,
                 role, account_status, verification_status)
             VALUES (?, ?, ?, ?, ?, 'user', 'active', 'pending')`,
      [
        name,
        email,
        await hashPassword(pw),
        req.file ? "/uploads/" + req.file.filename : null,
        num,
      ],
    );

    req.flash("success", "Account created! You can log in now.");
    res.redirect(303, "/auth/login");
  } catch (err) {
    console.error("Register error:", err);
    fail(
      err.code === "ER_DUP_ENTRY"
        ? "That email is already registered."
        : "Registration failed. Please try again.",
    );
  }
};

// =====================================================
// End the current session and send the visitor back to a public page.
// =====================================================
exports.logout = async (req, res) => {
  try {
    if (req.session && req.session.user && req.session.user.role === "admin") {
      await logAdminAction(req, "LOGOUT", { details: "Signed out" });
    }
  } catch (err) {
    console.error("Logout log error:", err);
  }

  if (!req.session) return res.redirect("/auth/login");
  req.session.destroy((err) => {
    if (err) console.error("Logout error:", err);
    res.clearCookie("connect.sid");
    res.redirect("/auth/login");
  });
};
