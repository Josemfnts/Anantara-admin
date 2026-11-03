// Clases (escalada, yoga): plantillas recurrentes y organización por semanas. Puro.

const pad = n => String(n).padStart(2, '0')
export const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

/**
 * Clases que le faltan a una plantilla entre `desde` (Date) y `semanas` después.
 * `existentes` = fechas 'YYYY-MM-DD' que ya tienen clase de esa plantilla.
 * Hoy solo cuenta si la hora de inicio no ha pasado.
 */
export function clasesQueFaltan(tpl, existentes, desde, semanas = 8) {
  const ya = new Set(existentes)
  const fin = new Date(desde.getFullYear(), desde.getMonth(), desde.getDate() + semanas * 7)
  const hoy = ymd(desde)
  const ahora = `${pad(desde.getHours())}:${pad(desde.getMinutes())}`
  const out = []
  for (let d = new Date(desde.getFullYear(), desde.getMonth(), desde.getDate()); d <= fin; d.setDate(d.getDate() + 1)) {
    if (d.getDay() !== Number(tpl.day_of_week)) continue
    const f = ymd(d)
    if (ya.has(f)) continue
    if (f === hoy && String(tpl.start_time).slice(0, 5) <= ahora) continue
    out.push({
      service_id: tpl.service_id,
      professional_id: tpl.professional_id,
      starts_at: `${f}T${String(tpl.start_time).slice(0, 5)}:00`,
      ends_at: `${f}T${String(tpl.end_time).slice(0, 5)}:00`,
      max_bookings: tpl.max_bookings,
      template_id: tpl.id,
    })
  }
  return out
}

/** Lunes 'YYYY-MM-DD' de la semana de una fecha 'YYYY-MM-DD…'. */
export function lunesDe(fecha) {
  const [y, m, d] = String(fecha).slice(0, 10).split('-').map(Number)
  const dt = new Date(y, m - 1, d, 12)
  dt.setDate(dt.getDate() - ((dt.getDay() + 6) % 7))
  return ymd(dt)
}

/** Agrupa clases (con starts_at) por semana, conservando el orden. */
export function porSemana(clases) {
  const grupos = []
  for (const c of clases) {
    const l = lunesDe(c.starts_at)
    let g = grupos[grupos.length - 1]
    if (!g || g.lunes !== l) { g = { lunes: l, clases: [] }; grupos.push(g) }
    g.clases.push(c)
  }
  return grupos
}

/** Reservas que cuentan para el aforo. */
export const activas = bookings => (bookings || []).filter(b => b.status !== 'cancelled')

/**
 * Cambios de una plantilla editada que se pueden llevar a sus clases futuras:
 * solo hora y plazas, y nunca por debajo de las reservas que ya tiene cada clase.
 * Devuelve [{ id, cambios }] y los ids que no se pueden tocar.
 */
export function propagarPlantilla(tpl, clasesFuturas) {
  const cambios = [], bloqueadas = []
  for (const c of clasesFuturas) {
    const dia = String(c.starts_at).slice(0, 10)
    const ocupadas = activas(c.bookings).length
    if (ocupadas > Number(tpl.max_bookings)) { bloqueadas.push(c.id); continue }
    const nuevo = {
      starts_at: `${dia}T${String(tpl.start_time).slice(0, 5)}:00`,
      ends_at: `${dia}T${String(tpl.end_time).slice(0, 5)}:00`,
      max_bookings: Number(tpl.max_bookings),
    }
    const igual = String(c.starts_at).slice(0, 16) === nuevo.starts_at.slice(0, 16)
      && String(c.ends_at).slice(0, 16) === nuevo.ends_at.slice(0, 16)
      && Number(c.max_bookings) === nuevo.max_bookings
    if (!igual) cambios.push({ id: c.id, cambios: nuevo })
  }
  return { cambios, bloqueadas }
}

/** Etiqueta de sección para historiales (la app y el panel decían «Belleza» a todo). */
export function etiquetaSeccion(section) {
  return { yoga: 'Yoga', escalada: 'Escalada', beauty: 'Belleza', osteopathy: 'Osteopatía' }[section] || 'Clase'
}
