// Service Worker untuk handle push notification
self.addEventListener('push', function (event) {
  if (!event.data) return

  let data = {}
  try {
    data = event.data.json()
  } catch (e) {
    data = { title: 'Gastron', body: event.data.text() }
  }

  const title = data.title || 'Gastron - Sistem Pengajuan'
  const options = {
    body: data.body || '',
    icon: '/logo-gastron.png',
    badge: '/logo-gastron.png',
    data: {
      url: data.url || '/dashboard',
    },
    vibrate: [200, 100, 200],
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

// Klik notif → buka/fokus ke app, navigate ke url yang dikirim
self.addEventListener('notificationclick', function (event) {
  event.notification.close()
  const url = event.notification.data?.url || '/dashboard'

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(url)
          return client.focus()
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(url)
      }
    })
  )
})
