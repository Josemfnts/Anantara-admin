// Jornadas de belleza y avisos de clases. Puro: sin Supabase ni fechas del sistema.
//
// Una jornada es un día con una franja (start_time–end_time). Cada persona apuntada
// trae la duración de su servicio y, si Marta ya se la dio, su hora. Las horas son
// 'HH:MM' (o 'HH:MM:SS', se ignoran los segundos).

export const PASO_MIN = 15 // las horas se reparten en múltiplos de 15 min

export function aMin(hhmm) {
  if (!hhmm) return null
  const [h, m] = String(hhmm).split(':').map(Number)
  return Number.isFinite(h) ? h * 60 + (m || 0) : null
}

export function aHora(min) {
  return `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`
}

const redondeaArriba = m => Math.ceil(m / PASO_MIN) * PASO_MIN

/**
 * Reparte horas a quien no tiene, sin mover a quien ya la tiene.
 * items: [{ id, duracion, hora|null }] en el orden en que Marta quiere atenderlos.
 * Devuelve { horas: {id: 'HH:MM'}, sinHueco: [id] } solo con los que no tenían hora.
 */
export function repartirHoras(jornada, items) {
  const ini = aMin(jornada.start_time), fin = aMin(jornada.end_time)
  const ocupado = items
    .filter(i => i.hora)
    .map(i => [aMin(i.hora), aMin(i.hora) + (i.duracion || 60)])
  const horas = {}, sinHueco = []
  for (const it of items.filter(i => !i.hora)) {
    const dur = it.duracion || 60
    let t = ini, puesto = false
    while (t + dur <= fin) {
      const choca = ocupado.find(([a, b]) => t < b && a < t + dur)
      if (!choca) {
        horas[it.id] = aHora(t)
        ocupado.push([t, t + dur])
        puesto = true
        break
      }
      t = redondeaArriba(choca[1])
    }
    if (!puesto) sinHueco.push(it.id)
  }
  return { horas, sinHueco }
}

/** Minutos de la franja, minutos ya comprometidos y los que quedan. */
export function ocupacion(jornada, items) {
  const total = Math.max(0, aMin(jornada.end_time) - aMin(jornada.start_time))
  const usados = items.reduce((s, i) => s + (i.duracion || 60), 0)
  return { total, usados, libres: Math.max(0, total - usados), pasa: usados > total }
}

/** Ids con hora que se pisan con otro o se salen de la franja. */
export function conflictos(jornada, items) {
  const ini = aMin(jornada.start_time), fin = aMin(jornada.end_time)
  const conHora = items.filter(i => i.hora).map(i => ({ id: i.id, a: aMin(i.hora), b: aMin(i.hora) + (i.duracion || 60) }))
  const malos = new Set()
  for (const x of conHora) {
    if (x.a < ini || x.b > fin) malos.add(x.id)
    for (const y of conHora) if (x.id !== y.id && x.a < y.b && y.a < x.b) malos.add(x.id)
  }
  return malos
}

/** Sustituye {nombre}, {servicio}, {dia}, {hora}… Lo desconocido se deja tal cual. */
export function rellenar(plantilla, datos) {
  return String(plantilla || '').replace(/\{(\w+)\}/g, (m, k) => (datos[k] ?? '') !== '' ? String(datos[k]) : m)
}

/** Primer nombre para el saludo ("MARÍA LÓPEZ" → "María"). */
export function nombreCorto(nombre) {
  const p = String(nombre || '').trim().split(/\s+/)[0] || ''
  return p ? p.charAt(0).toUpperCase() + p.slice(1).toLowerCase() : ''
}

/** Teléfono para el bot: 34 + 9 cifras. null si no es un móvil español. */
export function telefonoWhatsApp(phone) {
  const d = String(phone || '').replace(/\D/g, '')
  const nueve = d.length === 11 && d.startsWith('34') ? d.slice(2) : d
  return nueve.length === 9 ? `34${nueve}` : null
}

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

/** 'YYYY-MM-DD' → 'martes 12 de noviembre'. */
export function diaLegible(ymd) {
  const [y, m, d] = String(ymd).slice(0, 10).split('-').map(Number)
  const dt = new Date(y, m - 1, d, 12)
  return `${DIAS[dt.getDay()]} ${d} de ${MESES[m - 1]}`
}

export const PLANTILLAS = {
  plantilla_belleza_aviso:
    'Hola {nombre} 😊 Te confirmamos tu cita de *{servicio}* el *{dia}* a las *{hora}* en Anantara. Si no puedes venir, avísanos por aquí. ¡Te esperamos! 🌿',
  plantilla_belleza_cancelacion:
    'Hola {nombre}, sentimos avisarte de que la jornada de *{servicio}* del *{dia}* se ha cancelado. Te guardamos en la lista y te avisamos en cuanto haya nueva fecha 🙏',
  plantilla_clase_cancelacion:
    'Hola {nombre}, la clase de *{servicio}* del *{dia}* a las *{hora}* se ha cancelado. Sentimos las molestias 🙏',
  plantilla_clase_aviso:
    'Hola {nombre} 😊 Te hemos apuntado a la clase de *{servicio}* del *{dia}* a las *{hora}*. ¡Nos vemos en Anantara! 🧗',
}
