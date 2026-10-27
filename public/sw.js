// Service worker used only to show game alarm notifications (phones do not
// allow `new Notification()` from a page). Tapping one opens the calendar.

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      const calendar = clients.find((client) => client.url.includes("/calendar"));
      if (calendar) return calendar.focus();
      return self.clients.openWindow("/calendar");
    })
  );
});
