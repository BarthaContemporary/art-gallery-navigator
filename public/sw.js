
self.addEventListener('push', function(event) {
  if (event.data) {
    const data = event.data.json();
    const options = {
      body: data.body,
      icon: '/lovable-uploads/3ba18906-49f8-43ba-ad34-1ff106219d42.png',
      badge: '/lovable-uploads/3ba18906-49f8-43ba-ad34-1ff106219d42.png',
      tag: 'chat-message',
      data: data.data,
      requireInteraction: true,
      actions: [
        {
          action: 'reply',
          title: 'Reply'
        },
        {
          action: 'view',
          title: 'View Chat'
        }
      ]
    };

    event.waitUntil(
      self.registration.showNotification(data.title, options)
    );
  }
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();

  if (event.action === 'reply') {
    // Handle reply action
    event.waitUntil(
      clients.openWindow('/chat')
    );
  } else if (event.action === 'view') {
    // Handle view action
    event.waitUntil(
      clients.openWindow('/chat')
    );
  } else {
    // Default click action
    event.waitUntil(
      clients.openWindow('/chat')
    );
  }
});

self.addEventListener('install', function(event) {
  self.skipWaiting();
});

self.addEventListener('activate', function(event) {
  event.waitUntil(self.clients.claim());
});
