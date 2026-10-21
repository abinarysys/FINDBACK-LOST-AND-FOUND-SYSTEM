// Legacy copy of the browser notification script; the served version is in public/js.

const socket = io();

function showNotificationToast(notification) {
  let container = document.querySelector(".notification-toast-container");

  if (!container) {
    container = document.createElement("div");
    container.className = "notification-toast-container";

    Object.assign(container.style, {
      position: "fixed",
      top: "85px",
      right: "20px",
      zIndex: "9999",
      display: "flex",
      flexDirection: "column",
      gap: "10px",
      width: "min(360px, calc(100vw - 32px))",
    });

    document.body.appendChild(container);
  }

  const toast = document.createElement("div");

  Object.assign(toast.style, {
    padding: "16px 20px",
    background: "#fff",
    color: "#17131D",
    border: "1px solid #E7E2ED",
    borderLeft: "4px solid #7C18FF",
    borderRadius: "12px",
    boxShadow: "0 5px 20px rgba(45, 32, 75, 0.12)",
    fontFamily: "Poppins, sans-serif",
    cursor: notification.link ? "pointer" : "default",
  });

  const title = document.createElement("strong");
  title.textContent = notification.title || "New notification";

  const message = document.createElement("p");
  message.textContent = notification.message || "";

  Object.assign(message.style, {
    fontSize: "12px",
    lineHeight: "1.7",
    margin: "8px 0 0",
  });

  toast.append(title, message);

  if (notification.link) {
    toast.addEventListener("click", () => {
      window.location.href = notification.link;
    });
  }

  container.appendChild(toast);

  setTimeout(() => {
    toast.remove();

    if (container.childElementCount === 0) {
      container.remove();
    }
  }, 5000);
}

socket.on("connect", () => {
  console.log("Connected to FINDBACK Socket.IO!", socket.id);
});

socket.on("notification", (notification) => {
  console.log("New notification received:", notification);
  showNotificationToast(notification);
});

socket.on("disconnect", () => {
  console.log("Disconnected from FINDBACK Socket.IO.");
});

socket.on("connect_error", (error) => {
  console.error("Socket.IO connection error:", error.message);
});
// Legacy root-level notification script. Express serves public/ as its static root,
// so the active browser script is public/js/notify.js rather than this file.
