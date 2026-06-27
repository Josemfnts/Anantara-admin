import { describe, it, expect } from 'vitest'
import { quickRepliesFor } from './quickReplies.js'

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
