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
