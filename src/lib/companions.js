// Acompañantes de una cita "personalizada".
//
// Josema (2026-08-14): la cita sigue teniendo UN titular; el acompañante es solo
// un NOMBRE, no un paciente ni un usuario. Solo se usa para que el recordatorio
// lo mencione: "tienes cita mañana a las 10:00 con Marcos para ti y Lucía".
//
// ⚠️ `textoAcompanantes` debe dar EXACTAMENTE el mismo texto que la función del
// mismo nombre en el bot (anantara-whatsapp/v5/src/cron/reminders.js). Aquí solo
// se usa para la vista previa del panel; quien manda el recordatorio de verdad es
// el bot. Si se cambia una, hay que cambiar la otra.

/** "Lucía, Pedro" → ['Lucía','Pedro']. Ignora huecos y comas de más. */
export function parseCompanions(txt) {
  return String(txt || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
}

/** " para ti y Lucía" · " para ti, Lucía y Pedro" · '' si va solo. */
export function textoAcompanantes(companions) {
  const nombres = (Array.isArray(companions) ? companions : [])
    .map(n => String(n || '').trim())
    .filter(Boolean)
  if (!nombres.length) return ''
  if (nombres.length === 1) return ` para ti y ${nombres[0]}`
  return ` para ti, ${nombres.slice(0, -1).join(', ')} y ${nombres[nombres.length - 1]}`
}
