// Cita "personalizada" del editor de acciones (ActionEditorModal, compartido por
// BotCoach y Bot Móvil) — encargo 4.4 (fase 4, terceros y cita personalizada).
//
// Solo la crea Marta, a mano, cuando la cita que hace falta no encaja en ningún
// servicio del catálogo (duración especial) o es para otra persona con una
// duración que no es la de un servicio normal. El bot NUNCA la propone.
//
// Ligada a app_config.features_bot (ver featuresBot.js): oculta hasta que
// Josema confirme que el bot del OptiPlex ya sabe leer `para_quien` — hoy
// (commitProponerCita en anantara-bot-v5/src/tools/proponer-cita.js) el commit
// solo desestructura patient_id/professional_id/service_id/starts_at/ends_at/
// duration_minutes/notes: un `para_quien` en el descriptor se aprobaría y se
// perdería en silencio. Lo de aquí es pura UI/validación; ese commit no se toca.
//
// Módulo PURO (sin red, sin DOM) para poder testear la validación y el
// descriptor sin montar el componente.

export const CUSTOM_DURATION_MIN = 10
export const CUSTOM_DURATION_MAX = 240
export const CUSTOM_DURATION_STEP = 5
export const CUSTOM_DURATION_DEFAULT = 60

// Entero entre 10 y 240. El paso de 5 es solo el incremento del <input type=
// number>: no rechazamos aquí un valor que no sea múltiplo de 5 (Marta puede
// escribirlo a mano), lo que exige el encargo es el rango y que sea entero.
export function isValidCustomDuration(minutes) {
  const n = Number(minutes)
  return Number.isInteger(n) && n >= CUSTOM_DURATION_MIN && n <= CUSTOM_DURATION_MAX
}

// 'YYYY-MM-DDTHH:MM[:SS]' + N min → mismo formato con el offset sumado. Pura.
// (Antes vivía duplicada dentro de ActionEditorModal.jsx.)
export function addMinutes(iso, minutes) {
  if (!iso || !iso.includes('T')) return iso
  const [date, time] = iso.split('T')
  const [hh, mm] = time.split(':').map(Number)
  const total = hh * 60 + mm + minutes
  const nh = String(Math.floor(total / 60) % 24).padStart(2, '0')
  const nm = String(total % 60).padStart(2, '0')
  return `${date}T${nh}:${nm}:00`
}

// Descriptor EXACTO acordado para la cita personalizada (mapa fase-4-terceros
// §4.4): sin service_id, con duration_minutes propia y personalizada:true para
// que describeProposedAction (proposedAction.js) la distinga de una
// proponer_cita normal. Duración inválida o falta algún dato → null: no se
// puede aprobar una acción a medias.
export function buildPersonalizadaDescriptor({ patientId, professionalId, startsAt, durationMinutes, paraQuien } = {}) {
  if (!patientId || !professionalId || !startsAt) return null
  if (!isValidCustomDuration(durationMinutes)) return null
  const dur = Number(durationMinutes)
  const texto = String(paraQuien || '').trim()
  return {
    type: 'proponer_cita',
    patient_id: patientId,
    professional_id: professionalId,
    service_id: null,
    starts_at: startsAt,
    ends_at: addMinutes(startsAt, dur),
    duration_minutes: dur,
    para_quien: texto || null,
    personalizada: true,
  }
}

// ¿El currentAction que trae el modal al abrirse YA es una personalizada?
// SOLO por el flag explícito. `service_id` null con `duration_minutes` NO basta:
// el bot propone así una cita normal cuando no encuentra un servicio de la
// duración del profesional (planProponerCita), y tratarla como personalizada
// abriría el editor en ese modo con el flag apagado.
export function esPersonalizada(action) {
  if (!action || action.type !== 'proponer_cita') return false
  return action.personalizada === true
}
