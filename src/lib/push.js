// Avisos push (encargo 5.2) — el bot (web-push + VAPID) manda el aviso;
// el panel solo activa/desactiva la suscripción del navegador y la guarda en
// `push_subscriptions` (sql/0028_push_subscriptions.sql del bot). RLS solo
// admin: el panel entra con su sesión.
//
// Funciones puras (testeadas en push.test.js): urlBase64ToUint8Array,
// filaDeSuscripcion, estadoAvisos. El resto son wrappers de navegador — no se
// testean con vitest (entorno node, sin window/navigator reales) y se
// comprueban a mano (Playwright / móvil real).
//
// Clave pública VAPID: es pública por definición (va en el payload que el
// navegador manda a push.apple.com/fcm.googleapis.com/…), puede ir en el
// código. Sobrescribible por VITE_VAPID_PUBLIC_KEY para rotarla sin tocar código.
const VAPID_PUBLIC_KEY_DEFAULT = 'BKXOOuQ0Xk9KtDsUcI2qaFgwPAJdAR9tnSQU7LJDW1n6Nuq3eXa0YIrtZWZS7nTE_j0kviLUGUrfA9z1MtJ3d_4'
export const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || VAPID_PUBLIC_KEY_DEFAULT

const USER_AGENT_MAX = 300

// PushManager.subscribe pide la clave del servidor como Uint8Array, no como el
// base64url que da VAPID. Conversión estándar (documentada por MDN / web.dev).
export function urlBase64ToUint8Array(base64url) {
  if (!base64url) throw new Error('Falta la clave pública VAPID')
  const padding = '='.repeat((4 - (base64url.length % 4)) % 4)
  const base64 = (base64url + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; i++) outputArray[i] = rawData.charCodeAt(i)
  return outputArray
}

// De PushSubscription.toJSON() a la fila que se guarda en push_subscriptions.
// Lanza si falta algo imprescindible: sin endpoint o sin claves el bot no
// podría mandar nada y guardaríamos basura silenciosa.
export function filaDeSuscripcion(subJSON, userAgent) {
  const endpoint = subJSON?.endpoint
  const p256dh = subJSON?.keys?.p256dh
  const auth = subJSON?.keys?.auth
  if (!endpoint) throw new Error('La suscripción no tiene endpoint')
  if (!p256dh || !auth) throw new Error('La suscripción no tiene claves (p256dh/auth)')
  return {
    endpoint,
    p256dh,
    auth,
    user_agent: (userAgent || '').slice(0, USER_AGENT_MAX),
    disabled_at: null,
  }
}

// Estado a pintar en Bot Móvil, a partir del entorno (navegador + BD). Cada
// rama es una situación real de campo:
//  - 'ios_instalar': iPhone/iPad en Safari suelto — Apple solo da Push a una
//    PWA añadida a la pantalla de inicio (iOS 16.4+). Antes de instalar, ni
//    lo intentamos: pedir permiso ahí no lleva a ningún sitio.
//  - 'no_soportado': navegador sin ServiceWorker/PushManager/Notification.
//  - 'bloqueado': el usuario ya dijo que no a nivel navegador.
//  - 'activo' / 'inactivo': con soporte y permiso, según haya o no suscripción.
export function estadoAvisos({ tieneSW, tienePush, tieneNotification, permiso, esIOS, esStandalone, suscrito }) {
  if (esIOS && !esStandalone) return 'ios_instalar'
  if (!tieneSW || !tienePush || !tieneNotification) return 'no_soportado'
  if (permiso === 'denied') return 'bloqueado'
  if (suscrito) return 'activo'
  return 'inactivo'
}

// Entorno actual SIN pedir permisos ni registrar nada nuevo — para pintar el
// estado al abrir la pantalla. getRegistration (no register) es la clave: si
// no hay SW registrado todavía, no se registra aquí.
export async function leerEstadoActual() {
  const tieneSW = typeof navigator !== 'undefined' && 'serviceWorker' in navigator
  const tienePush = typeof window !== 'undefined' && 'PushManager' in window
  const tieneNotification = typeof window !== 'undefined' && 'Notification' in window
  const permiso = tieneNotification ? Notification.permission : 'default'
  const ua = (typeof navigator !== 'undefined' && navigator.userAgent) || ''
  const esIOS = /iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1)
  const esStandalone = !!(
    (typeof window !== 'undefined' && window.matchMedia?.('(display-mode: standalone)')?.matches) ||
    (typeof navigator !== 'undefined' && navigator.standalone === true)
  )
  let suscrito = false
  if (tieneSW) {
    try {
      const reg = await navigator.serviceWorker.getRegistration('/')
      const sub = await reg?.pushManager?.getSubscription()
      suscrito = !!sub
    } catch { /* sin registro todavía: no suscrito */ }
  }
  return { tieneSW, tienePush, tieneNotification, permiso, esIOS, esStandalone, suscrito }
}

// SOLO desde un gesto del usuario (click): pedir permiso fuera de un gesto lo
// deniega el navegador sin ni preguntar en muchos casos, y en el resto es un
// antipatrón que quema el único permiso que se puede pedir.
export async function activarAvisos(sb) {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    throw new Error('Este navegador no admite avisos push')
  }
  const permiso = await Notification.requestPermission()
  if (permiso !== 'granted') throw new Error('Permiso de notificaciones denegado')

  const reg = await navigator.serviceWorker.register('/sw-push.js', { scope: '/' })
  await navigator.serviceWorker.ready

  let sub = await reg.pushManager.getSubscription()
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    })
  }

  const fila = filaDeSuscripcion(sub.toJSON(), navigator.userAgent)
  // onConflict endpoint: reactivar (el navegador puede devolver la misma
  // suscripción de antes) pone disabled_at a null de nuevo.
  const { data, error } = await sb.from('push_subscriptions')
    .upsert(fila, { onConflict: 'endpoint' })
    .select()
    .maybeSingle()
  if (error) throw new Error('No se pudo guardar la suscripción: ' + error.message)
  return data || fila
}

// Desactivar: unsubscribe en el navegador + borrar la fila. Si ya no había
// suscripción (p.ej. el navegador la limpió sola), no falla: no hay nada que
// desactivar y punto.
export async function desactivarAvisos(sb) {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return
  const reg = await navigator.serviceWorker.getRegistration('/')
  const sub = await reg?.pushManager?.getSubscription()
  if (!sub) return
  const endpoint = sub.endpoint
  await sub.unsubscribe()
  const { error } = await sb.from('push_subscriptions').delete().eq('endpoint', endpoint)
  if (error) throw new Error('No se pudo borrar la suscripción: ' + error.message)
}
