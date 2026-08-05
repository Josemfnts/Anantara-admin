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

  it('confirmar_propuesta → "Listo, te apunto." (patrón #1 del prompt)', () => {
    expect(generateActionText({ type: 'confirmar_propuesta' })).toBe('Listo, te apunto.')
    expect(generateActionText({ type: 'confirmar_followup_oferta' })).toBe('Listo, te apunto.')
  })

  it('proponer_cita: incluye día legible, hora y profesional', () => {
    const t = generateActionText(
      { type: 'proponer_cita', starts_at: '2026-09-15T10:30:00' },
      { patientName: 'María López', profName: 'Marcos' }
    )
    expect(t).toMatch(/Hola María,/)
    expect(t).toMatch(/martes 15 de septiembre/)
    expect(t).toMatch(/10:30/)
    expect(t).toMatch(/Marcos/)
    expect(t).toMatch(/¿Te viene bien\?/)
  })

  it('proponer_cita sin starts_at: fallback sin fecha', () => {
    const t = generateActionText({ type: 'proponer_cita' }, { patientName: 'Ana', profName: 'Lorena' })
    expect(t).toMatch(/Hola Ana,/)
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
    expect(t).toMatch(/Hola Ricardo,/)
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
    expect(t).toMatch(/Hola Elena,/)
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
})
