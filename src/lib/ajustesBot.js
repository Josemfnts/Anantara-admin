// Listas de ajustes del bot guardadas como JSON en app_config. Puras para poder probarlas.

/** app_config.value (texto JSON) → array de strings. Cualquier otra cosa → []. */
export function leerLista(valor) {
  try {
    const l = JSON.parse(valor || '[]')
    return Array.isArray(l) ? l.map(String) : []
  } catch {
    return []
  }
}

/** Texto libre del input → 9 dígitos, o null si no es un teléfono español. */
export function normalizarTelefono(texto) {
  const d = String(texto || '').replace(/\D/g, '')
  const sinPrefijo = d.length === 11 && d.startsWith('34') ? d.slice(2) : d
  return sinPrefijo.length === 9 ? sinPrefijo : null
}

/** Añade sin duplicar y deja la lista ordenada. */
export function anadirALista(lista, valor) {
  return [...new Set([...lista, valor])].sort()
}

/** Días que siguen vigentes: los pasados ya no pintan nada. `hoy` = 'YYYY-MM-DD'. */
export function diasVigentes(lista, hoy) {
  return lista.filter(d => d >= hoy).sort()
}

/**
 * Si Marta cambia el texto de una propuesta y ya no menciona su hora, la propuesta sigue
 * viva y un "vale" del paciente la confirmaría (H8 y H13, oct 2026). Devuelve la hora
 * 'HH:MM' por la que avisar, o null si no hay nada que avisar.
 */
export function horaPropuestaOmitida(accion, textoFinal, textoOriginal) {
  if (accion?.type !== 'proponer_cita' || !accion.starts_at) return null
  const texto = String(textoFinal || '')
  if (texto.trim() === String(textoOriginal || '').trim()) return null
  const hhmm = String(accion.starts_at).slice(11, 16)
  const hh = String(Number(hhmm.slice(0, 2)))
  const mm = hhmm.slice(3, 5)
  const menciona = new RegExp('(^|\\D)0?' + hh + '[:.]' + mm + '(\\D|$)').test(texto)
    || (mm === '00' && new RegExp('\\blas\\s+0?' + hh + '\\b', 'i').test(texto))
  return menciona ? null : hhmm
}
