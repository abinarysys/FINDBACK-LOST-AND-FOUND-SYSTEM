// controllers/admin-extras-controller.js
// Settings, Manage Admins and Activity Logs (user accounts + admin activity).
const db = require('../config/db'); // mysql2/promise pool
const { logAdminAction, getAdminId } = require('../middleware/admin-activity');

/* ======================================================================
   ADJUST HERE: table / column names of YOUR users table
   ====================================================================== */
const U = {
  table: 'users',
  id: 'user_id',
  name: 'full_name',
  email: 'email',
  phone: 'contact_number',   // column used by your register form field "num"
  password: 'password',      // hashed password column
  role: 'role',              // column that marks an admin...
  roleValue: 'admin',        // ...and the value it has
  adminRole: 'admin_role',   // added by the migration (super_admin | admin)
  status: 'account_status',
  created: 'created_at'
};

/* ======================================================================
   ADJUST HERE: use the SAME hashing your existing admin register/login uses
   ====================================================================== */
async function hashPassword(plain) {
  let lib;
  try { lib = require('bcrypt'); } catch { lib = require('bcryptjs'); }
  return lib.hash(plain, 10);
}

/* ---------- helpers ---------- */
async function currentAdmin(req) {
  const id = getAdminId(req);
  if (!id) return null;
  const [rows] = await db.query(
    `SELECT ${U.id} AS id, ${U.name} AS name, ${U.adminRole} AS admin_role
       FROM ${U.table} WHERE ${U.id} = ? LIMIT 1`, [id]);
  return rows[0] || null;
}
const isSuper = (a) => !!a && a.admin_role === 'super_admin';

/* ---------- SETTINGS ---------- */
exports.getSettings = async (req, res) => {
  try {
    const me = await currentAdmin(req);
    res.render('admin/admin-settings', { isSuperAdmin: isSuper(me) });
  } catch (err) {
    console.error(err);
    res.status(500).send('Unable to load settings.');
  }
};

