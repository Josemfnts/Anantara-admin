import { describe, it, expect } from 'vitest'
import { solapan, detectarConflictos } from './conflictos.js'

// El panel solo miraba las citas que EMPIEZAN dentro del hueco nuevo:
//   .gte('starts_at', inicio).lt('starts_at', fin)
// Una cita que empieza ANTES y solapa por detrás no aparecía. Con los servicios
// de 90 min del catálogo y la duración personalizada de hasta 120, eso es
// alcanzable a diario. El bot sí lo hace bien (availability.js: aS < fin && aE > ini).
// Auditoría 2026-08-25, hallazgo A6.

describe('solapan', () => {
  it('la que empieza antes y termina dentro SÍ solapa — el caso que se escapaba', () => {
    expect(solapan(
      { starts_at: '2026-09-15T10:00:00', ends_at: '2026-09-15T12:00:00' },
      '2026-09-15T11:00:00', '2026-09-15T12:00:00'
    )).toBe(true)
  })

  it('la que empieza dentro solapa', () => {
    expect(solapan(
      { starts_at: '2026-09-15T11:30:00', ends_at: '2026-09-15T12:30:00' },
      '2026-09-15T11:00:00', '2026-09-15T12:00:00'
    )).toBe(true)
  })

  it('una que envuelve a la nueva solapa', () => {
    expect(solapan(
      { starts_at: '2026-09-15T09:00:00', ends_at: '2026-09-15T14:00:00' },
      '2026-09-15T11:00:00', '2026-09-15T12:00:00'
    )).toBe(true)
  })

  it('pegadas NO solapan: acabar a las 11:00 y empezar a las 11:00 es legítimo', () => {
    expect(solapan(
      { starts_at: '2026-09-15T10:00:00', ends_at: '2026-09-15T11:00:00' },
      '2026-09-15T11:00:00', '2026-09-15T12:00:00'
    )).toBe(false)
    expect(solapan(
      { starts_at: '2026-09-15T12:00:00', ends_at: '2026-09-15T13:00:00' },
      '2026-09-15T11:00:00', '2026-09-15T12:00:00'
    )).toBe(false)
  })

  it('sin ends_at, si cae DENTRO avisa igual', () => {
    // Duración desconocida → se avisa, que es lo conservador y lo que hace el bot
    // (availability.js: aE = ends_at || starts_at, y luego aS < fin && aE > ini).
    expect(solapan({ starts_at: '2026-09-15T11:30:00' }, '2026-09-15T11:00:00', '2026-09-15T12:00:00')).toBe(true)
    // Fuera del hueco, no.
    expect(solapan({ starts_at: '2026-09-15T13:00:00' }, '2026-09-15T11:00:00', '2026-09-15T12:00:00')).toBe(false)
  })

  it('el sufijo de zona no descoloca la comparación', () => {
    expect(solapan(
      { starts_at: '2026-09-15T10:00:00+00:00', ends_at: '2026-09-15T12:00:00+00:00' },
      '2026-09-15T11:00:00', '2026-09-15T12:00:00'
    )).toBe(true)
  })

  it('tolera basura sin lanzar', () => {
    expect(solapan(null, '2026-09-15T11:00:00', '2026-09-15T12:00:00')).toBe(false)
    expect(solapan({}, '2026-09-15T11:00:00', '2026-09-15T12:00:00')).toBe(false)
  })
})

describe('detectarConflictos', () => {
  const slot = { startsAt: '2026-09-15T11:00:00', endsAt: '2026-09-15T12:00:00' }  // martes

  it('sin nada en contra, no hay conflictos', () => {
    expect(detectarConflictos({}, slot)).toEqual([])
  })

  it('caza la cita que empieza antes', () => {
    const c = detectarConflictos({
      citas: [{ id: 'a', starts_at: '2026-09-15T10:00:00', ends_at: '2026-09-15T12:00:00', patients: { full_name: 'Ana López' } }],
    }, slot)
    expect(c).toHaveLength(1)
    expect(c[0].tipo).toBe('cita')
    expect(c[0].texto).toMatch(/Ana López/)
    expect(c[0].texto).toMatch(/10:00/)
  })

  it('excluye la cita que se está editando', () => {
    const citas = [{ id: 'esta', starts_at: '2026-09-15T11:00:00', ends_at: '2026-09-15T12:00:00' }]
    expect(detectarConflictos({ citas }, { ...slot, excludeId: 'esta' })).toEqual([])
  })

  it('ignora las canceladas', () => {
    const citas = [{ id: 'a', starts_at: '2026-09-15T11:00:00', ends_at: '2026-09-15T12:00:00', status: 'cancelled' }]
    expect(detectarConflictos({ citas }, slot)).toEqual([])
  })

  it('caza los bloqueos de agenda, que el panel no miraba al crear', () => {
    const c = detectarConflictos({
      bloqueos: [{ starts_at: '2026-09-15T11:30:00', ends_at: '2026-09-15T13:00:00', reason: 'Formación' }],
    }, slot)
    expect(c).toHaveLength(1)
    expect(c[0].tipo).toBe('bloqueo')
    expect(c[0].texto).toMatch(/Formación/)
  })

  it('caza el descanso del profesional (Marcos 11:30-12:00 entre semana)', () => {
    const c = detectarConflictos({
      descansos: [{ day_of_week: 2, start_time: '11:30:00', end_time: '12:00:00' }],
    }, slot)
    expect(c).toHaveLength(1)
    expect(c[0].tipo).toBe('descanso')
  })

  it('un descanso de OTRO día de la semana no cuenta', () => {
    const c = detectarConflictos({
      descansos: [{ day_of_week: 4, start_time: '11:30:00', end_time: '12:00:00' }],
    }, slot)
    expect(c).toEqual([])
  })

  it('caza el día bloqueado entero', () => {
    const c = detectarConflictos({ diaBloqueado: true }, slot)
    expect(c).toHaveLength(1)
    expect(c[0].tipo).toBe('dia')
  })

  it('caza el hueco retenido para la lista de espera', () => {
    const c = detectarConflictos({
      retenidos: [{ starts_at: '2026-09-15T11:00:00', ends_at: '2026-09-15T12:00:00' }],
    }, slot)
    expect(c).toHaveLength(1)
    expect(c[0].tipo).toBe('retenido')
  })

  it('acumula varios conflictos a la vez', () => {
    const c = detectarConflictos({
      citas: [{ id: 'a', starts_at: '2026-09-15T10:00:00', ends_at: '2026-09-15T12:00:00' }],
      descansos: [{ day_of_week: 2, start_time: '11:30:00', end_time: '12:00:00' }],
      diaBloqueado: true,
    }, slot)
    expect(c.map(x => x.tipo).sort()).toEqual(['cita', 'descanso', 'dia'])
  })

  it('tolera entradas incompletas sin lanzar', () => {
    expect(detectarConflictos(null, slot)).toEqual([])
    expect(detectarConflictos({}, null)).toEqual([])
    expect(detectarConflictos({ citas: [null, undefined] }, slot)).toEqual([])
  })
})
