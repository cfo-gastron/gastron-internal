import { supabase } from './supabase'

// Public VAPID key — aman ditaruh di frontend
const VAPID_PUBLIC_KEY = 'BNx7AVZrBkmUnkbnjazhcJLntWI60d60_SxbqOrE6lvA53EfdAtX5DgBAmYLMTPqDjAVzs3DQ2OJvqMixR09ei0'

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

// Cek apakah browser/device support push notif
export function isPushSupported() {
  return 'serviceWorker' in navigator && 'PushManager' in window
}

// Minta permission + subscribe + simpan ke Supabase
export async function subscribeToPush(userId) {
  if (!isPushSupported()) {
    console.warn('Push notification tidak didukung di device ini')
    return { success: false, reason: 'not_supported' }
  }

  try {
    // Register service worker
    const registration = await navigator.serviceWorker.register('/sw.js')
    await navigator.serviceWorker.ready

    // Minta permission
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') {
      return { success: false, reason: 'permission_denied' }
    }

    // Cek subscription existing
    let subscription = await registration.pushManager.getSubscription()
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      })
    }

    const subJson = subscription.toJSON()

    // Simpan ke Supabase (upsert berdasarkan user_id + endpoint)
    const { error } = await supabase.from('push_subscriptions').upsert(
      {
        user_id: userId,
        endpoint: subJson.endpoint,
        p256dh: subJson.keys.p256dh,
        auth: subJson.keys.auth,
      },
      { onConflict: 'user_id,endpoint' }
    )

    if (error) throw error

    return { success: true }
  } catch (err) {
    console.error('Gagal subscribe push notif:', err)
    return { success: false, reason: 'error', error: err }
  }
}

// Cek status permission saat ini (tanpa minta lagi)
export function getPushPermissionStatus() {
  if (!isPushSupported()) return 'unsupported'
  return Notification.permission // 'granted' | 'denied' | 'default'
}
