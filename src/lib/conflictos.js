// ¿Choca esta cita con algo? Puro: mismos datos → mismo resultado.
//
// POR QUÉ EXISTE (auditoría 2026-08-25, hallazgo A6):
// El panel comprobaba el solape así —
//     .gte('starts_at', inicio).lt('starts_at', fin)
// — o sea, solo veía las citas que EMPIEZAN dentro del hueco nuevo. Una cita que
// empieza antes y solapa por detrás no aparecía: con una de 120 min a las 10:00,
// crear otra a las 11:00 pasaba el filtro y se guardaba. Dos pacientes a la misma
// hora con el mismo fisio.
//
// Además, al CREAR solo se miraba `blocked_days`. No se miraban los bloqueos de
// agenda, los descansos del profesional ni los huecos retenidos para la lista de
// espera. El bot sí mira las cinco fuentes (v5/src/tools/helpers/availability.js).
//
// Decisión de Josema (25-ago): esto AVISA, no bloquea. Marta puede seguir adelante
// si sabe lo que hace; lo que no puede es enterarse después.

/** Recorta el sufijo de zona para comparar horas de pared sin desfases. */
const t = (s) => (s ? String(s).slice(0, 19) : null)

/** ¿La cita `a` pisa el intervalo [ini, fin)? Pegadas NO se pisan. */
export function solapan(a, ini, fin) {
  const aS = t(a?.starts_at)
  if (!aS || !ini || !fin) return false
  const aE = t(a?.ends_at) || aS
  return aS < t(fin) && aE > t(ini)
}

const hhmm = (x) => String(x || '').slice(0, 5)

/**
 * @param {object} datos
 *   citas        — citas del profesional ese día (sin filtrar por estado)
 *   bloqueos     — blocked_slots del día
 *   descansos    — recurring_breaks del profesional (todos los días de la semana)
 *   retenidos    — citas retenidas por un cancellation_hold activo
 *   diaBloqueado — boolean, blocked_days
 * @param {object} slot  { startsAt, endsAt, excludeId }
 * @returns {Array<{tipo:'cita'|'bloqueo'|'descanso'|'dia'|'retenido', texto:string}>}
 */
export function detectarConflictos(datos, slot) {
  if (!datos || !slot?.startsAt || !slot?.endsAt) return []
  const { startsAt, endsAt, excludeId = null } = slot
  const out = []

  for (const c of datos.citas || []) {
    if (!c || c.id === excludeId) continue
    if (c.status === 'cancelled') continue
    if (!solapan(c, startsAt, endsAt)) continue
    const quien = c.patients?.full_name ? ` de ${c.patients.full_name}` : ''
    out.push({
      tipo: 'cita',
      texto: `Cita${quien} de ${t(c.starts_at).slice(11, 16)} a ${t(c.ends_at || c.starts_at).slice(11, 16)}`,
    })
  }

  for (const b of datos.bloqueos || []) {
    if (!solapan(b, startsAt, endsAt)) continue
    out.push({
      tipo: 'bloqueo',
      texto: `Agenda bloqueada de ${t(b.starts_at).slice(11, 16)} a ${t(b.ends_at || b.starts_at).slice(11, 16)}${b.reason ? ` (${b.reason})` : ''}`,
    })
  }

  // Los descansos van por día de la semana + hora, no por fecha.
  const dow = new Date(t(startsAt)).getDay()
  const ini = t(startsAt).slice(11, 16)
  const fin = t(endsAt).slice(11, 16)
  for (const d of datos.descansos || []) {
    if (!d || d.day_of_week !== dow) continue
    if (!(ini < hhmm(d.end_time) && fin > hhmm(d.start_time))) continue
    out.push({ tipo: 'descanso', texto: `Descanso del profesional de ${hhmm(d.start_time)} a ${hhmm(d.end_time)}` })
  }

  if (datos.diaBloqueado) {
    out.push({ tipo: 'dia', texto: 'Ese día está bloqueado para este profesional' })
  }

  for (const r of datos.retenidos || []) {
    if (!solapan(r, startsAt, endsAt)) continue
    out.push({
      tipo: 'retenido',
      texto: `Hueco de ${t(r.starts_at).slice(11, 16)} reservado para la lista de espera`,
    })
  }

  return out
}

/** Texto del aviso que se le enseña a Marta. */
export function textoConflictos(conflictos) {
  if (!conflictos?.length) return ''
  const lineas = conflictos.map(c => `• ${c.texto}`).join('\n')
  return `Ese horario choca con:\n\n${lineas}\n\n¿Guardar de todas formas?`
}
