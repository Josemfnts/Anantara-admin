import { describe, it, expect } from 'vitest'
import { citaEnPasado, estadoAlta, horaSiguiente } from './altaCita.js'

const ahora = new Date('2026-11-02T18:30:00')

describe('estadoAlta', () => {
  it('futura con pendiente marcado → pending', () => {
    expect(estadoAlta({ dejarPendiente: true, inicio: new Date('2026-11-03T10:00:00'), ahora })).toBe('pending')
  })
  it('pasada con pendiente marcado → confirmed (no sale WhatsApp)', () => {
    expect(estadoAlta({ dejarPendiente: true, inicio: new Date('2026-10-09T10:00:00'), ahora })).toBe('confirmed')
  })
  it('futura sin pendiente → confirmed', () => {
    expect(estadoAlta({ dejarPendiente: false, inicio: new Date('2026-11-03T10:00:00'), ahora })).toBe('confirmed')
  })
})

describe('citaEnPasado', () => {
  it('compara con el momento exacto', () => {
    expect(citaEnPasado(new Date('2026-11-02T18:00:00'), ahora)).toBe(true)
    expect(citaEnPasado(new Date('2026-11-02T19:00:00'), ahora)).toBe(false)
  })
})

describe('horaSiguiente', () => {
  it('deja la hora exacta si cae en media hora', () => {
    expect(horaSiguiente(new Date('2026-11-03T11:00:00'))).toBe('11:00')
    expect(horaSiguiente(new Date('2026-11-03T11:30:00'))).toBe('11:30')
  })
  it('redondea hacia arriba', () => {
    expect(horaSiguiente(new Date('2026-11-03T10:45:00'))).toBe('11:00')
    expect(horaSiguiente(new Date('2026-11-03T10:15:00'))).toBe('10:30')
  })
  it('más allá del selector → vacío', () => {
    expect(horaSiguiente(new Date('2026-11-03T21:45:00'))).toBe('')
  })
})
