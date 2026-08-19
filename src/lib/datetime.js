// Formateo de timestamps REALES (timestamptz en UTC) a la hora del centro.
//
// Contexto: messages.created_at y conversations.last_message_at son timestamptz
// en UTC. Los helpers fTime/fDT de App.jsx hacen slice(0,19) (descartan el offset)
// y reinterpretan como hora local → muestran la hora UTC, con 1-2h de desfase.
// Esos helpers están bien para appointments.starts_at (hora local "naive"), así
// que NO se tocan; estos son aparte, solo para timestamps reales del chat.
//
// Forzamos Europe/Madrid (no la tz del dispositivo): correcto para la clínica y
// determinista en tests, independientemente de la tz de la máquina.

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const TZ = 'Europe/Madrid'

// Descompone un timestamp en sus componentes de pared en Europe/Madrid.
// Acepta cualquier ISO con offset/Z (lo que devuelve Supabase para timestamptz).
function madridParts(iso) {
  if (!iso) return null
  const d = new Date(iso)               // respeta el offset/Z del ISO
  if (isNaN(d.getTime())) return null
  const p = new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(d)
  const get = t => p.find(x => x.type === t)?.value
  let hour = get('hour')
  if (hour === '24') hour = '00'        // algunos motores dan '24' a medianoche
  return { y: +get('year'), mo: +get('month'), d: +get('day'), h: hour, mi: get('minute') }
}

// 'HH:MM' en hora del centro. Para la hora de cada mensaje y de la lista.
export function fClock(iso) {
  const m = madridParts(iso)
  return m ? `${m.h}:${m.mi}` : '—'
}

// 'D mes · HH:MM' en hora del centro. Para la cabecera de cada tarjeta (Monitor).
export function fClockDT(iso) {
  const m = madridParts(iso)
  return m ? `${m.d} ${MONTHS[m.mo - 1]} · ${m.h}:${m.mi}` : '—'
}

// 'YYYY-MM-DD' del día de pared en Europe/Madrid. Clave para agrupar mensajes
// por día en los chats.
export function madridDay(iso) {
  const m = madridParts(iso)
  return m ? `${m.y}-${String(m.mo).padStart(2, '0')}-${String(m.d).padStart(2, '0')}` : null
}

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']

// Etiqueta del separador de día en un chat: 'Hoy', 'Ayer', 'martes 12 ago' o,
// si es de otro año, '12 ago 2025'. Los chats mostraban solo HH:MM, así que una
// conversación de varios días parecía desordenada (21:30 seguido de 08:02).
export function fDayLabel(iso, now = new Date()) {
  const m = madridParts(iso)
  if (!m) return ''
  const dia = madridDay(iso)
  const hoy = madridDay(now.toISOString())
  if (dia === hoy) return 'Hoy'
  const ayer = madridDay(new Date(now.getTime() - 24 * 36e5).toISOString())
  if (dia === ayer) return 'Ayer'
  const dow = new Date(Date.UTC(m.y, m.mo - 1, m.d)).getUTCDay()
  const esteAno = new Date(hoy + 'T00:00:00Z').getUTCFullYear()
  return m.y === esteAno
    ? `${DIAS[dow]} ${m.d} ${MONTHS[m.mo - 1]}`
    : `${m.d} ${MONTHS[m.mo - 1]} ${m.y}`
}
