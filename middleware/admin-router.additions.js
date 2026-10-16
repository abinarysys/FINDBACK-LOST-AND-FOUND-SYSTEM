// Paste into routers/admin-router.js (adjust requireAdmin to your real middleware name)
const extras = require('../controllers/admin-extras-controller');
const { requireAdmin } = require('../middleware/admin-middleware'); // <- your existing admin guard

// REPLACE your existing settings + activity-logs routes with these:
router.get('/settings',                    requireAdmin, extras.getSettings);
router.get('/settings/admins',             requireAdmin, extras.getManageAdmins);
router.post('/settings/admins',            requireAdmin, extras.postAddAdmin);
router.post('/settings/admins/:id/status', requireAdmin, extras.postAdminStatus);
router.get('/activity-logs',               requireAdmin, extras.getActivityLogs);

// Make sure express.urlencoded({ extended: true }) is enabled in app.js (forms use POST bodies).
// Remove the public GET /register and POST /register/user routes once you are happy with this.
