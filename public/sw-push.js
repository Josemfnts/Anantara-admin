// Service Worker de Bot Móvil — SOLO avisos push (encargo 5.2). Sin caché y
// SIN handler de `fetch` a propósito: index.html ya explica por qué (un SW mal
// hecho serviría versiones viejas del panel); este no toca ninguna petición,
// así que no puede servir nada rancio. Si algún día hace falta cachear algo,
// eso es OTRO service worker con OTRO alcance, no se le añade aquí.
//
// Se registra solo cuando alguien pulsa "Activar avisos" en Bot Móvil
// (src/lib/push.js → activarAvisos), nunca al cargar la app.

self.addEventListener('install', () => {
  // skipWaiting: no tiene sentido esperar a que se cierren pestañas viejas —
  // este SW no cambia nada de lo que ya se está viendo (no cachea, no
  // intercepta fetch), así que activarlo ya no rompe nada en curso.
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('push', (event) => {
  let payload = {}
  try {
    payload = event.data ? event.data.json() : {}
  } catch {
    // Fallback a texto plano si el bot manda algo que no es JSON.
    payload = { body: event.data ? event.data.text() : '' }
  }
  const { title, body, tag, url } = payload
  event.waitUntil(
    self.registration.showNotification(title || 'Anantara', {
      body,
      tag: tag || 'anantara',
      renotify: true,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      data: { url: url || '/?page=bot-movil' },
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url || '/?page=bot-movil'
  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      const mismoOrigen = allClients.find(c => {
        try { return new URL(c.url).origin === self.location.origin } catch { return false }
      })
      if (mismoOrigen) {
        if ('navigate' in mismoOrigen) {
          try { await mismoOrigen.navigate(url) } catch { /* algunos navegadores no lo dejan; nos quedamos igual */ }
        }
        return mismoOrigen.focus()
      }
      return self.clients.openWindow(url)
    })()
  )
})
