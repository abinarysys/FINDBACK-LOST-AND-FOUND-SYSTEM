// Markup for the notification bell that app.js adds to signed-in pages.

// config/global-bell.js
// The bell markup, injected by app.js into EVERY page a logged-in user sees
// (home, browse, profile, notifications...). A tiny script moves it INTO the page's top
// navigation (next to the account/profile picture). If a page has no navigation, it stays
// as a round floating button in the bottom-right corner.
module.exports = `
<link rel="stylesheet" href="/css/user/bell.css">
<div class="notif-bell-wrap" id="notifWidget">
    <div id="notifPanel" class="notif-panel" hidden>
        <div class="notif-panel-head">
            <strong>Notifications</strong>
            <button type="button" id="notifMarkAll" class="notif-link-btn">Mark all as read</button>
        </div>
        <div id="notifList" class="notif-panel-list"></div>
        <a href="/user/notifications" class="notif-panel-foot">View all notifications</a>
    </div>
    <button type="button" id="notifBell" class="notif-bell"
            aria-label="Notifications" aria-haspopup="true" aria-expanded="false">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
             stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"></path>
            <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
        </svg>
        <span id="notifBadge" class="notif-badge" hidden>0</span>
    </button>
<script>
(function () {
    var widget = document.getElementById('notifWidget');
    if (!widget) return;
    // New dashboard header (.u-nav-actions) or the public site navbar (.right-buttons)
    var host = document.querySelector('.u-nav-actions, .navbar .right-buttons');
    if (!host) return;
    host.insertBefore(widget, host.querySelector('.u-account, .profilepic'));
    widget.classList.add('inline');
    var publicNav = document.querySelector('header.navbar');
    if (publicNav) publicNav.classList.add('has-bell');   // keeps the nav (and bell) on screen while scrolling
})();
</script>
<script src="/socket.io/socket.io.js"></script>
<script src="/js/notify.js" defer></script>
`;
