# Installation and Setup

Prerequisites: Node.js/npm and MySQL. Run npm install. Root README's sample dependency command is stale/misspelled; package.json is authoritative.

Create a private .env with required SESSION_SECRET and DB_USER/DB_PASSWORD; optional DB_HOST (localhost), DB_NAME (copy). Optional NODE_ENV=production, PASSWORD_PEPPER (32+ chars, preserve it), UPLOAD_DIR (default public/uploads). Never share secret values.

Review findback.sql before importing: it includes seed rows. Review/apply sql/*.sql against a local DB and resolve the missing columns described in DATABASE_GUIDE.md; ALTERs may fail when repeated. Run npm start; package script runs nodemon app. Server listens on port 4000; browse http://localhost:4000.

Upload middleware creates default upload folder. DB connection error is logged but code does not stop server explicitly. No tests, migration runner, build/deploy script or configurable port is declared.
