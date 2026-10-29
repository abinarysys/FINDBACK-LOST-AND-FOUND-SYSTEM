# Frontend Guide

## Rendering
app.js sets EJS; res.render('name', locals) uses views/name.ejs. EJS <%= %> outputs escaped values; <% %> runs template logic. Handlers provide locals such as user/items/claims/admin. app.js injects flash/currentPath and decorates eligible signed-in non-admin pages with theme and bell markup.

## Views (individual purposes)
Public: index.ejs home; browseitems.ejs browsing; contact.ejs contact; howitworks.ejs instructions; login.ejs/register.ejs auth; submitLostItem.ejs/submitFoundItem.ejs forms; claim.ejs claim form. Category listing templates: bags.ejs, clothing.ejs, electronics.ejs, idandcards.ejs, keys.ejs, wallets.ejs, others.ejs.
User: user-profile.ejs dashboard; profile_edit.ejs edit; items.ejs own reports; claims.ejs claim list; claim-details.ejs claim detail; notifications.ejs alerts; chat.ejs messaging; settings.ejs appearance; delete-account.ejs confirmation. Partials: navbar, user-header, user-sidebar, public-footer. views/user/user-sidebar.ejs is empty; populated sidebar is in partials.
Admin: adminDashboard, admin-users, admin-lost-items, admin-claims, admin-user-verification, admin-analytics, admin-reports, admin-activity-logs, admin-activity-tab, admin-settings, admin-manage-admins, admin-profile, adminLogin, adminRegister, admin-error templates serve the corresponding admin pages. Partials: head, foot, flash, sidebar, admin-sidebar. Shared auth partials: auth-nav/auth-flash.

## CSS and browser JS
CSS files under public/css: public-base.css, index.css, browse.css, category.css, contact.css, howitworks.css, claim.css; auth.css, login.css, register.css, submitLostItems.css, submitFoundItems.css; admin.css, admin-sidebar.css; user styles: public/css/user/*.css. Inspect each view link to confirm the active stylesheet.
public/js/chat.js handles chat API/live UI; notify.js notification API/live updates; theme.js theme; admin.js admin interactions. Root js/notify.js also exists but app serves public/, so it is not the injected /js/notify.js.
public/img has logo/icons/category art/local illustrations. public/uploads holds user images, not source assets. Multer accepts JPG/PNG/WebP up to 5 MiB.
