import { describe, it, expect } from 'vitest'
import { fClock, fClockDT } from './datetime.js'

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
