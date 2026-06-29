// Payload para arrancar una conversación en Bot Coach con un paciente existente.
// last_message_at se setea para que el chat sea VISIBLE aunque esté vacío (el panel
// oculta las conversaciones sin last_message_at). Devuelve null si el paciente no
// tiene un teléfono válido (no se puede arrancar sin destino).
export function conversationPayloadFor(patient, now = new Date()) {
  if (!patient) return null
  const phone9 = String(patient.phone || '').replace(/\D/g, '').slice(-9)
  if (phone9.length < 9) return null
  const iso = now.toISOString()
  return { phone: phone9, patient_id: patient.id, last_message_at: iso, updated_at: iso }
}
