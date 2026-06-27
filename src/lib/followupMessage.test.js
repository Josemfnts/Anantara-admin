import { describe, it, expect } from 'vitest'
import { buildFollowupMessage, weekText } from './followupMessage.js'

describe('weekText', () => {
  it('formatea 1, 2 y N semanas', () => {
    expect(weekText(1)).toBe('la semana que viene')
    expect(weekText(2)).toBe('dentro de dos')
    expect(weekText(4)).toBe('dentro de 4 semanas')
  })
})

describe('buildFollowupMessage', () => {
  it('mensaje de despedida cuando no hay semanas ni lista de espera', () => {
    const msg = buildFollowupMessage({ weeks: 0, waitlist: false, profName: 'Marcos' })
    expect(msg).toContain('no me apunta que vuelva a citarte')
    expect(msg).toContain('Marcos')
  })

  it('vacío cuando hay semanas sin lista de espera (bot envía mensaje)', () => {
    expect(buildFollowupMessage({ weeks: 3, waitlist: false, profName: 'Marcos' })).toBe('')
  })

  it('mensaje de solo lista de espera + semanas', () => {
    const msg = buildFollowupMessage({ weeks: 4, waitlist: true, profName: 'Lorena' })
    expect(msg).toContain('dentro de 4 semanas')
    expect(msg).toContain('no tengo hueco aun disponible')
    expect(msg).toContain('Lorena')
  })

  it('formatea semanas 1 y 2 correctamente en modo waitlist', () => {
    expect(buildFollowupMessage({ weeks: 1, waitlist: true, profName: 'Marcos' })).toContain('la semana que viene')
    expect(buildFollowupMessage({ weeks: 2, waitlist: true, profName: 'Marcos' })).toContain('dentro de dos')
  })
})