/* ---------- MANAGE ADMINS ---------- */
exports.getManageAdmins = async (req, res) => {
  try {
    const me = await currentAdmin(req);
    if (!isSuper(me)) {
      req.flash('error', 'Only a super admin can manage admins.');
      return res.redirect('/admin/settings');
    }
    const [admins] = await db.query(
      `SELECT ${U.id} AS user_id, ${U.name} AS full_name, ${U.email} AS email,
              ${U.adminRole} AS admin_role, ${U.status} AS account_status,
              ${U.created} AS created_at
         FROM ${U.table} WHERE ${U.role} = ? ORDER BY ${U.id} ASC`, [U.roleValue]);

    res.render('admin/admin-manage-admins', {
      admins,
      currentAdminId: me.id,
      success: req.flash('success'),
      error: req.flash('error')
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Unable to load admins.');
  }
};

exports.postAddAdmin = async (req, res) => {
  try {
    const me = await currentAdmin(req);
    if (!isSuper(me)) {
      req.flash('error', 'Only a super admin can add admins.');
      return res.redirect('/admin/settings');
    }

    const name  = String(req.body.name  || '').trim();
    const email = String(req.body.email || '').trim().toLowerCase();
    const phone = String(req.body.num   || '').trim();
    const pw    = String(req.body.pw    || '');
    const role  = req.body.role === 'super_admin' ? 'super_admin' : 'admin';

    if (!name || !email || !pw) {
      req.flash('error', 'Name, email and password are required.');
      return res.redirect('/admin/settings/admins');
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      req.flash('error', 'Please enter a valid email address.');
      return res.redirect('/admin/settings/admins');
    }
    if (pw.length < 8) {
      req.flash('error', 'Password must be at least 8 characters.');
      return res.redirect('/admin/settings/admins');
    }

    const [dup] = await db.query(
      `SELECT ${U.id} FROM ${U.table} WHERE ${U.email} = ? LIMIT 1`, [email]);
    if (dup.length) {
      req.flash('error', 'That email is already registered.');
      return res.redirect('/admin/settings/admins');
    }

    const hash = await hashPassword(pw);
    const [result] = await db.query(
      `INSERT INTO ${U.table}
         (${U.name}, ${U.email}, ${U.phone}, ${U.password}, ${U.role}, ${U.adminRole}, ${U.status})
       VALUES (?, ?, ?, ?, ?, ?, 'active')`,
      [name, email, phone || null, hash, U.roleValue, role]);

    await logAdminAction(req, 'ADD_ADMIN', {
      targetType: 'admin', targetId: result.insertId,
      details: `Added ${role === 'super_admin' ? 'super admin' : 'admin'} ${name} (${email})`
    });

    req.flash('success', `Admin "${name}" was added.`);
    res.redirect('/admin/settings/admins');
  } catch (err) {
    console.error(err);
    req.flash('error', 'Could not add the admin. Check the server log.');
    res.redirect('/admin/settings/admins');
  }
};

exports.postAdminStatus = async (req, res) => {
  try {
    const me = await currentAdmin(req);
    if (!isSuper(me)) {
      req.flash('error', 'Only a super admin can change admin status.');
      return res.redirect('/admin/settings');
    }

    const targetId = Number(req.params.id);
    const next = req.body.status === 'inactive' ? 'inactive' : 'active';

    if (targetId === Number(me.id)) {
      req.flash('error', 'You cannot change your own status.');
      return res.redirect('/admin/settings/admins');
    }

    const [rows] = await db.query(
      `SELECT ${U.name} AS name, ${U.adminRole} AS admin_role
         FROM ${U.table} WHERE ${U.id} = ? AND ${U.role} = ? LIMIT 1`,
      [targetId, U.roleValue]);
    if (!rows.length) {
      req.flash('error', 'Admin not found.');
      return res.redirect('/admin/settings/admins');
    }

    if (next === 'inactive' && rows[0].admin_role === 'super_admin') {
      const [[c]] = await db.query(
        `SELECT COUNT(*) AS n FROM ${U.table}
          WHERE ${U.role} = ? AND ${U.adminRole} = 'super_admin' AND ${U.status} = 'active'`,
        [U.roleValue]);
      if (c.n <= 1) {
        req.flash('error', 'You cannot disable the last active super admin.');
        return res.redirect('/admin/settings/admins');
      }
    }

    await db.query(`UPDATE ${U.table} SET ${U.status} = ? WHERE ${U.id} = ?`, [next, targetId]);

    await logAdminAction(req, next === 'active' ? 'ENABLE_ADMIN' : 'DISABLE_ADMIN', {
      targetType: 'admin', targetId, details: `${next === 'active' ? 'Enabled' : 'Disabled'} ${rows[0].name}`
    });

    req.flash('success', `${rows[0].name} is now ${next}.`);
    res.redirect('/admin/settings/admins');
  } catch (err) {
    console.error(err);
    req.flash('error', 'Could not update the admin.');
    res.redirect('/admin/settings/admins');
  }
};

/* ---------- ACTIVITY LOGS (tab 1: user accounts, tab 2: admin activity) ---------- */
exports.getActivityLogs = async (req, res) => {
  try {
    const me = await currentAdmin(req);
    const superAdmin = isSuper(me);
    let tab = req.query.tab === 'admins' ? 'admins' : 'users';

    if (tab === 'admins' && !superAdmin) {
      req.flash('error', 'Only a super admin can view admin activity.');
      tab = 'users';
    }

    // Tab 1 – same fields your current view already uses
    const [logs] = await db.query(
      `SELECT ${U.id} AS user_id, ${U.name} AS full_name, ${U.email} AS email,
              ${U.status} AS account_status
         FROM ${U.table} ORDER BY ${U.id} DESC`);

    // Tab 2 – admin activity
    let adminLogs = [], adminOptions = [], actionOptions = [];
    const filters = { admin: req.query.admin || '', action: req.query.action || '' };

    if (tab === 'admins') {
      const where = [], params = [];
      if (filters.admin)  { where.push('l.admin_id = ?'); params.push(Number(filters.admin)); }
      if (filters.action) { where.push('l.action = ?');   params.push(filters.action); }

      [adminLogs] = await db.query(
        `SELECT l.log_id, l.admin_id, l.action, l.target_type, l.target_id, l.details,
                l.ip_address, l.created_at,
                u.${U.name} AS admin_name, u.${U.email} AS admin_email
           FROM admin_activity_logs l
           LEFT JOIN ${U.table} u ON u.${U.id} = l.admin_id
          ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
          ORDER BY l.created_at DESC, l.log_id DESC
          LIMIT 500`, params);

      [adminOptions] = await db.query(
        `SELECT ${U.id} AS id, ${U.name} AS name FROM ${U.table}
          WHERE ${U.role} = ? ORDER BY ${U.name}`, [U.roleValue]);
      [actionOptions] = await db.query(
        `SELECT DISTINCT action FROM admin_activity_logs ORDER BY action`);
    }

    res.render('admin/admin-activity-logs', {
      logs, tab, adminLogs, adminOptions, actionOptions, filters,
      isSuperAdmin: superAdmin,
      error: req.flash('error')
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Unable to load activity logs.');
  }
};
