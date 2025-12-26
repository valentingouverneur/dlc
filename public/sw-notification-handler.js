// Gestionnaire de notifications pour le Service Worker
// Ce fichier sera injecté dans le Service Worker généré par vite-plugin-pwa

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SHOW_NOTIFICATION') {
    const { title, options } = event.data;
    self.registration.showNotification(title, {
      ...options,
      badge: '/icon-192x192.png',
      icon: options.icon || '/icon-192x192.png',
      tag: options.tag || 'default',
      requireInteraction: options.requireInteraction || false,
      silent: false
    });
  }
});

// Gérer les clics sur les notifications
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Si une fenêtre est déjà ouverte, la focus
      for (const client of clientList) {
        if (client.url === '/' && 'focus' in client) {
          return client.focus();
        }
      }
      // Sinon, ouvrir une nouvelle fenêtre
      if (clients.openWindow) {
        return clients.openWindow('/');
      }
    })
  );
});

