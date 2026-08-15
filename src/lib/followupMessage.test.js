import { describe, it, expect } from 'vitest'
import { buildFollowupMessage, weekText, buildNextAppointmentReminder } from './followupMessage.js'

describe('weekText', () => {
  it('formatea 1, 2 y N semanas', () => {
    expect(weekText(1)).toBe('la semana que viene')
    expect(weekText(2)).toBe('dentro de dos semanas')
    expect(weekText(4)).toBe('dentro de 4 semanas')
  })
})

describe('buildFollowupMessage', () => {
  it('despedida cuando no hay semanas ni lista de espera', () => {
    const msg = buildFollowupMessage({ weeks: 0, waitlist: false, profName: 'Marcos' })
    expect(msg).toContain('no me apunta que vuelva a citarte')
    expect(msg).toContain('Marcos')
  })

  it('vacío con semanas + horas (el bot busca y envía la oferta)', () => {
    expect(buildFollowupMessage({ weeks: 3, hasHours: true, waitlist: false, profName: 'Marcos' })).toBe('')
  })

  it('CASO 3: vacío con semanas + horas + lista de espera (lo manda el bot, no el cuadro)', () => {
    expect(buildFollowupMessage({ weeks: 4, hasHours: true, waitlist: true, profName: 'Marcos' })).toBe('')
  })

  it('CASO 4: semanas + lista de espera SIN horas → mensaje manual "no tengo hueco"', () => {
    const msg = buildFollowupMessage({ weeks: 4, hasHours: false, waitlist: true, profName: 'Lorena' })
    expect(msg).toContain('dentro de 4 semanas')
    expect(msg).toContain('no tengo hueco aun disponible')
    expect(msg).toContain('Lorena')
  })

  it('semanas sin horas y sin lista de espera → vacío (el bot busca a cualquier hora)', () => {
    expect(buildFollowupMessage({ weeks: 3, hasHours: false, waitlist: false, profName: 'Marcos' })).toBe('')
  })

  it('formatea semanas 1 y 2 en modo waitlist (sin horas)', () => {
    expect(buildFollowupMessage({ weeks: 1, hasHours: false, waitlist: true, profName: 'Marcos' })).toContain('la semana que viene')
    expect(buildFollowupMessage({ weeks: 2, hasHours: false, waitlist: true, profName: 'Marcos' })).toContain('dentro de dos semanas')
  })
})

// ─── Recordar la próxima cita (pacientes con citas recurrentes) ──────────────
// Para quien ya tiene su cita semanal dada: no se le asigna nada nuevo, solo se
// le recuerda la que tiene. La secretaria le da al botón, revisa y envía.
describe('buildNextAppointmentReminder', () => {
  const MANANA = new Date('2026-08-14T08:00:00')   // 10:00 Madrid → Buenos días
  const TARDE = new Date('2026-08-14T15:00:00')    // 17:00 Madrid → Buenas tardes

  it('genera el texto canónico con día, hora y profesional', () => {
    expect(buildNextAppointmentReminder({
      startsAt: '2026-08-26T10:30:00', profName: 'Marcos', now: MANANA,
    })).toBe('Buenos días, te recuerdo que la próxima cita es el miércoles 26 de agosto a las 10:30 con Marcos, confírmame gracias.')
  })

  it('saluda según la hora', () => {
    expect(buildNextAppointmentReminder({ startsAt: '2026-08-26T10:30:00', profName: 'Marcos', now: TARDE }))
      .toMatch(/^Buenas tardes,/)
  })

  it('sin profesional omite la coletilla, sin dejar espacios raros', () => {
    expect(buildNextAppointmentReminder({ startsAt: '2026-08-26T10:30:00', now: MANANA }))
      .toBe('Buenos días, te recuerdo que la próxima cita es el miércoles 26 de agosto a las 10:30, confírmame gracias.')
  })

  it('nunca nombra al paciente', () => {
    const msg = buildNextAppointmentReminder({ startsAt: '2026-08-26T10:30:00', profName: 'Marcos', now: MANANA })
    expect(msg).not.toMatch(/Hola /)
  })

  it('el día NO se desfasa a medianoche ni a última hora', () => {
    expect(buildNextAppointmentReminder({ startsAt: '2026-08-26T00:00:00', now: MANANA }))
      .toMatch(/miércoles 26 de agosto/)
    expect(buildNextAppointmentReminder({ startsAt: '2026-08-26T23:30:00', now: MANANA }))
      .toMatch(/miércoles 26 de agosto/)
  })

  it('cruza bien el cambio de mes', () => {
    expect(buildNextAppointmentReminder({ startsAt: '2026-09-01T09:00:00', now: MANANA }))
      .toMatch(/martes 1 de septiembre/)
  })

  it('sin cita devuelve cadena vacía, sin lanzar', () => {
    expect(buildNextAppointmentReminder({ startsAt: null })).toBe('')
    expect(buildNextAppointmentReminder({ startsAt: '' })).toBe('')
    expect(buildNextAppointmentReminder({ startsAt: 'basura' })).toBe('')
    expect(buildNextAppointmentReminder({})).toBe('')
    expect(buildNextAppointmentReminder()).toBe('')
  })
})
