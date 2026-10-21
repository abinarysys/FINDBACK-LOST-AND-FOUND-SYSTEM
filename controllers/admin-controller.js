// Handles admin dashboard pages and user, item, report, and profile actions.

// controllers/admin-controller.js
const query = require("../config/query");
const {
  hashPassword,
  verifyPassword,
  checkPasswordStrength,
} = require("../config/password");
const { imgUrl } = require("../config/admin-ui");
const { logAdminAction } = require("../middleware/admin-activity");

const toId = (v) => {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
};
const validPhone = (v) => /^\d{10,11}$/.test(v);
const validEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

// Runs a query on admin_activity_logs; if you haven't run sql/admin-update.sql yet
// the page still opens (empty) instead of crashing.
let logsMissing = false;
const safeLogsQuery = async (sql, params = []) => {
  try {
    return await query(sql, params);
  } catch (err) {
    if (err.code === "ER_NO_SUCH_TABLE") {
      logsMissing = true;
      return [];
    }
    throw err;
  }
};

const showError = (res, err, message) => {
  console.error(message, err);
  res.status(500).render("admin/admin-error", {
    title: "Something went wrong",
    code: 500,
    message,
  });
};

// =====================================================
// Admin sign-in, first-account setup, and logout handlers.
// =====================================================
const adminCount = async () => {
  const rows = await query(
    "SELECT COUNT(*) AS total FROM users WHERE role = 'admin'",
  );
  return Number(rows[0].total) || 0;
};

// Admins no longer have their own login page. Everyone signs in at /auth/login and the backend
// (controllers/secure-auth.js) sends admins to /admin. These stubs keep old links and routes working.
exports.getLogin = (req, res) => res.redirect("/auth/login");
exports.login = (req, res) => res.redirect(303, "/auth/login");

// First-admin setup only. After one admin exists, new admins are added in Settings.
exports.getRegister = async (req, res) => {
  try {
    if ((await adminCount()) > 0) {
      req.flash(
        "error",
        "Admin sign-up is closed. Ask an existing admin to add you in Settings.",
      );
      return res.redirect("/admin/login");
    }
    res.render("admin/adminRegister");
  } catch (err) {
    showError(res, err, "Could not load the setup page.");
  }
};

exports.register = async (req, res) => {
  try {
    if ((await adminCount()) > 0) {
      req.flash(
        "error",
        "Admin sign-up is closed. Ask an existing admin to add you in Settings.",
      );
      return res.redirect("/admin/login");
    }

    const name = String(req.body.name || "").trim();
    const email = String(req.body.email || "")
      .trim()
      .toLowerCase();
    const num = String(req.body.num || "").trim();
    const pw = String(req.body.pw || "");

    if (!name || !email || !pw) {
      req.flash("error", "Name, email and password are required.");
      return res.redirect("/admin/register");
    }
    if (!validEmail(email)) {
      req.flash("error", "Please enter a valid email address.");
      return res.redirect("/admin/register");
    }
    if (num && !validPhone(num)) {
      req.flash("error", "Contact number must be 10 to 11 digits.");
      return res.redirect("/admin/register");
    }
    const weak = checkPasswordStrength(pw, { email, name });
    if (weak) {
      req.flash("error", weak);
      return res.redirect("/admin/register");
    }

    const result = await query(
      `INSERT INTO users
                (full_name, email, password_hash, profile_image, contact_number,
                 role, account_status, verification_status)
             VALUES (?, ?, ?, ?, ?, 'admin', 'active', 'verified')`,
      [
        name,
        email,
        await hashPassword(pw),
        req.file ? "/uploads/" + req.file.filename : null,
        num || null,
      ],
    );

    await logAdminAction(req, "SETUP_ADMIN", {
      adminId: result.insertId,
      targetType: "admin",
      targetId: result.insertId,
      details: "Created the first admin account",
    });

    req.flash("success", "Admin account created. You can sign in now.");
    res.redirect("/admin/login");
  } catch (err) {
    console.error("Admin setup error:", err);
    req.flash(
      "error",
      err.code === "ER_DUP_ENTRY"
        ? "Email is already registered."
        : "Setup failed. Please try again.",
    );
    res.redirect("/admin/register");
  }
};

