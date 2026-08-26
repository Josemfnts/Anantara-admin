import { describe, it, expect } from 'vitest'
import { generateActionText } from './generateActionText.js'

describe('generateActionText', () => {
  it('acción null/vacía → cadena vacía', () => {
    expect(generateActionText(null)).toBe('')
    expect(generateActionText({})).toBe('')
    expect(generateActionText({ type: 'inexistente' })).toBe('')
  })

  it('cancelar_cita → confirmación con fallback', () => {
    expect(generateActionText({ type: 'cancelar_cita' })).toMatch(/cancelada/i)
  })

  it('descartar_propuesta → texto neutro sin proponer otro hueco', () => {
    const t = generateActionText({ type: 'descartar_propuesta' })
    expect(t).toMatch(/si quieres cita otro día/i)
    expect(t).not.toMatch(/apunto/i)
  })

  // PREMISAS-BOT.md §1.2: 'Perfecto, apuntado. Muchas gracias.' SUSTITUYE a
  // 'Listo, te apunto.', que Marta reescribió 20 veces. El bot ya estaba migrado
  // (deterministic-handler.js:280,305); el panel no, y este test fijaba el texto
  // retirado. Auditoría 2026-08-25, hallazgo A4.
  it('confirmar_propuesta → texto canónico de PREMISAS §1.2', () => {
    expect(generateActionText({ type: 'confirmar_propuesta' })).toBe('Perfecto, apuntado. Muchas gracias.')
    expect(generateActionText({ type: 'confirmar_followup_oferta' })).toBe('Perfecto, apuntado. Muchas gracias.')
  })

  it('proponer_cita: incluye día legible, hora y profesional', () => {
    const t = generateActionText(
      { type: 'proponer_cita', starts_at: '2026-09-15T10:30:00' },
      { patientName: 'María López', profName: 'Marcos' }
    )
    expect(t).toMatch(/martes 15 de septiembre/)
    expect(t).toMatch(/10:30/)
    expect(t).toMatch(/Marcos/)
    expect(t).toMatch(/¿Te viene bien\?/)
  })

  it('proponer_cita sin starts_at: fallback sin fecha', () => {
    const t = generateActionText({ type: 'proponer_cita' }, { patientName: 'Ana', profName: 'Lorena' })
    expect(t).toMatch(/Lorena/)
    expect(t).not.toMatch(/undefined/)
    expect(t).not.toMatch(/NaN/)
  })

  it('reprogramar: menciona la NUEVA fecha, no la vieja', () => {
    const t = generateActionText(
      {
        type: 'reprogramar',
        cancel: { appointment_id: 'x' },
        propose: { starts_at: '2026-08-13T18:00:00' },
      },
      { patientName: 'Ricardo Sánchez', profName: 'Lorena' }
    )
    expect(t).toMatch(/te muevo/i)
    expect(t).toMatch(/jueves 13 de agosto/)
    expect(t).toMatch(/18:00/)
    expect(t).toMatch(/Lorena/)
  })

  it('apuntar_lista_espera: nombra el servicio', () => {
    const t = generateActionText(
      { type: 'apuntar_lista_espera', service_name: 'Manicura' },
      { patientName: 'Elena' }
    )
    expect(t).toMatch(/Manicura/)
    expect(t).toMatch(/aviso cuando tenga hueco/i)
  })

  it('aceptar_oferta_cancelacion: usa appt.day/time cuando llegan', () => {
    const t = generateActionText(
      { type: 'aceptar_oferta_cancelacion', appointment_id: 'x' },
      { appt: { day: 'lunes 15', time: '10:00' } }
    )
    expect(t).toMatch(/te muevo al lunes 15 a las 10:00/i)
  })

  it('rechazar_oferta_cancelacion: texto neutro', () => {
    expect(generateActionText({ type: 'rechazar_oferta_cancelacion' })).toMatch(/cita que ya tenías/i)
  })

  it('reservar_clase: nombra el servicio', () => {
    const t = generateActionText(
      { type: 'reservar_clase', starts_at: '2026-09-22T18:00:00' },
      { patientName: 'Ana', serviceName: 'Yoga Vinyasa' }
    )
    expect(t).toMatch(/Yoga Vinyasa/)
    expect(t).toMatch(/martes 22 de septiembre/)
    expect(t).toMatch(/18:00/)
  })

  it('rechazar_propuesta con next.starts_at: propone la nueva', () => {
    const t = generateActionText({
      type: 'rechazar_propuesta',
      next: { starts_at: '2026-09-16T09:30:00' },
    })
    expect(t).toMatch(/miércoles 16 de septiembre/)
    expect(t).toMatch(/09:30/)
  })

  it('no genera texto con "undefined" o "NaN" al pasar datos incompletos', () => {
    const tipos = [
      'cancelar_cita', 'confirmar_propuesta', 'proponer_cita', 'reservar_clase',
      'apuntar_lista_espera', 'reprogramar', 'oferta_proactiva',
    ]
    for (const type of tipos) {
      const t = generateActionText({ type }, {})
      expect(t, `tipo=${type}`).not.toMatch(/undefined/)
      expect(t, `tipo=${type}`).not.toMatch(/NaN/)
    }
  })

  // Regla transversal de PREMISAS-BOT.md §1.2 (2026-08-14), orden de Josema:
  // «el bot NUNCA llama al paciente por su nombre». Sale del corpus: de 98 mensajes
  // escritos por Marta, los pocos que llevan nombre de pila son casi todos ediciones
  // de un texto del bot que ya lo traía. El system prompt lo prohíbe explícitamente
  // (v5/src/agent/system-prompt.js:33) y el panel lo hacía igualmente. Hallazgo A4.
  it('NUNCA se dirige al paciente por su nombre de pila', () => {
    const tipos = [
      'cancelar_cita', 'descartar_propuesta', 'confirmar_propuesta',
      'confirmar_followup_oferta', 'aceptar_oferta_cancelacion',
      'rechazar_oferta_cancelacion', 'proponer_cita', 'rechazar_propuesta',
      'reservar_clase', 'apuntar_lista_espera', 'apuntar_lista_adelantar',
      'reprogramar', 'oferta_proactiva', 'anotar_cita',
    ]
    for (const type of tipos) {
      const t = generateActionText(
        { type, starts_at: '2026-09-15T10:30:00', next: { starts_at: '2026-09-16T09:30:00' }, propose: { starts_at: '2026-09-16T09:30:00' }, cancel: { appointment_id: 'x' } },
        { patientName: 'María López', profName: 'Marcos', serviceName: 'Osteopatía' }
      )
      expect(t, `tipo=${type} → "${t}"`).not.toMatch(/María/)
      expect(t, `tipo=${type} → "${t}"`).not.toMatch(/\bHola\s+[A-ZÁÉÍÓÚÑ]/)
    }
  })

  // El profesional SÍ se nombra: es un dato de la cita, no un trato personal.
  it('sí nombra al profesional', () => {
    const t = generateActionText(
      { type: 'proponer_cita', starts_at: '2026-09-15T10:30:00' },
      { patientName: 'María López', profName: 'Marcos' }
    )
    expect(t).toMatch(/Marcos/)
  })
})
