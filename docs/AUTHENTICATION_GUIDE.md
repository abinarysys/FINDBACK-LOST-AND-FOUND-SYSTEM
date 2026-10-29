# Authentication Guide

Registration GET /auth/register renders register.ejs with CSRF token. POST is rate-limited, uploads required pfp, verifies CSRF/image, validates name/email/phone/password/confirmation, hashes and inserts role=user, active, verification_status=pending. Duplicate email is handled.

Login GET /auth/login renders login.ejs or redirects existing users by role. POST limiter + CSRF precede handler. Email is normalized; hash check runs even for unknown emails. Inactive/locked accounts are refused. Failed counters/lock times are updated; successful login resets them, optionally upgrades hash, regenerates session ID, saves user identity/role, redirects. Limits: 30 failed logins/15 minutes/IP; 10 registrations/hour/IP. Account thresholds 5/10/15 create 15-minute/1-hour/24-hour locks.

config/password.js uses Argon2id (memoryCost 47104, timeCost 2, parallelism 1). PASSWORD_PEPPER is optional, minimum 32 chars, and must remain stable. Login accepts Argon2 hashes only; unrecognized formats are rejected. Strength checker enforces 8–128 chars, letter, digit. DB stores hashes, never plaintext.

SESSION_SECRET is required. Cookie httpOnly, SameSite=Lax, secure in production, eight hours. No external store is configured, so default MemoryStore applies. Logout destroys session. User middleware checks signed-in state; admin guard rechecks DB role/status. First admin registration closes after an admin exists. Socket.IO uses session identity and server-assigned rooms.

CSRF helper applies to auth login/register. Other item/claim/admin/settings/profile mutation routes do not consistently use verifyCsrf. Helmet CSP is disabled because inline scripts/handlers exist; review before deployment.
