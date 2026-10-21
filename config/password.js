// Password helpers for strength checks, secure hashing, and verification.

// utils/password.js
// Argon2id hashing (+ optional server-side pepper) and the password strength rules.
// Old SHA-256 hashes are NOT accepted anymore (they are weak and fast to crack).
// If you still have old accounts you want to keep for a short time, set
// ALLOW_LEGACY_SHA256=true in .env: they can log in once and get upgraded to Argon2id.
const argon2 = require("argon2");
const crypto = require("crypto");

// Optional "pepper": a secret kept in .env (NOT in the database). Even if the database leaks,
// the hashes can't be cracked without it. If you set it, never lose or change it,
// or every existing password stops working.
const PEPPER = process.env.PASSWORD_PEPPER || "";
if (PEPPER && PEPPER.length < 32) {
  throw new Error("PASSWORD_PEPPER must be at least 32 characters long.");
}
const secret = PEPPER ? Buffer.from(PEPPER, "utf8") : undefined;

// Argon2id: 46 MiB memory, 2 passes, 1 lane (OWASP-recommended range). Raise memoryCost if your server is strong.
const OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 47104,
  timeCost: 2,
  parallelism: 1,
};
const hashOptions = () => (secret ? { ...OPTIONS, secret } : OPTIONS);
const verifyOptions = () => (secret ? { secret } : undefined);

const MAX_PASSWORD_LENGTH = 128;
const ALLOW_LEGACY = process.env.ALLOW_LEGACY_SHA256 === "true";

const legacySha256 = (text) =>
  crypto.createHash("sha256").update(String(text)).digest("hex");
const isArgon2 = (hash) =>
  typeof hash === "string" && hash.startsWith("$argon2");

const hashPassword = (plain) => argon2.hash(String(plain), hashOptions());

// A real hash used to burn the same CPU time when the account doesn't exist,
// so response time doesn't reveal which emails are registered.
let dummyHash;
const getDummyHash = async () =>
  (dummyHash ||= await argon2.hash("dummy-password-for-timing", hashOptions()));

/**
 * @returns {Promise<{ ok: boolean, needsRehash: boolean }>}
 */
const verifyPassword = async (plain, stored) => {
  plain = String(plain || "");

  if (!stored || plain.length > MAX_PASSWORD_LENGTH) {
    await argon2
      .verify(
        await getDummyHash(),
        plain.slice(0, MAX_PASSWORD_LENGTH),
        verifyOptions(),
      )
      .catch(() => false);
    return { ok: false, needsRehash: false };
  }

  if (isArgon2(stored)) {
    let ok = false;
    try {
      ok = await argon2.verify(stored, plain, verifyOptions());
    } catch {
      ok = false;
    }
    return { ok, needsRehash: ok && argon2.needsRehash(stored, OPTIONS) };
  }

  if (!ALLOW_LEGACY) {
    // Not an Argon2 hash and legacy is off: treat as a failed login (still burns the same time).
    await argon2
      .verify(await getDummyHash(), plain, verifyOptions())
      .catch(() => false);
    return { ok: false, needsRehash: false };
  }

  // Legacy SHA-256 hex digest (timing-safe compare), upgraded right after a successful login
  const a = Buffer.from(legacySha256(plain));
  const b = Buffer.from(String(stored));
  const ok = a.length === b.length && crypto.timingSafeEqual(a, b);
  return { ok, needsRehash: ok };
};

// =====================================================
// Check the submitted password against the app's strength requirements.
// =====================================================
// Easy words/patterns that must not appear anywhere inside the password
const BANNED_WORDS = [
  "password",
  "passw0rd",
  "admin",
  "welcome",
  "letmein",
  "iloveyou",
  "findback",
  "qwerty",
  "asdfgh",
  "zxcvbn",
  "azerty",
  "login",
  "secret",
  "monkey",
  "dragon",
  "football",
  "abc123",
  "unknown",
  "changeme",
  "lostandfound",
  "phinma",
];

// 3+ characters in a row going up or down: 123, 987, abc, cba (case-insensitive)
const hasSequence = (s, len = 3) => {
  const t = s.toLowerCase();
  let up = 1,
    down = 1;
  for (let i = 1; i < t.length; i++) {
    const d = t.charCodeAt(i) - t.charCodeAt(i - 1);
    const alnum = /[a-z0-9]/.test(t[i]) && /[a-z0-9]/.test(t[i - 1]);
    up = alnum && d === 1 ? up + 1 : 1;
    down = alnum && d === -1 ? down + 1 : 1;
    if (up >= len || down >= len) return true;
  }
  return false;
};

// Same character 3+ times in a row: aaa, 111, !!!
const hasRepeat = (s) => /(.)\1\1/.test(s);

// Keyboard rows, forwards or backwards: qwe, asd, zxc, 789 ...
const ROWS = ["qwertyuiop", "asdfghjkl", "zxcvbnm", "1234567890"];
const hasKeyboardRun = (s, len = 3) => {
  const t = s.toLowerCase();
  return ROWS.some((row) => {
    const rev = [...row].reverse().join("");
    for (let i = 0; i + len <= row.length; i++) {
      if (
        t.includes(row.slice(i, i + len)) ||
        t.includes(rev.slice(i, i + len))
      )
        return true;
    }
    return false;
  });
};

// Undo common letter swaps so "P@ssw0rd" is caught as "password"
const deleet = (s) =>
  s
    .toLowerCase()
    .replace(/@/g, "a")
    .replace(/0/g, "o")
    .replace(/[1!|]/g, "i")
    .replace(/3/g, "e")
    .replace(/[$5]/g, "s")
    .replace(/7/g, "t");

/** Returns an error message, or null if the password is acceptable. */

const checkPasswordStrength = (pw) => {
  pw = String(pw || "");

  if (pw.length < 8) {
    return "Password must be at least 8 characters.";
  }

  if (pw.length > MAX_PASSWORD_LENGTH) {
    return "Password must be 128 characters or fewer.";
  }

  if (!/[a-zA-Z]/.test(pw)) {
    return "Password must contain at least one letter.";
  }

  if (!/\d/.test(pw)) {
    return "Password must contain at least one number.";
  }

  return null;
};

module.exports = {
  hashPassword,
  verifyPassword,
  checkPasswordStrength,
  MAX_PASSWORD_LENGTH,
};
