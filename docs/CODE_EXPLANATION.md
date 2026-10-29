# Code Explanation

## app.js, in order
1. Loads dotenv; creates Express, HTTP server and Socket.IO.
2. Throws if SESSION_SECRET is missing.
3. Applies Helmet, form/JSON parsers with body limits.
4. Configures one eight-hour session, shares it with Socket.IO; cookie is httpOnly, SameSite=Lax, secure in production.
5. Enables flash messages, serves public/, selects EJS.
6. Rejects unauthenticated sockets; joins server-derived user:<id> room and admins room for admins.
7. Adds user/currentPath/theme locals and render decoration.
8. Mounts routers and listens on port 4000.
The render decorator injects theme script and notification bell into eligible signed-in non-admin HTML via string matching.

## Database/config
config/db.js makes mysql2 pool and logs a connection probe. config/query.js converts callback query to Promise. Use SQL ? params for values. config/password.js exports hashPassword, verifyPassword, checkPasswordStrength, MAX_PASSWORD_LENGTH; it uses Argon2id with optional pepper and accepts Argon2 hashes only. config/theme.js allowlists theme values. config/notify.js creates durable rows and emits to user room. config/admin-ui.js exports template helpers.

## Middleware
auth-middleware checks req.session.user. admin-middleware.locals populates view helpers; requireAdmin verifies role and rereads active status. csrf.js generates and timing-safely compares tokens; auth-router uses it. upload-middleware saves random filenames, accepts JPG/PNG/WebP up to 5 MiB. user-theme loads DB theme once in session and falls back to default. admin-activity logs best effort.

## Route/controller behavior
- landing-router loads public pages and combines lost/found rows for categories.
- lostItem-router/foundItem-router accept multipart form, validate fields/photo, insert with session user ID, flash and redirect.
- claim-router permits found items only; validates availability, prevents self/duplicate pending claims, inserts, emits claim:new.
- secure-auth.js handles login/register/logout, password checks, lockout fields, session regeneration and role redirect.
- userprofile-router loads safe profile fields, user-owned items/claims, edits profile/image.
- usersettings-router saves allowlisted theme; delete flow verifies password, anonymizes data, destroys session.
- user-chat-controller verifies participant membership; lists/sends messages, updates read marker, emits events.
- user-notifications-controller scopes list/read/count by session user.
- user-claims-controller filters claim IDs by session owner.
- admin-claims-controller.getClaims joins item/user/category; updateClaimStatus locks rows and updates claim/item/notification in one transaction, emits after commit.
- admin-controller exports getDashboard, getUsers/updateUserStatus, getLostItems/getFoundItems, getUserVerification/updateVerificationStatus, getAnalytics/getReports/getActivityLogs, settings/admin/profile/password handlers, notFound. admin-extras-controller duplicates some alternate functions but router does not use it.
- feedback-router inserts rating/message for logged-in user.

## Inputs/outputs
Route params, query, body, uploaded files and session are inputs. Handlers respond with rendered EJS, redirects/flash, JSON, or errors. EJS locals are named data; Socket.IO is live delivery, not durable storage.


## Beginner walkthrough

For a detailed syntax guide and a connected walkthrough of the profile, items, chat, database helpers, middleware, routers, and controllers, see [BEGINNER_CODE_WALKTHROUGH.md](BEGINNER_CODE_WALKTHROUGH.md).