exports.logout = async (req, res) => {
  await logAdminAction(req, "LOGOUT", { details: "Signed out" });
  req.session.destroy((err) => {
    if (err) return showError(res, err, "Could not log out. Please try again.");
    res.clearCookie("connect.sid");
    res.redirect("/auth/login");
  });
};

// =====================================================
// Dashboard data and the main admin landing page.
// =====================================================
exports.getDashboard = async (req, res) => {
  try {
    const [counts, recentReports, pendingUsers, recentActivity] =
      await Promise.all([
        query(`SELECT
                (SELECT COUNT(*) FROM users WHERE role = 'user') AS users,
                (SELECT COUNT(*) FROM users WHERE role = 'user' AND verification_status = 'pending') AS pendingVerifications,
                (SELECT COUNT(*) FROM lost_items) AS lost,
                (SELECT COUNT(*) FROM found_items) AS found,
                (SELECT COUNT(*) FROM claims WHERE status = 'pending') AS pendingClaims,
                (SELECT COUNT(*) FROM feedback) AS feedback`),
        query(`SELECT * FROM (
                      SELECT li.lost_item_id AS id, li.item_name, 'Lost' AS report_type,
                             u.full_name AS reported_by, li.created_at, li.status
                        FROM lost_items li LEFT JOIN users u ON li.user_id = u.user_id
                      UNION ALL
                      SELECT fi.found_item_id, fi.item_name, 'Found',
                             u.full_name, fi.created_at, fi.status
                        FROM found_items fi LEFT JOIN users u ON fi.user_id = u.user_id
                   ) r ORDER BY created_at DESC LIMIT 6`),
        query(`SELECT user_id, full_name, email, profile_image, created_at
                     FROM users WHERE role = 'user' AND verification_status = 'pending'
                    ORDER BY created_at DESC LIMIT 5`),
        safeLogsQuery(`SELECT l.log_id, l.action, l.details, l.created_at, u.full_name AS admin_name
                             FROM admin_activity_logs l LEFT JOIN users u ON u.user_id = l.admin_id
                            ORDER BY l.created_at DESC, l.log_id DESC LIMIT 6`),
      ]);

    res.render("admin/adminDashboard", {
      title: "Dashboard",
      activePage: "dashboard",
      stats: counts[0],
      recentReports,
      pendingUsers,
      recentActivity,
    });
  } catch (err) {
    showError(res, err, "Could not load the dashboard.");
  }
};

// =====================================================
// Admin actions for listing and updating user accounts.
// =====================================================
exports.getUsers = async (req, res) => {
  try {
    const users = await query(`
            SELECT user_id, full_name, email, contact_number, profile_image,
                   account_status, verification_status, created_at
              FROM users WHERE role = 'user'
             ORDER BY created_at DESC`);

    res.render("admin/admin-users", {
      title: "Manage Users",
      activePage: "users",
      users,
    });
  } catch (err) {
    showError(res, err, "Could not retrieve users.");
  }
};

exports.updateUserStatus = async (req, res) => {
  const userId = toId(req.params.id);
  const { status } = req.body;

  if (!userId)
    return res
      .status(400)
      .json({ success: false, message: "Invalid user ID." });
  if (!["active", "inactive"].includes(status)) {
    return res
      .status(400)
      .json({ success: false, message: "Status must be active or inactive." });
  }

  try {
    const rows = await query(
      "SELECT full_name FROM users WHERE user_id = ? AND role = 'user'",
      [userId],
    );
    if (!rows.length)
      return res
        .status(404)
        .json({ success: false, message: "User not found." });

    await query("UPDATE users SET account_status = ? WHERE user_id = ?", [
      status,
      userId,
    ]);
    await logAdminAction(
      req,
      status === "active" ? "ACTIVATE_USER" : "DEACTIVATE_USER",
      {
        targetType: "user",
        targetId: userId,
        details: `${status === "active" ? "Activated" : "Deactivated"} ${rows[0].full_name}`,
      },
    );

    res.json({
      success: true,
      message: `${rows[0].full_name} is now ${status}.`,
    });
  } catch (err) {
    console.error("Update user status error:", err);
    res
      .status(500)
      .json({ success: false, message: "Could not update user status." });
  }
};

