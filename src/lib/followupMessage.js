// Genera el mensaje editable del panel Agenda para la sección "Próxima cita".
// Es pura para poder testearla fácilmente.

export function weekText(weeks) {
  if (weeks === 1) return 'la semana que viene'
  if (weeks === 2) return 'dentro de dos'
  return `dentro de ${weeks} semanas`
}

export function buildFollowupMessage({ weeks = 0, waitlist = false, profName = 'el equipo' } = {}) {
  if (!weeks && !waitlist) {
    return `Buenas, ${profName} no me apunta que vuelva a citarte, así que cuando necesites nos dices, o si prefieres, pautamos una nueva cita. Muchas gracias`
  }
  if (!weeks && waitlist) {
    // Caso teórico; la UI obliga a semanas cuando hay waitlist.
    return `${profName} me dice que te paute para lista de espera pero no tengo hueco aun disponible, en cuanto se libere uno te aviso.`
  }
  if (weeks && waitlist) {
    return `${profName} me dice que te paute para ${weekText(weeks)} pero no tengo hueco aun disponible, en cuanto se libere uno te aviso.`
  }
  // weeks && !waitlist: el bot busca slot y envía su mensaje canónico.
  return ''
}
