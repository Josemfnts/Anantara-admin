import { describe, it, expect } from 'vitest'
import { fClock, fClockDT, fDayLabel, madridDay } from './datetime.js'

// El bug: un timestamptz UTC se mostraba en UTC (1-2h de desfase) en el chat.
// Estos tests fijan que se muestra en hora de Madrid, y son deterministas porque
// el formateador fuerza Europe/Madrid (no depende de la tz de la máquina/CI).

describe('fClock — hora del centro desde timestamptz UTC', () => {
  it('verano (CEST, UTC+2): 14:30 UTC → 16:30 Madrid', () => {
    expect(fClock('2026-06-26T14:30:00+00:00')).toBe('16:30')
  })
  it('invierno (CET, UTC+1): 14:30 UTC → 15:30 Madrid', () => {
    expect(fClock('2026-01-15T14:30:00Z')).toBe('15:30')
  })
  it('acepta el formato con microsegundos de Supabase', () => {
    expect(fClock('2026-06-26T08:05:00.123456+00:00')).toBe('10:05')
  })
  it('cruce de medianoche: 23:30 UTC en verano → 01:30 del día siguiente', () => {
    expect(fClock('2026-06-26T23:30:00Z')).toBe('01:30')
  })
  it('nulo o inválido → guion', () => {
    expect(fClock(null)).toBe('—')
    expect(fClock('no-es-fecha')).toBe('—')
  })
})

describe('fClockDT — día + hora del centro', () => {
  it('verano: 14:30 UTC del 26 jun → 26 jun · 16:30', () => {
    expect(fClockDT('2026-06-26T14:30:00+00:00')).toBe('26 jun · 16:30')
  })
  it('cruce de medianoche cambia el día: 23:30 UTC del 26 jun → 27 jun · 01:30', () => {
    expect(fClockDT('2026-06-26T23:30:00Z')).toBe('27 jun · 01:30')
  })
  it('nulo → guion', () => {
    expect(fClockDT(null)).toBe('—')
  })
})

// Separadores de día en los chats (Bot Coach y Bot móvil). Sin ellos, una
// conversación de varios días parece desordenada: se ve "21:30" y justo debajo
// "08:02", que es del día siguiente. Aviso de Josema del 19-ago.
describe('madridDay / fDayLabel — separadores de día en el chat', () => {
  const hoy = new Date('2026-08-19T12:00:00Z')

  it('agrupa por día de pared en Madrid, no por día UTC', () => {
    // 23:30 en Madrid (CEST, UTC+2) es ya el día siguiente en UTC.
    expect(madridDay('2026-08-18T21:30:00Z')).toBe('2026-08-18')
    expect(madridDay('2026-08-18T22:30:00Z')).toBe('2026-08-19')
  })

  it('devuelve null si el timestamp no vale', () => {
    expect(madridDay(null)).toBe(null)
    expect(madridDay('no-es-fecha')).toBe(null)
  })

  it('etiqueta Hoy y Ayer', () => {
    expect(fDayLabel('2026-08-19T06:02:00Z', hoy)).toBe('Hoy')
    expect(fDayLabel('2026-08-18T19:30:00Z', hoy)).toBe('Ayer')
  })

  it('días anteriores del mismo año llevan día de la semana', () => {
    expect(fDayLabel('2026-08-12T09:00:00Z', hoy)).toBe('miércoles 12 ago')
  })

  it('otro año lleva el año en vez del día de la semana', () => {
    expect(fDayLabel('2025-11-03T09:00:00Z', hoy)).toBe('3 nov 2025')
  })

  it('timestamp inválido no rompe el render', () => {
    expect(fDayLabel(null, hoy)).toBe('')
    expect(fDayLabel('no-es-fecha', hoy)).toBe('')
  })
})