// =====================================================
// ITEMS (lost + found on one page, two tabs)
// =====================================================
const loadItems = async () => {
  const [lost, found] = await Promise.all([
    query(`SELECT li.lost_item_id AS id, li.item_name, li.description, li.location,
                      li.date_lost AS item_date, li.status, li.created_at, li.photo_path,
                      (SELECT image_path FROM item_images ii WHERE ii.lost_item_id = li.lost_item_id
                        ORDER BY ii.image_id LIMIT 1) AS extra_image,
                      u.full_name AS reporter, u.email AS reporter_email,
                      u.contact_number AS reporter_contact, c.category_name
                 FROM lost_items li
                 LEFT JOIN users u ON li.user_id = u.user_id
                 LEFT JOIN item_categories c ON li.category_id = c.category_id
                ORDER BY li.created_at DESC`),
    query(`SELECT fi.found_item_id AS id, fi.item_name, fi.description, fi.location,
                      fi.date_found AS item_date, fi.status, fi.created_at, fi.photo_path,
                      (SELECT image_path FROM item_images ii WHERE ii.found_item_id = fi.found_item_id
                        ORDER BY ii.image_id LIMIT 1) AS extra_image,
                      u.full_name AS reporter, u.email AS reporter_email,
                      u.contact_number AS reporter_contact, c.category_name
                 FROM found_items fi
                 LEFT JOIN users u ON fi.user_id = u.user_id
                 LEFT JOIN item_categories c ON fi.category_id = c.category_id
                ORDER BY fi.created_at DESC`),
  ]);
  const prep = (rows) =>
    rows.map((r) => ({ ...r, photo: imgUrl(r.photo_path || r.extra_image) }));
  return { lostItems: prep(lost), foundItems: prep(found) };
};

const renderItems = (tab) => async (req, res) => {
  try {
    res.render("admin/admin-lost-items", {
      title: "Manage Items",
      activePage: "items",
      tab,
      ...(await loadItems()),
    });
  } catch (err) {
    showError(res, err, "Could not retrieve items.");
  }
};
exports.getLostItems = renderItems("lost");
exports.getFoundItems = renderItems("found");

// =====================================================
// Admin review of user verification records.
// =====================================================
exports.getUserVerification = async (req, res) => {
  try {
    const users = await query(`
            SELECT user_id, full_name, email, contact_number, profile_image,
                   created_at, verification_status, account_status
              FROM users WHERE role = 'user'
             ORDER BY CASE WHEN verification_status = 'pending' THEN 0 ELSE 1 END, created_at DESC`);

    res.render("admin/admin-user-verification", {
      title: "User Verification",
      activePage: "verification",
      users,
    });
  } catch (err) {
    showError(res, err, "Could not load user verification.");
  }
};

exports.updateVerificationStatus = async (req, res) => {
  const userId = toId(req.params.id);
  const { status } = req.body;

  if (!userId)
    return res
      .status(400)
      .json({ success: false, message: "Invalid user ID." });
  if (!["verified", "rejected", "pending"].includes(status)) {
    return res
      .status(400)
      .json({ success: false, message: "Invalid verification status." });
  }

  try {
    const rows = await query(
      "SELECT full_name FROM users WHERE user_id = ? AND role = 'user'",
      [userId],
    );
    if (!rows.length)
      return res
        .status(404)
        .json({ success: false, message: "User not found." });

    await query("UPDATE users SET verification_status = ? WHERE user_id = ?", [
      status,
      userId,
    ]);

    const action = {
      verified: "APPROVE_USER",
      rejected: "REJECT_USER",
      pending: "RESET_VERIFICATION",
    }[status];
    await logAdminAction(req, action, {
      targetType: "user",
      targetId: userId,
      details: `${rows[0].full_name} → ${status}`,
    });

    res.json({
      success: true,
      message: `${rows[0].full_name} marked as ${status}.`,
    });
  } catch (err) {
    console.error("Update verification error:", err);
    res.status(500).json({
      success: false,
      message: "Could not update verification status.",
    });
  }
};

