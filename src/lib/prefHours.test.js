import { describe, it, expect } from 'vitest'
import { slotStartMinutes, preferredMinutesOf, huecoMatchesPreferred, minutesToLabel, preferredHoursLabel } from './prefHours.js'

// Este módulo es el espejo en el panel de v5/src/tools/helpers/pref-hours.js.
// Si los dos dejan de coincidir, Marta ve unas horas admitidas y el bot ofrece
// otras. El contrato: preferred_hours en MINUTOS desde medianoche; la columna
// antigua preferred_hour en HORAS enteras.

describe('slotStartMinutes', () => {
  it('lee la hora Y los minutos del slot', () => {
    expect(slotStartMinutes('2026-09-10T08:00:00')).toBe(480)
    expect(slotStartMinutes('2026-09-10T08:30:00')).toBe(510)
    expect(slotStartMinutes('2026-09-10T13:30:00')).toBe(810)
  })
  it('sin fecha devuelve null en vez de NaN', () => {
    expect(slotStartMinutes(null)).toBe(null)
  })
})

describe('preferredMinutesOf', () => {
  it('la columna nueva (plural) manda', () => {
    expect(preferredMinutesOf({ preferred_hours: [480, 510], preferred_hour: 13 })).toEqual([480, 510])
  })
  it('convierte la columna antigua a minutos', () => {
    expect(preferredMinutesOf({ preferred_hour: 8 })).toEqual([480])
  })
  it('sin preferencias devuelve null', () => {
    expect(preferredMinutesOf({})).toBe(null)
    expect(preferredMinutesOf({ preferred_hours: [] })).toBe(null)
  })
})

describe('huecoMatchesPreferred', () => {
  it('sin preferencias, todo vale', () => {
    expect(huecoMatchesPreferred('2026-09-10T07:00:00', {})).toBe(true)
  })
  it('acepta cualquiera de las horas marcadas', () => {
    const row = { preferred_hours: [480, 810] }
    expect(huecoMatchesPreferred('2026-09-10T08:00:00', row)).toBe(true)
    expect(huecoMatchesPreferred('2026-09-10T13:30:00', row)).toBe(true)
    expect(huecoMatchesPreferred('2026-09-10T09:00:00', row)).toBe(false)
  })
  // El bug que arregla: comparar solo la hora daba por bueno un hueco de las
  // 08:30 a quien había pedido las 08:00.
  it('la media hora NO cuela como la hora en punto', () => {
    expect(huecoMatchesPreferred('2026-09-10T08:30:00', { preferred_hour: 8 })).toBe(false)
    expect(huecoMatchesPreferred('2026-09-10T08:00:00', { preferred_hour: 8 })).toBe(true)
  })
})

describe('etiquetas para la tabla', () => {
  it('minutesToLabel pinta HH:MM con cero delante', () => {
    expect(minutesToLabel(480)).toBe('08:00')
    expect(minutesToLabel(510)).toBe('08:30')
    expect(minutesToLabel(0)).toBe('00:00')
  })
  it('sin preferencias dice Cualquiera', () => {
    expect(preferredHoursLabel({})).toBe('Cualquiera')
  })
  it('ordena y resume cuando hay muchas', () => {
    expect(preferredHoursLabel({ preferred_hours: [810, 480] })).toBe('08:00, 13:30')
    expect(preferredHoursLabel({ preferred_hours: [480, 510, 540, 570, 600] })).toBe('08:00, 08:30, 09:00 +2')
  })
  it('la fila antigua de una sola hora se sigue leyendo', () => {
    expect(preferredHoursLabel({ preferred_hour: 9 })).toBe('09:00')
  })
})
