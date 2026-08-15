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

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

/** "Buenos días" / "Buenas tardes" / "Buenas noches" según la hora de Madrid. */
export function saludoSegunHora(now = new Date()) {
  const hh = parseInt(now.toLocaleString('es-ES', { timeZone: 'Europe/Madrid', hour: '2-digit', hour12: false }), 10)
  if (Number.isNaN(hh)) return 'Buenos días'
  if (hh >= 21 || hh < 6) return 'Buenas noches'
  if (hh < 14) return 'Buenos días'
  return 'Buenas tardes'
}

/** "miércoles 26 de agosto" — mismo formato que `fechaLegible` del bot. */
function diaLegible(fecha) {
  const d = new Date(`${fecha}T12:00:00`)   // mediodía: inmune a desfases de día
  if (Number.isNaN(d.getTime())) return null
  return `${DIAS[d.getDay()]} ${d.getDate()} de ${MESES[d.getMonth()]}`
}

/**
 * Recordatorio de la PRÓXIMA cita ya existente. Para pacientes con citas
 * recurrentes (una por semana): no hay que darles cita nueva, solo recordarles
 * la que ya tienen. Pura para poder testearla.
 *
 * @param {object} opts
 * @param {string} opts.startsAt  'YYYY-MM-DDTHH:MM:SS' (hora de pared)
 * @param {string} [opts.profName]
 * @param {Date}   [opts.now]
 * @returns {string} '' si no hay cita válida
 */
export function buildNextAppointmentReminder({ startsAt, profName, now = new Date() } = {}) {
  if (!startsAt || typeof startsAt !== 'string' || startsAt.length < 16) return ''
  const dia = diaLegible(startsAt.slice(0, 10))
  if (!dia) return ''
  const hora = startsAt.slice(11, 16)
  const conProf = profName ? ` con ${profName}` : ''
  return `${saludoSegunHora(now)}, te recuerdo que la próxima cita es el ${dia} a las ${hora}${conProf}, confírmame gracias.`
}

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
