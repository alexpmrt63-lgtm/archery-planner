// Service Worker — Archery Planner Push Notifications

self.addEventListener('push', event => {
  const data = event.data?.json() ?? {};
  const title = data.title || 'Archery Planner';
  const options = {
    body:    data.body  || '',
    icon:    '/icon.png',   // remplace par ton icône si dispo
    badge:   '/badge.png',
    tag:     data.tag  || 'archery-notification',
    renotify: true,
    data:    { url: data.url || '/' },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      // Réutilise un onglet déjà ouvert si possible
      const existing = list.find(c => c.url.includes(self.location.origin));
      if (existing) return existing.focus();
      return clients.openWindow(url);
    })
  );
});