// =====================================================
// Summary counts and activity metrics for the analytics page.
// =====================================================
exports.getAnalytics = async (req, res) => {
  try {
    const [
      userStats,
      lostStats,
      foundStats,
      claimStats,
      monthlyRows,
      categoryRows,
      recentClaims,
    ] = await Promise.all([
      query(`SELECT COUNT(*) AS totalUsers,
                              SUM(CASE WHEN account_status = 'active' THEN 1 ELSE 0 END) AS activeUsers,
                              SUM(CASE WHEN verification_status = 'verified' THEN 1 ELSE 0 END) AS verifiedUsers,
                              SUM(CASE WHEN verification_status = 'pending' THEN 1 ELSE 0 END) AS pendingUsers
                         FROM users WHERE role = 'user'`),
      query("SELECT COUNT(*) AS totalLost FROM lost_items"),
      query("SELECT COUNT(*) AS totalFound FROM found_items"),
      query(`SELECT SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) AS approvedClaims,
                              SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pendingClaims,
                              COUNT(*) AS totalClaims
                         FROM claims`),
      query(`SELECT months.month,
                              DATE_FORMAT(STR_TO_DATE(CONCAT(months.month, '-01'), '%Y-%m-%d'), '%b') AS label,
                              COALESCE(lost.total, 0) AS lostItems,
                              COALESCE(found.total, 0) AS foundItems
                         FROM (SELECT DATE_FORMAT(DATE_SUB(CURDATE(), INTERVAL n MONTH), '%Y-%m') AS month
                                 FROM (SELECT 0 AS n UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3
                                       UNION ALL SELECT 4 UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7
                                       UNION ALL SELECT 8 UNION ALL SELECT 9 UNION ALL SELECT 10 UNION ALL SELECT 11) numbers
                              ) months
                         LEFT JOIN (SELECT DATE_FORMAT(created_at, '%Y-%m') AS month, COUNT(*) AS total
                                      FROM lost_items GROUP BY DATE_FORMAT(created_at, '%Y-%m')) lost
                                ON lost.month = months.month
                         LEFT JOIN (SELECT DATE_FORMAT(created_at, '%Y-%m') AS month, COUNT(*) AS total
                                      FROM found_items GROUP BY DATE_FORMAT(created_at, '%Y-%m')) found
                                ON found.month = months.month
                        ORDER BY months.month ASC`),
      query(`SELECT c.category_name, COUNT(items.category_id) AS total
                         FROM item_categories c
                         LEFT JOIN (SELECT category_id FROM lost_items
                                    UNION ALL SELECT category_id FROM found_items) items
                                ON items.category_id = c.category_id
                        GROUP BY c.category_id, c.category_name
                        ORDER BY total DESC LIMIT 5`),
      query(`SELECT cl.claim_id, cl.status, cl.created_at, u.full_name,
                              fi.item_name, c.category_name
                         FROM claims cl
                         LEFT JOIN users u ON cl.user_id = u.user_id
                         LEFT JOIN found_items fi ON cl.found_item_id = fi.found_item_id
                         LEFT JOIN item_categories c ON fi.category_id = c.category_id
                        ORDER BY cl.created_at DESC LIMIT 6`),
    ]);

    const categoryTotal = categoryRows.reduce(
      (s, r) => s + Number(r.total || 0),
      0,
    );

    res.render("admin/admin-analytics", {
      title: "Analytics",
      activePage: "analytics",
      analytics: {
        users: {
          totalUsers: Number(userStats[0]?.totalUsers) || 0,
          activeUsers: Number(userStats[0]?.activeUsers) || 0,
          verifiedUsers: Number(userStats[0]?.verifiedUsers) || 0,
          pendingUsers: Number(userStats[0]?.pendingUsers) || 0,
        },
        lostItems: Number(lostStats[0]?.totalLost) || 0,
        foundItems: Number(foundStats[0]?.totalFound) || 0,
        claims: {
          totalClaims: Number(claimStats[0]?.totalClaims) || 0,
          approvedClaims: Number(claimStats[0]?.approvedClaims) || 0,
          pendingClaims: Number(claimStats[0]?.pendingClaims) || 0,
        },
        monthlyItems: monthlyRows.map((r) => ({
          month: r.month,
          label: r.label,
          lostItems: Number(r.lostItems) || 0,
          foundItems: Number(r.foundItems) || 0,
        })),
        categoryStats: categoryRows.map((r) => ({
          category_name: r.category_name,
          total: Number(r.total) || 0,
          percentage: categoryTotal
            ? Math.round((Number(r.total) / categoryTotal) * 100)
            : 0,
        })),
        recentClaims,
      },
    });
  } catch (err) {
    showError(res, err, "Could not load analytics.");
  }
};

