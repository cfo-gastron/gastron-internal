console.log('[SW] Service worker loaded')

self.addEventListener('install', () => {
  console.log('[SW] Installed')
  self.skipWaiting()
})

self.addEventListener('activate', () => {
  console.log('[SW] Activated')
})

self.addEventListener('push', function (event) {
  console.log('[SW] Push received:', event.data?.text())

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
    data: { url: data.url || '/dashboard' },
    vibrate: [200, 100, 200],
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

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
      if (clients.openWindow) return clients.openWindow(url)
    })
  )
})