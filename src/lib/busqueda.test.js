import { describe, it, expect } from 'vitest'
import { normBusqueda } from './busqueda.js'

describe('normBusqueda — normalización para buscar pacientes sin tildes', () => {
  it('quita tildes y pasa a minúsculas', () => {
    expect(normBusqueda('José')).toBe('jose')
  })
  it('varias palabras con tildes/mayúsculas', () => {
    expect(normBusqueda('ÁNGEL Muñoz')).toBe('angel munoz')
  })
  it('diéresis', () => {
    expect(normBusqueda('Güell')).toBe('guell')
  })
  it('null/undefined → cadena vacía', () => {
    expect(normBusqueda(null)).toBe('')
    expect(normBusqueda(undefined)).toBe('')
  })
  it('el texto de un teléfono no cambia', () => {
    expect(normBusqueda('976123456')).toBe('976123456')
  })
})