// =====================================================
// Admin report pages and their supporting data.
// =====================================================
exports.getReports = async (req, res) => {
  try {
    const [userCount, lostCount, foundCount, reports, reportCategories] =
      await Promise.all([
        query("SELECT COUNT(*) AS total FROM users WHERE role = 'user'"),
        query("SELECT COUNT(*) AS total FROM lost_items"),
        query("SELECT COUNT(*) AS total FROM found_items"),
        query(`SELECT * FROM (
                      SELECT li.lost_item_id AS id, li.item_name, 'Lost' AS report_type,
                             u.full_name AS reported_by, li.created_at,
                             COALESCE(li.status, 'pending') AS status
                        FROM lost_items li LEFT JOIN users u ON li.user_id = u.user_id
                      UNION ALL
                      SELECT fi.found_item_id, fi.item_name, 'Found',
                             u.full_name, fi.created_at, COALESCE(fi.status, 'pending')
                        FROM found_items fi LEFT JOIN users u ON fi.user_id = u.user_id
                   ) r ORDER BY created_at DESC LIMIT 50`),
        query(`SELECT c.category_name,
                          (SELECT COUNT(*) FROM lost_items li WHERE li.category_id = c.category_id) +
                          (SELECT COUNT(*) FROM found_items fi WHERE fi.category_id = c.category_id) AS total
                     FROM item_categories c ORDER BY total DESC`),
      ]);

    const totalLost = Number(lostCount[0].total) || 0;
    const totalFound = Number(foundCount[0].total) || 0;

    res.render("admin/admin-reports", {
      title: "Reports",
      activePage: "reports",
      totalUsers: Number(userCount[0].total) || 0,
      totalLost,
      totalFound,
      totalReports: totalLost + totalFound,
      reports,
      reportCategories,
    });
  } catch (err) {
    showError(res, err, "Could not load reports.");
  }
};

// =====================================================
// ACTIVITY LOGS  (tab: admins | accounts)
// =====================================================
exports.getActivityLogs = async (req, res) => {
  try {
    const tab = req.query.tab === "accounts" ? "accounts" : "admins";
    const filters = {
      admin: toId(req.query.admin) || "",
      action: String(req.query.action || ""),
    };

    const where = [];
    const params = [];
    if (filters.admin) {
      where.push("l.admin_id = ?");
      params.push(filters.admin);
    }
    if (filters.action) {
      where.push("l.action = ?");
      params.push(filters.action);
    }

    logsMissing = false;
    const [adminLogs, actionOptions, adminOptions, accounts] =
      await Promise.all([
        safeLogsQuery(
          `SELECT l.log_id, l.admin_id, l.action, l.target_type, l.target_id, l.details,
                        l.ip_address, l.created_at, u.full_name AS admin_name, u.email AS admin_email,
                        u.profile_image AS admin_image
                   FROM admin_activity_logs l LEFT JOIN users u ON u.user_id = l.admin_id
                   ${where.length ? "WHERE " + where.join(" AND ") : ""}
                  ORDER BY l.created_at DESC, l.log_id DESC LIMIT 500`,
          params,
        ),
        safeLogsQuery(
          "SELECT DISTINCT action FROM admin_activity_logs ORDER BY action",
        ),
        query(
          "SELECT user_id, full_name FROM users WHERE role = 'admin' ORDER BY full_name",
        ),
        tab === "accounts"
          ? query(`SELECT user_id, full_name, email, role, account_status, verification_status,
                                profile_image, created_at
                           FROM users ORDER BY created_at DESC LIMIT 500`)
          : Promise.resolve([]),
      ]);

    res.render("admin/admin-activity-logs", {
      title: "Activity Logs",
      activePage: "activity-logs",
      tab,
      filters,
      adminLogs,
      actionOptions,
      adminOptions,
      accounts,
      logsMissing,
    });
  } catch (err) {
    showError(res, err, "Could not load activity logs.");
  }
};

