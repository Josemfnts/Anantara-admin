import { describe, it, expect } from 'vitest'
import { buildFollowupMessage, weekText } from './followupMessage.js'

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
