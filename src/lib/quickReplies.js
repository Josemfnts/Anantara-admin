// Quick-replies sugeridos en el panel Bot Coach, según el contexto de la propuesta.
// Tono canónico del bot (tutea, sin emojis decorativos). Ver
// docs/superpowers/specs/2026-06-27-quick-replies-contextuales-design.md
//
// NOTA: "reprogramar" comparte category 'cancelacion' en el bot, así que el set de
// cancelación incluye frases de cancelar Y de reprogramar.
const QR_BY_CONTEXT = {
  confirmacion: ['Perfecto, hasta mañana.', 'Ok, gracias.', 'Genial, nos vemos.'],
  cancelacion:  ['Hecho, cancelada.', 'Cancelada, te busco otro hueco y te digo algo.', 'Sin problema, ¿quieres que te reprograme?'],
  ambigua:      ['¿Me confirmas el día y la hora que prefieres?', '¿Para qué fecha lo quieres?'],
  otra:         ['Te llamamos enseguida.', 'Ahora te confirmo.', 'Gracias, lo reviso.'],
  generic:      ['¡Hola! Dime, ¿en qué te ayudo?', 'Te llamamos enseguida.', 'Gracias.'],
}

// category: string | null | undefined.
// Sin category (chat libre) → 'generic'. Category desconocida → 'otra' (fallback seguro).
// Devuelve siempre un array no vacío de strings.
export function quickRepliesFor(category) {
  if (!category) return QR_BY_CONTEXT.generic
  return QR_BY_CONTEXT[category] || QR_BY_CONTEXT.otra
}