// =====================================================
// SETTINGS (appearance + manage admins)
// =====================================================
exports.getSettings = async (req, res) => {
  try {
    const [admins, logins] = await Promise.all([
      query(`SELECT user_id, full_name, email, contact_number, profile_image,
                          account_status, created_at
                     FROM users WHERE role = 'admin' ORDER BY created_at ASC`),
      safeLogsQuery(`SELECT admin_id, MAX(created_at) AS last_login
                             FROM admin_activity_logs WHERE action = 'LOGIN' GROUP BY admin_id`),
    ]);
    const lastLogin = Object.fromEntries(
      logins.map((l) => [l.admin_id, l.last_login]),
    );

    res.render("admin/admin-settings", {
      title: "Settings",
      activePage: "settings",
      admins: admins.map((a) => ({
        ...a,
        last_login: lastLogin[a.user_id] || null,
      })),
      currentAdminId: req.admin.user_id,
      currentAdminEmail: req.admin.email,
    });
  } catch (err) {
    showError(res, err, "Could not load settings.");
  }
};

exports.addAdmin = async (req, res) => {
  try {
    const name = String(req.body.name || "").trim();
    const email = String(req.body.email || "")
      .trim()
      .toLowerCase();
    const num = String(req.body.num || "").trim();
    const pw = String(req.body.pw || "");
    const confirmPw = String(req.body.confirm_password || "");

    const back = (msg) => {
      req.flash("error", msg);
      return res.redirect("/admin/settings");
    };

    // Verify that the person adding an admin really owns the signed-in admin account
    if (!confirmPw)
      return back("Enter your own password to confirm adding a new admin.");
    const me = await query(
      "SELECT password_hash FROM users WHERE user_id = ? AND role = 'admin' LIMIT 1",
      [req.admin.user_id],
    );
    if (
      !me.length ||
      !(await verifyPassword(confirmPw, me[0].password_hash)).ok
    ) {
      await logAdminAction(req, "ADD_ADMIN_DENIED", {
        targetType: "admin",
        details: "Add admin blocked: wrong confirmation password",
      });
      return back("Your password is incorrect. The new admin was not created.");
    }

    if (!name || !email || !pw)
      return back("Name, email and password are required.");
    if (!validEmail(email)) return back("Please enter a valid email address.");
    if (num && !validPhone(num))
      return back("Contact number must be 10 to 11 digits.");
    const weak = checkPasswordStrength(pw, { email, name });
    if (weak) return back(weak);

    const dup = await query(
      "SELECT user_id FROM users WHERE email = ? LIMIT 1",
      [email],
    );
    if (dup.length) return back("That email is already registered.");

    const result = await query(
      `INSERT INTO users
                (full_name, email, password_hash, contact_number, role, account_status, verification_status)
             VALUES (?, ?, ?, ?, 'admin', 'active', 'verified')`,
      [name, email, await hashPassword(pw), num || null],
    );

    await logAdminAction(req, "ADD_ADMIN", {
      targetType: "admin",
      targetId: result.insertId,
      details: `Added admin ${name} (${email})`,
    });

    req.flash(
      "success",
      `Admin "${name}" was added. Share the temporary password with them privately.`,
    );
    res.redirect("/admin/settings");
  } catch (err) {
    console.error("Add admin error:", err);
    req.flash("error", "Could not add the admin.");
    res.redirect("/admin/settings");
  }
};

