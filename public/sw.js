self.addEventListener("push", (event) => {
  event.waitUntil(
    (async () => {
      let data;
      try {
        data = event.data.json();
      } catch {
        return;
      }
      if (!data || typeof data.title !== "string") return;
      const expired = data.expiresAt && Date.now() > data.expiresAt;
      await self.registration.showNotification(
        expired ? "시간표 알림" : data.title,
        {
          body: expired
            ? "알림이 늦게 도착했습니다. 최신 시간표를 확인해 주세요."
            : typeof data.body === "string"
              ? data.body
              : "",
          icon: "/favicon.svg",
          tag: data.tag || "bssm",
          silent: !!data.silent,
          data: {
            url:
              data.url === "/#/notifications"
                ? "/#/notifications"
                : "/#/dashboard",
          },
        },
      );
    })(),
  );
});
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    (async () => {
      const target = new URL(
        event.notification.data?.url === "/#/notifications"
          ? "/#/notifications"
          : "/#/dashboard",
        self.location.origin,
      ).href;
      const windows = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      for (const client of windows) {
        if (new URL(client.url).origin === self.location.origin) {
          await client.navigate(target);
          return client.focus();
        }
      }
      return self.clients.openWindow(target);
    })(),
  );
});
