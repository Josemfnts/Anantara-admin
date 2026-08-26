// Quick-replies sugeridos en el panel Bot Coach, según el contexto de la propuesta.
// Tono canónico del bot (tutea, sin emojis decorativos). Ver
// docs/superpowers/specs/2026-06-27-quick-replies-contextuales-design.md
//
// NOTA: "reprogramar" comparte category 'cancelacion' en el bot, así que el set de
// cancelación incluye frases de cancelar Y de reprogramar.

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']

/**
 * Despedida canónica según cuándo es la cita (PREMISAS-BOT.md §1.2).
 *
 * ESPEJO de `despedidaD1` en el bot (`v5/src/agent/deterministic-handler.js:115`).
 * Si cambias las reglas aquí, cámbialas allí — y al revés.
 *
 * POR QUÉ EXISTE: el panel ofrecía "Perfecto, hasta mañana." como primer botón,
 * fijo, sin mirar la fecha. Es el fallo más caro que encontró el digest de agosto
 * (se mandó 45 veces diciendo «mañana» cuando la cita era el lunes). El bot ya lo
 * calculaba bien; el panel lo reintroducía de un click. Auditoría A5.
 *
 * @param {string|null} startsAt  'YYYY-MM-DDTHH:MM:SS' (hora de pared)
 * @param {Date} [now]
 * @returns {string} Siempre devuelve algo cierto: sin fecha, "hasta la cita".
 */
export function despedidaSegunFecha(startsAt, now = new Date()) {
  try {
    if (!startsAt || typeof startsAt !== 'string') return 'Perfecto, hasta la cita.'
    const citaDay = startsAt.slice(0, 10)
    const citaDate = new Date(`${citaDay}T12:00:00`)
    if (isNaN(citaDate.getTime())) return 'Perfecto, hasta la cita.'
    const hoyStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    const hoyDate = new Date(`${hoyStr}T12:00:00`)
    const diffDays = Math.round((citaDate.getTime() - hoyDate.getTime()) / 86400000)
    if (diffDays === 0) return 'Perfecto, hasta luego.'
    if (diffDays === 1) return 'Perfecto, hasta mañana.'
    if (diffDays >= 2 && diffDays <= 6) return `Perfecto, hasta el ${DIAS[citaDate.getDay()]}.`
    return 'Perfecto, hasta la cita.'
  } catch {
    return 'Perfecto, hasta la cita.'
  }
}

const QR_BY_CONTEXT = {
  // Ojo al orden: el primero es el que Marta pulsa sin pensar. Por eso el que
  // encabeza la lista cuando NO sabemos la fecha es el único que siempre es cierto.
  confirmacion: ['Perfecto, hasta la cita.', 'Perfecto, hasta mañana.', 'Perfecto, hasta luego.', 'Ok, gracias.', 'Genial, nos vemos.'],
  cancelacion:  ['Hecho, cancelada.', 'Cancelada, te busco otro hueco y te digo algo.', 'Sin problema, ¿quieres que te reprograme?'],
  ambigua:      ['¿Me confirmas el día y la hora que prefieres?', '¿Para qué fecha lo quieres?'],
  otra:         ['Te llamamos enseguida.', 'Ahora te confirmo.', 'Gracias, lo reviso.'],
  generic:      ['¡Hola! Dime, ¿en qué te ayudo?', 'Te llamamos enseguida.', 'Gracias.'],
}

// category: string | null | undefined.
// Sin category (chat libre) → 'generic'. Category desconocida → 'otra' (fallback seguro).
// ctx.startsAt: fecha de la cita, si el panel la conoce → la despedida exacta va primera.
// Devuelve siempre un array no vacío de strings.
export function quickRepliesFor(category, { startsAt = null, now = undefined } = {}) {
  if (!category) return QR_BY_CONTEXT.generic
  if (category === 'confirmacion') {
    const exacta = despedidaSegunFecha(startsAt, now ?? new Date())
    return [exacta, ...QR_BY_CONTEXT.confirmacion.filter(s => s !== exacta)]
  }
  return QR_BY_CONTEXT[category] || QR_BY_CONTEXT.otra
}
