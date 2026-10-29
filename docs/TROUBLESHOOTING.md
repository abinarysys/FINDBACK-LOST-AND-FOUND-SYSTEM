# Troubleshooting

| Symptom | Source-based check |
|---|---|
| Startup missing SESSION_SECRET | Add it to private .env; app.js throws without it. |
| DB connection/query errors | Check MySQL and DB_* values, selected DB, and schema migrations. |
| Unknown auth columns | Base dump omits verification_status and login failure/lock/last-login fields expected at runtime. |
| Theme defaults | user-theme.js catches query failure; inspect theme migration and verification_status prerequisite. |
| Claims/notifications fail | Apply claim and notification migrations; verify runtime claimed vs SQL comment reserved. |
| Chat read state fails | chat.sql adds last_read_message_id and index. |
| Admin logs missing | admin-update.sql creates table; logging is best effort. |
| Upload rejected | JPG/PNG/WebP only, max 5 MiB; check multipart field name and destination permissions. |
| Image URL 404 | Default upload folder must be public/uploads; custom path outside public isn't served automatically. |
| Auth form CSRF redirect | Reload form for token/session; include _csrf. CSRF is not attached to every mutating route. |
| Redirected to login | auth middleware needs req.session.user; check cookie and stable session secret. |
| Socket unauthorized | Socket requires logged-in session user_id. |
| CSS/JS missing | Static root is public/; check EJS asset URL. |
| Empty category | Check categories and IDs 1-7 mapping in landing-router. |

package.json declares no automated tests/healthcheck. No live DB was inspected.
