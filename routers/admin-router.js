// routers/admin-router.js
const router = require('express').Router();

const adminMiddleware = require('../middleware/admin-middleware.js');
const adminController = require('../controllers/admin-controller.js');
const upload = require('../middleware/upload-middleware.js');

// Runs multer but turns upload errors (wrong file type, too big) into a friendly message.
const uploadPfp = (redirectTo) => (req, res, next) =>
    upload.single('pfp')(req, res, (err) => {
        if (err) {
            req.flash('error', err.message || 'Could not upload that image.');
            return res.redirect(redirectTo);
        }
        next();
    });

// View helpers (icons, date formatting...) for every admin page, including login
router.use(adminMiddleware.locals);

// =====================================================
// PUBLIC ADMIN PAGES (no login needed)
// =====================================================
router.get('/login', adminController.getLogin);
router.post('/login/user', adminController.login);

// First-admin setup only. Closes itself once an admin exists.
router.get('/register', adminController.getRegister);
router.post('/register/user', uploadPfp('/admin/register'), adminController.register);

// =====================================================
// EVERYTHING BELOW REQUIRES AN ACTIVE ADMIN
// =====================================================
router.use(adminMiddleware);

router.get('/logout', adminController.logout);

// Dashboard
router.get('/', adminController.getDashboard);

// Manage Users
router.get('/users', adminController.getUsers);
router.patch('/users/:id/status', adminController.updateUserStatus);

// Manage Items (lost + found share one page)
router.get('/lost-items', adminController.getLostItems);
router.get('/found-items', adminController.getFoundItems);

// User Verification
router.get('/user-verification', adminController.getUserVerification);
router.patch('/users/:id/verification', adminController.updateVerificationStatus);

// Analytics, Reports, Activity Logs
router.get('/analytics', adminController.getAnalytics);
router.get('/reports', adminController.getReports);
router.get('/activity-logs', adminController.getActivityLogs);

// Settings (appearance + manage admins)
router.get('/settings', adminController.getSettings);
router.post('/settings/admins', adminController.addAdmin);
router.patch('/settings/admins/:id/status', adminController.updateAdminStatus);

// My Profile (separate from Settings)
router.get('/profile', adminController.getProfile);
router.post('/profile', uploadPfp('/admin/profile'), adminController.updateProfile);
router.post('/profile/password', adminController.changePassword);

// Unknown /admin/... URL
router.use(adminController.notFound);

module.exports = router;
