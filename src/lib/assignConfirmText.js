// Texto de la tarjeta de confirmación antes de asignar un hueco vacante a un
// candidato de lista de espera. Se pide confirmación explícita porque la
// acción real (confirmAssignToWL / confirmAssign en App.jsx) inserta la cita
// Y dispara un WhatsApp de verdad al paciente — antes un solo clic sobre el
// candidato hacía las dos cosas sin avisar (encargo 1.2).
//
// 'startsAt' es un timestamp naive local (hora del centro), igual que fD/fTime
// de App.jsx: se lee tal cual, sin reinterpretar con timezone (ver el comentario
// de cabecera de lib/datetime.js sobre por qué appointments.starts_at es
// distinto de los timestamptz del chat).
const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

export function assignConfirmText(patientName, startsAt) {
  const s = (startsAt || '').slice(0, 19)
  const dd = +s.slice(8, 10)
  const mm = +s.slice(5, 7)
  const hora = s.slice(11, 16)
  const nombre = patientName || 'este paciente'
  if (!dd || !mm || hora.length !== 5) {
    return `¿Asignar a ${nombre} este hueco y enviarle WhatsApp?`
  }
  return `¿Asignar a ${nombre} el hueco del ${dd} ${MONTHS[mm - 1]} a las ${hora} y enviarle WhatsApp?`
}
