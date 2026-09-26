import { describe, it, expect } from 'vitest'
import { urlBase64ToUint8Array, filaDeSuscripcion, estadoAvisos } from './push.js'

describe('urlBase64ToUint8Array', () => {
  it('convierte una clave base64url VAPID típica en Uint8Array', () => {
    const out = urlBase64ToUint8Array('BKXOOuQ0Xk9KtDsUcI2qaFgwPAJdAR9tnSQU7LJDW1n6Nuq3eXa0YIrtZWZS7nTE_j0kviLUGUrfA9z1MtJ3d_4')
    expect(out).toBeInstanceOf(Uint8Array)
    expect(out.length).toBe(65) // clave pública EC P-256 sin comprimir
  })

  it('acepta - y _ (base64url) donde base64 normal llevaría + y /', () => {
    // '+//+' en base64 estándar es '-__-' en base64url (sin padding). Si el
    // reemplazo no ocurriera, atob la rechazaría por caracteres inválidos.
    const out = urlBase64ToUint8Array('-__-')
    expect(Array.from(out)).toEqual([0xfb, 0xff, 0xfe])
  })

  it('cadena vacía o nula lanza', () => {
    expect(() => urlBase64ToUint8Array('')).toThrow()
    expect(() => urlBase64ToUint8Array(null)).toThrow()
  })

  it('produce el mismo resultado que decodificar a mano un caso simple', () => {
    // 'AAAA' en base64 decodifica a 3 bytes 0x00 0x00 0x00
    const out = urlBase64ToUint8Array('AAAA')
    expect(Array.from(out)).toEqual([0, 0, 0])
  })
})

describe('filaDeSuscripcion', () => {
  const UA = 'Mozilla/5.0 (iPhone) Safari'

  it('extrae endpoint + claves y recorta el user_agent', () => {
    const sub = { endpoint: 'https://push.example.com/abc', keys: { p256dh: 'P256', auth: 'AUTH' } }
    const fila = filaDeSuscripcion(sub, UA)
    expect(fila).toEqual({ endpoint: 'https://push.example.com/abc', p256dh: 'P256', auth: 'AUTH', user_agent: UA, disabled_at: null })
  })

  it('recorta user_agent a 300 caracteres', () => {
    const largo = 'x'.repeat(500)
    const sub = { endpoint: 'e', keys: { p256dh: 'p', auth: 'a' } }
    const fila = filaDeSuscripcion(sub, largo)
    expect(fila.user_agent.length).toBe(300)
  })

  it('user_agent ausente → string vacío, no lanza', () => {
    const sub = { endpoint: 'e', keys: { p256dh: 'p', auth: 'a' } }
    const fila = filaDeSuscripcion(sub, undefined)
    expect(fila.user_agent).toBe('')
  })

  it('sin endpoint lanza', () => {
    const sub = { keys: { p256dh: 'p', auth: 'a' } }
    expect(() => filaDeSuscripcion(sub, UA)).toThrow()
  })

  it('sin keys lanza', () => {
    const sub = { endpoint: 'e' }
    expect(() => filaDeSuscripcion(sub, UA)).toThrow()
  })

  it('con p256dh pero sin auth lanza', () => {
    const sub = { endpoint: 'e', keys: { p256dh: 'p' } }
    expect(() => filaDeSuscripcion(sub, UA)).toThrow()
  })

  it('con auth pero sin p256dh lanza', () => {
    const sub = { endpoint: 'e', keys: { auth: 'a' } }
    expect(() => filaDeSuscripcion(sub, UA)).toThrow()
  })

  it('disabled_at siempre null (reactivar limpia bajas anteriores)', () => {
    const sub = { endpoint: 'e', keys: { p256dh: 'p', auth: 'a' } }
    expect(filaDeSuscripcion(sub, UA).disabled_at).toBeNull()
  })
})

describe('estadoAvisos', () => {
  const base = { tieneSW: true, tienePush: true, tieneNotification: true, permiso: 'default', esIOS: false, esStandalone: false, suscrito: false }

  it('iPhone/iPad en Safari sin instalar → ios_instalar, aunque "soporte" APIs', () => {
    expect(estadoAvisos({ ...base, esIOS: true, esStandalone: false })).toBe('ios_instalar')
  })

  it('iPhone instalado (standalone) con soporte y sin suscripción → inactivo', () => {
    expect(estadoAvisos({ ...base, esIOS: true, esStandalone: true })).toBe('inactivo')
  })

  it('iPhone instalado y ya suscrito → activo', () => {
    expect(estadoAvisos({ ...base, esIOS: true, esStandalone: true, suscrito: true })).toBe('activo')
  })

  it('sin ServiceWorker → no_soportado', () => {
    expect(estadoAvisos({ ...base, tieneSW: false })).toBe('no_soportado')
  })

  it('sin PushManager → no_soportado', () => {
    expect(estadoAvisos({ ...base, tienePush: false })).toBe('no_soportado')
  })

  it('sin Notification → no_soportado', () => {
    expect(estadoAvisos({ ...base, tieneNotification: false })).toBe('no_soportado')
  })

  it('permiso denegado → bloqueado', () => {
    expect(estadoAvisos({ ...base, permiso: 'denied' })).toBe('bloqueado')
  })

  it('con soporte, permiso concedido y suscrito → activo', () => {
    expect(estadoAvisos({ ...base, permiso: 'granted', suscrito: true })).toBe('activo')
  })

  it('con soporte, permiso concedido y sin suscripción → inactivo', () => {
    expect(estadoAvisos({ ...base, permiso: 'granted', suscrito: false })).toBe('inactivo')
  })

  it('permiso "default" (nunca preguntado) y sin suscripción → inactivo', () => {
    expect(estadoAvisos({ ...base, permiso: 'default', suscrito: false })).toBe('inactivo')
  })
})
