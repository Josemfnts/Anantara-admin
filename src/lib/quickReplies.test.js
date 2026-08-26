import { describe, it, expect } from 'vitest'
import { quickRepliesFor, despedidaSegunFecha } from './quickReplies.js'

describe('quickRepliesFor — set por contexto', () => {
  it('confirmacion → frases de confirmación', () => {
    expect(quickRepliesFor('confirmacion')).toContain('Perfecto, hasta mañana.')
  })
  it('cancelacion → incluye una frase de reprogramar', () => {
    const set = quickRepliesFor('cancelacion')
    expect(set).toContain('Hecho, cancelada.')
    expect(set.some(s => /reprograme|otro hueco/i.test(s))).toBe(true)
  })
  it('ambigua → pregunta por día/fecha', () => {
    expect(quickRepliesFor('ambigua').some(s => /día|fecha/i.test(s))).toBe(true)
  })
  it('otra → set de otra', () => {
    expect(quickRepliesFor('otra')).toContain('Te llamamos enseguida.')
  })
  it('sin category (null/undefined) → set generic', () => {
    expect(quickRepliesFor(null)).toContain('¡Hola! Dime, ¿en qué te ayudo?')
    expect(quickRepliesFor(undefined)).toContain('¡Hola! Dime, ¿en qué te ayudo?')
  })
  it('category desconocida → fallback a otra', () => {
    expect(quickRepliesFor('inexistente')).toEqual(quickRepliesFor('otra'))
  })
  it('todos los sets son arrays no vacíos de strings', () => {
    for (const cat of ['confirmacion', 'cancelacion', 'ambigua', 'otra', null]) {
      const set = quickRepliesFor(cat)
      expect(Array.isArray(set)).toBe(true)
      expect(set.length).toBeGreaterThan(0)
      expect(set.every(s => typeof s === 'string' && s.length)).toBe(true)
    }
  })
})

// El fallo más caro que encontró el digest de agosto: "Perfecto, hasta mañana."
// se mandó 45 veces, y decía «mañana» aunque la cita fuera el lunes. El bot lo
// arregló (despedidaD1); el panel lo seguía ofreciendo como primer botón, fijo.
// Auditoría 2026-08-25, hallazgo A5.
describe('despedidaSegunFecha — espejo de despedidaD1 del bot', () => {
  const hoy = new Date('2026-08-25T10:00:00')   // martes

  it('cita hoy → hasta luego', () => {
    expect(despedidaSegunFecha('2026-08-25T18:00:00', hoy)).toBe('Perfecto, hasta luego.')
  })
  it('cita mañana → hasta mañana', () => {
    expect(despedidaSegunFecha('2026-08-26T09:00:00', hoy)).toBe('Perfecto, hasta mañana.')
  })
  it('viernes → lunes: NO dice "mañana", dice el día', () => {
    // El caso exacto del bug: recordatorio del viernes para el lunes.
    const viernes = new Date('2026-08-28T10:00:00')
    expect(despedidaSegunFecha('2026-08-31T09:00:00', viernes)).toBe('Perfecto, hasta el lunes.')
  })
  it('entre 2 y 6 días → nombra el día de la semana', () => {
    expect(despedidaSegunFecha('2026-08-27T09:00:00', hoy)).toBe('Perfecto, hasta el jueves.')
  })
  it('a 7 días o más → hasta la cita', () => {
    expect(despedidaSegunFecha('2026-09-10T09:00:00', hoy)).toBe('Perfecto, hasta la cita.')
  })
  it('sin fecha o fecha inválida → hasta la cita (siempre cierto)', () => {
    expect(despedidaSegunFecha(null, hoy)).toBe('Perfecto, hasta la cita.')
    expect(despedidaSegunFecha('', hoy)).toBe('Perfecto, hasta la cita.')
    expect(despedidaSegunFecha('no-es-fecha', hoy)).toBe('Perfecto, hasta la cita.')
    expect(despedidaSegunFecha(12345, hoy)).toBe('Perfecto, hasta la cita.')
  })
})

describe('quickRepliesFor con fecha de cita', () => {
  const hoy = new Date('2026-08-25T10:00:00')

  it('pone primero la despedida CORRECTA para esa cita', () => {
    const set = quickRepliesFor('confirmacion', { startsAt: '2026-08-31T09:00:00', now: new Date('2026-08-28T10:00:00') })
    expect(set[0]).toBe('Perfecto, hasta el lunes.')
  })
  it('sin fecha, el primer botón es el que SIEMPRE es cierto', () => {
    const set = quickRepliesFor('confirmacion')
    expect(set[0]).toBe('Perfecto, hasta la cita.')
    expect(set[0]).not.toBe('Perfecto, hasta mañana.')
  })
  it('no duplica la opción elegida', () => {
    const set = quickRepliesFor('confirmacion', { startsAt: '2026-08-26T09:00:00', now: hoy })
    expect(set[0]).toBe('Perfecto, hasta mañana.')
    expect(set.filter(s => s === 'Perfecto, hasta mañana.')).toHaveLength(1)
  })
  it('las demás variantes siguen disponibles para elegir a mano', () => {
    const set = quickRepliesFor('confirmacion', { startsAt: '2026-08-26T09:00:00', now: hoy })
    expect(set).toContain('Perfecto, hasta la cita.')
    expect(set.length).toBeGreaterThan(1)
  })
})
