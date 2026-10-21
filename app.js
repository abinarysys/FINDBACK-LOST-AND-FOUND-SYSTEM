// Start the web server and connect the application's shared services.

// Load environment settings before configuring the server.
require("dotenv").config(); 
const express = require("express");
const session = require("express-session");
const http = require("http");
const { Server } = require("socket.io");
const flash = require("connect-flash");


const { applySecurity } = require("./middleware/security");

if (!process.env.SESSION_SECRET) {
  throw new Error(
    "SESSION_SECRET is missing. Add SESSION_SECRET=<long random text> to your .env file.",
  );
}

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Trust the first proxy when deployed behind a reverse proxy.
app.set("trust proxy", 1); 

// Limit request-body size before parsing form and JSON submissions.
app.use(express.urlencoded({ extended: true, limit: "50kb" }));
app.use(express.json({ limit: "100kb" }));

// ---------- session (one config, shared with socket.io) ----------
const sessionMiddleware = session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true, // JavaScript in the page can't read the cookie
    sameSite: "lax", // blocks most cross-site request tricks
    secure: process.env.NODE_ENV === "production", // HTTPS only in production
    maxAge: 1000 * 60 * 60 * 8, // 8 hours
  },
});
app.use(sessionMiddleware);
io.engine.use(sessionMiddleware); // needs socket.io 4.6+ (run: npm ls socket.io)

// Make one-time success and error messages available to every template.
app.use(flash());
app.use((req, res, next) => {
  res.locals.success = req.flash("success");
  res.locals.error = req.flash("error");
  next();
});

app.use(express.static("public"));
app.set("view engine", "ejs");

app.set("io", io);

// Only a session-authenticated user may open a live socket connection.
io.use((socket, next) => {
  if (!socket.request.session?.user?.user_id) {
    return next(new Error("unauthorized"));
  }
  next();
});

io.on("connection", (socket) => {
  const sessUser = socket.request.session?.user;
  if (sessUser) {
    socket.join(`user:${sessUser.user_id}`); // private room per user
    if (sessUser.role === "admin") socket.join("admins");
  }
  console.log("A user connected:", socket.id);
  socket.on("disconnect", () => console.log("A user disconnected:", socket.id));
});

// Import the account middleware and the upload handler.
const userMiddleware = require("./middleware/user-middleware.js");
const upload = require("./middleware/upload-middleware.js");

// Apply account middleware before handling page and API routes.
app.use(userMiddleware);

// currentPath lets the navigation highlight the page you are on; the theme is loaded per user.
app.use((req, res, next) => {
  res.locals.currentPath = req.path;
  next();
});
app.use(require("./middleware/user-theme.js"));

// Extras added to every page for logged-in users (admin pages are skipped):
//  1. the user's saved theme, applied at the top of <head> so there is no flash of the wrong theme
//     (dark mode only on pages built on the new design, i.e. pages that contain the .u-hero banner)
//  2. the notification bell
const globalBell = require("./config/global-bell.js");
const { themeScript } = require("./config/theme.js");

app.use((req, res, next) => {
  const user = req.session?.user;
  if (!user || req.path.startsWith("/admin")) return next();

  const render = res.render.bind(res);
  res.render = (view, options, callback) => {
    if (typeof options === "function") {
      callback = options;
      options = undefined;
    }
    if (callback) return render(view, options, callback); // caller wants the raw HTML

    render(view, options, (err, html) => {
      if (err) return next(err);

      if (typeof html === "string") {
        const head = html.match(/<head[^>]*>/i);
        if (head) {
          // Dark mode is opt-in per page: account pages (.u-hero) or any page whose
          // <body> tag has the data-theme-aware attribute. Guests never reach this code.
          const darkOk =
            html.includes('class="u-hero"') ||
            /<body[^>]*\sdata-theme-aware/i.test(html);
          const script = themeScript(user.theme, darkOk);
          html = html.replace(head[0], () => head[0] + script);
        }

        const end = html.toLowerCase().lastIndexOf("</body>");
        if (end !== -1 && !html.includes('id="notifBell"')) {
          html = html.slice(0, end) + globalBell + html.slice(end);
        }
      }
      res.send(html);
    });
  };
  next();
});

// Mount each group of routes beneath its public URL prefix.
app.use("/", require("./routers/landing-router.js"));
app.use("/auth", require("./routers/auth-router.js")); // the new secure login/register (see routers/auth-router.js)
app.use("/fb", require("./routers/feedback-router.js"));
app.use("/lost", require("./routers/lostItem-router.js"));
app.use("/found", require("./routers/foundItem-router.js"));
app.use("/admin", require("./routers/admin-router.js"));
app.use("/user", require("./routers/userprofile-router.js"));
app.use("/claim", require("./routers/claim-router.js"));
app.use("/user/settings", require("./routers/usersettings-router.js"));
app.use("/user/chat", require("./routers/userchat-router.js"));
app.use("/user/notifications", require("./routers/notification-router.js"));
app.use("/user/claims", require("./routers/user-claims-router.js"));

server.listen(4000, () => {
  console.log("FINDBACK running at http://localhost:4000");
});
