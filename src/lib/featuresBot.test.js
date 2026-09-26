import { describe, it, expect } from 'vitest'
import { featuresBot } from './featuresBot.js'

describe('featuresBot', () => {
  it('array JSON de strings → Set con esos valores', () => {
    const s = featuresBot('["cita_personalizada"]')
    expect(s.has('cita_personalizada')).toBe(true)
    expect(s.size).toBe(1)
  })

  it('varios flags', () => {
    const s = featuresBot('["cita_personalizada","otra_cosa"]')
    expect([...s].sort()).toEqual(['cita_personalizada', 'otra_cosa'])
  })

  it('fila ausente (null/undefined) → Set vacío', () => {
    expect(featuresBot(null).size).toBe(0)
    expect(featuresBot(undefined).size).toBe(0)
  })

  it('valor vacío → Set vacío', () => {
    expect(featuresBot('').size).toBe(0)
  })

  it('JSON inválido → Set vacío (fail-closed), no lanza', () => {
    expect(featuresBot('no es json').size).toBe(0)
    expect(featuresBot('{roto').size).toBe(0)
  })

  it('JSON válido pero no es array → Set vacío', () => {
    expect(featuresBot('{"cita_personalizada":true}').size).toBe(0)
    expect(featuresBot('"cita_personalizada"').size).toBe(0)
    expect(featuresBot('42').size).toBe(0)
  })

  it('ignora elementos que no son strings o están vacíos', () => {
    const s = featuresBot('["cita_personalizada", "", "  ", 42, null, true]')
    expect([...s]).toEqual(['cita_personalizada'])
  })

  it('recorta espacios de cada flag', () => {
    const s = featuresBot('[" cita_personalizada "]')
    expect(s.has('cita_personalizada')).toBe(true)
  })

  it('array vacío → Set vacío', () => {
    expect(featuresBot('[]').size).toBe(0)
  })
})
