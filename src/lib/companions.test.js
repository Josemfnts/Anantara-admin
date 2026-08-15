import { describe, it, expect } from 'vitest'
import { parseCompanions, textoAcompanantes } from './companions.js'

describe('parseCompanions', () => {
  it('separa por coma y limpia espacios', () => {
    expect(parseCompanions('Lucía, Pedro')).toEqual(['Lucía', 'Pedro'])
    expect(parseCompanions('  Lucía ,  Pedro  ')).toEqual(['Lucía', 'Pedro'])
  })

  it('ignora comas de más y huecos', () => {
    expect(parseCompanions('Lucía,,Pedro,')).toEqual(['Lucía', 'Pedro'])
    expect(parseCompanions('  ,  ')).toEqual([])
  })

  it('vacío o nulo → lista vacía', () => {
    expect(parseCompanions('')).toEqual([])
    expect(parseCompanions(null)).toEqual([])
    expect(parseCompanions(undefined)).toEqual([])
  })
})

describe('textoAcompanantes', () => {
  // Debe coincidir EXACTAMENTE con la función homónima del bot
  // (anantara-whatsapp/v5/src/cron/reminders.js), que es quien manda el
  // recordatorio de verdad. Aquí solo alimenta la vista previa del panel.
  it('uno solo → "para ti y X"', () => {
    expect(textoAcompanantes(['Lucía'])).toBe(' para ti y Lucía')
  })

  it('varios → coma y "y" antes del último', () => {
    expect(textoAcompanantes(['Lucía', 'Pedro'])).toBe(' para ti, Lucía y Pedro')
    expect(textoAcompanantes(['Lucía', 'Pedro', 'Ana'])).toBe(' para ti, Lucía, Pedro y Ana')
  })

  it('sin acompañantes no añade nada', () => {
    expect(textoAcompanantes([])).toBe('')
    expect(textoAcompanantes(null)).toBe('')
    expect(textoAcompanantes('no es array')).toBe('')
  })

  it('ignora nombres vacíos', () => {
    expect(textoAcompanantes(['  Lucía  ', '', null])).toBe(' para ti y Lucía')
  })

  it('el resultado empieza por espacio, para concatenar sin pegarse', () => {
    expect(textoAcompanantes(['Lucía']).startsWith(' ')).toBe(true)
  })
})