exports.updateAdminStatus = async (req, res) => {
  const adminId = toId(req.params.id);
  const { status } = req.body;

  if (!adminId)
    return res
      .status(400)
      .json({ success: false, message: "Invalid admin ID." });
  if (!["active", "inactive"].includes(status)) {
    return res
      .status(400)
      .json({ success: false, message: "Status must be active or inactive." });
  }
  if (adminId === Number(req.admin.user_id)) {
    return res
      .status(400)
      .json({ success: false, message: "You cannot change your own status." });
  }

  try {
    const rows = await query(
      "SELECT full_name FROM users WHERE user_id = ? AND role = 'admin'",
      [adminId],
    );
    if (!rows.length)
      return res
        .status(404)
        .json({ success: false, message: "Admin not found." });

    if (status === "inactive") {
      const active = await query(
        "SELECT COUNT(*) AS total FROM users WHERE role = 'admin' AND account_status = 'active' AND user_id <> ?",
        [adminId],
      );
      if (Number(active[0].total) < 1) {
        return res.status(400).json({
          success: false,
          message: "You cannot disable the last active admin.",
        });
      }
    }

    await query("UPDATE users SET account_status = ? WHERE user_id = ?", [
      status,
      adminId,
    ]);
    await logAdminAction(
      req,
      status === "active" ? "ENABLE_ADMIN" : "DISABLE_ADMIN",
      {
        targetType: "admin",
        targetId: adminId,
        details: `${status === "active" ? "Enabled" : "Disabled"} ${rows[0].full_name}`,
      },
    );

    res.json({
      success: true,
      message: `${rows[0].full_name} is now ${status}.`,
    });
  } catch (err) {
    console.error("Update admin status error:", err);
    res
      .status(500)
      .json({ success: false, message: "Could not update the admin." });
  }
};

// =====================================================
// View and update the signed-in administrator's profile.
// =====================================================
exports.getProfile = (req, res) => {
  res.render("admin/admin-profile", {
    title: "My Profile",
    activePage: "profile",
  });
};

exports.updateProfile = async (req, res) => {
  try {
    const name = String(req.body.name || "").trim();
    const num = String(req.body.num || "").trim();

    if (!name) {
      req.flash("error", "Name is required.");
      return res.redirect("/admin/profile");
    }
    if (num && !validPhone(num)) {
      req.flash("error", "Contact number must be 10 to 11 digits.");
      return res.redirect("/admin/profile");
    }

    const image = req.file
      ? "/uploads/" + req.file.filename
      : req.admin.profile_image;

    await query(
      "UPDATE users SET full_name = ?, contact_number = ?, profile_image = ? WHERE user_id = ?",
      [name, num || null, image, req.admin.user_id],
    );

    Object.assign(req.session.user, {
      full_name: name,
      username: name,
      num: num || null,
      profile_image: image,
    });
    await logAdminAction(req, "UPDATE_PROFILE", {
      targetType: "admin",
      targetId: req.admin.user_id,
      details: "Updated profile details",
    });

    req.flash("success", "Profile updated.");
    res.redirect("/admin/profile");
  } catch (err) {
    console.error("Update profile error:", err);
    req.flash("error", "Could not update your profile.");
    res.redirect("/admin/profile");
  }
};

exports.changePassword = async (req, res) => {
  try {
    const { current, next, confirm } = req.body;
    const back = (msg) => {
      req.flash("error", msg);
      return res.redirect("/admin/profile");
    };

    if (!current || !next || !confirm)
      return back("Please fill in all password fields.");
    if (next !== confirm)
      return back("New password and confirmation do not match.");
    if (next === current)
      return back("New password must be different from your current password.");
    const weak = checkPasswordStrength(next, {
      email: req.admin.email,
      name: req.admin.full_name,
    });
    if (weak) return back(weak);

    const rows = await query(
      "SELECT password_hash FROM users WHERE user_id = ?",
      [req.admin.user_id],
    );
    if (
      !rows.length ||
      !(await verifyPassword(current, rows[0].password_hash)).ok
    )
      return back("Your current password is incorrect.");

    await query("UPDATE users SET password_hash = ? WHERE user_id = ?", [
      await hashPassword(next),
      req.admin.user_id,
    ]);
    await logAdminAction(req, "CHANGE_PASSWORD", {
      targetType: "admin",
      targetId: req.admin.user_id,
      details: "Changed password",
    });

    req.flash("success", "Password changed.");
    res.redirect("/admin/profile");
  } catch (err) {
    console.error("Change password error:", err);
    req.flash("error", "Could not change your password.");
    res.redirect("/admin/profile");
  }
};

// =====================================================
// 404 inside /admin
// =====================================================
exports.notFound = (req, res) => {
  res.status(404).render("admin/admin-error", {
    title: "Page not found",
    code: 404,
    message: "That admin page does not exist.",
  });
};
