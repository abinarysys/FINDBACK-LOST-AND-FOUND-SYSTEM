# Folder Structure

## Root
- app.js — Express, sessions, Socket.IO, middleware, routers, port 4000.
- package.json — dependencies and npm start (nodemon app).
- package-lock.json — generated dependency lock.
- findback.sql — base schema and seed rows; not a clean schema-only export.
- README.md — older overview/setup notes, partly stale.
- .env — private secrets/config; do not share.
- .gitignore — ignored files; .vscode/ — editor settings.

## config/
- db.js — MySQL pool and connection probe; reads DB_*.
- query.js — Promise wrapper around db.query.
- password.js — Argon2id, optional pepper, and password checks.
- theme.js — valid modes/colors and theme script.
- notify.js — persistent notification creation and socket emit.
- global-bell.js — notification widget markup injected into logged-in pages.
- admin-ui.js — admin formatting, escaping, images, dates and badges.

## controllers/
- secure-auth.js — login/register/logout and limiters.
- admin-controller.js — dashboard, users, items, verification, analytics, reports, settings, admins, profile.
- admin-claims-controller.js — claim list and transactional review.
- admin-extras-controller.js — extra admin handlers; not wired by admin-router.
- user-chat-controller.js — conversation access, messages, read markers, socket events.
- user-claims-controller.js — own claim list/detail.
- user-notifications-controller.js — notification page and APIs.

## middleware/
- security.js — Helmet and no-store headers.
- csrf.js — session token create/verify.
- auth-middleware.js — logged-in check.
- admin-middleware.js — admin locals and active-admin guard.
- upload-middleware.js — Multer disk storage, JPG/PNG/WebP, 5 MiB limit.
- user-middleware.js — makes session user an EJS local.
- user-theme.js — loads theme, falls back on errors.
- admin-activity.js — best-effort admin logging.

## routers/
- landing-router.js public home/browse/info/category pages.
- auth-router.js /auth forms, CSRF and rate limiters.
- admin-router.js /admin bootstrap and protected admin routes.
- lostItem-router.js, foundItem-router.js item form/inserts.
- claim-router.js found-item claim form/submission.
- feedback-router.js feedback insert.
- userprofile-router.js profile/edit/items.
- usersettings-router.js theme/delete account.
- userchat-router.js chat page/start/API.
- notification-router.js notification page/API.
- user-claims-router.js claim list/detail.

## sql/
claims-update.sql adds claim review and notification table; user-theme-notifications.sql extends notifications; chat.sql adds read marker/index; admin-update.sql creates logs; user-theme.sql adds theme columns but assumes verification_status exists.

## views/ and public/
views/ contains EJS pages and partials; public/css, public/js, public/img contain frontend assets; public/uploads contains uploaded files. See FRONTEND_GUIDE.md for each view and asset families.
