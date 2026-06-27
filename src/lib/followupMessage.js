// Genera el mensaje editable del panel Agenda para la sección "Próxima cita".
// Es pura para poder testearla fácilmente.
//
// Las 4 casuísticas (ver docs):
//  - Sin semanas ni lista de espera        → despedida manual.
//  - Semanas + horas (± lista de espera)   → '' : el BOT busca hueco y envía la
//                                            oferta (caso 2 y caso 3). El cuadro
//                                            queda vacío para no confundir.
//  - Semanas + lista de espera SIN horas   → mensaje manual "no tengo hueco".
//  - Semanas SIN horas ni lista de espera  → '' : el bot busca a cualquier hora.

export function weekText(weeks) {
  if (weeks === 1) return 'la semana que viene'
  if (weeks === 2) return 'dentro de dos semanas'
  return `dentro de ${weeks} semanas`
}

export function buildFollowupMessage({ weeks = 0, waitlist = false, hasHours = false, profName = 'el equipo' } = {}) {
  if (!weeks && !waitlist) {
    return `Buenas, ${profName} no me apunta que vuelva a citarte, así que cuando necesites nos dices, o si prefieres, pautamos una nueva cita. Muchas gracias`
  }
  // Con horas seleccionadas el bot SIEMPRE busca y envía su oferta (canónica, +
  // "te apunto para adelantar" si hay lista de espera). El cuadro no se envía.
  if (weeks && hasHours) return ''
  // Lista de espera sin horas → mensaje manual "no tengo hueco".
  if (waitlist) {
    const cuando = weeks ? weekText(weeks) : 'lista de espera'
    return `${profName} me dice que te paute para ${cuando} pero no tengo hueco aun disponible, en cuanto se libere uno te aviso.`
  }
  // Semanas sin horas ni lista de espera: el bot busca a cualquier hora y envía oferta.
  return ''
}
