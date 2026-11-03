import { describe, it, expect } from 'vitest'
import { clasesQueFaltan, lunesDe, porSemana, propagarPlantilla, etiquetaSeccion } from './clases.js'

const TPL = { id: 't', day_of_week: 2, start_time: '17:00:00', end_time: '18:30:00', max_bookings: 10, service_id: 's', professional_id: 'p' }

describe('clasesQueFaltan', () => {
  it('genera los martes que faltan en el periodo', () => {
    const desde = new Date(2026, 10, 3, 9, 0) // martes 3/11, 9:00
    const r = clasesQueFaltan(TPL, ['2026-11-10'], desde, 2)
    expect(r.map(c => c.starts_at)).toEqual(['2026-11-03T17:00:00', '2026-11-17T17:00:00'])
    expect(r[0]).toMatchObject({ ends_at: '2026-11-03T18:30:00', template_id: 't', max_bookings: 10 })
  })
  it('hoy no cuenta si la clase ya empezó', () => {
    const r = clasesQueFaltan(TPL, [], new Date(2026, 10, 3, 17, 30), 1)
    expect(r.map(c => c.starts_at)).toEqual(['2026-11-10T17:00:00'])
  })
})

describe('semanas', () => {
  it('lunes de la semana', () => {
    expect(lunesDe('2026-11-08T10:00:00')).toBe('2026-11-02') // domingo
    expect(lunesDe('2026-11-03')).toBe('2026-11-02')
  })
  it('agrupa por semana', () => {
    const g = porSemana([{ starts_at: '2026-11-03T17:00' }, { starts_at: '2026-11-05T17:00' }, { starts_at: '2026-11-10T17:00' }])
    expect(g.map(x => [x.lunes, x.clases.length])).toEqual([['2026-11-02', 2], ['2026-11-09', 1]])
  })
})

describe('propagarPlantilla', () => {
  it('cambia hora y plazas, salta las iguales y no baja por debajo de las reservas', () => {
    const clases = [
      { id: 'a', starts_at: '2026-11-10T17:00:00', ends_at: '2026-11-10T18:30:00', max_bookings: 10, bookings: [] },
      { id: 'b', starts_at: '2026-11-17T17:00:00', ends_at: '2026-11-17T18:30:00', max_bookings: 10, bookings: Array(7).fill({ status: 'confirmed' }) },
    ]
    const nueva = { ...TPL, start_time: '18:00', end_time: '19:30', max_bookings: 6 }
    const r = propagarPlantilla(nueva, clases)
    expect(r.cambios).toEqual([{ id: 'a', cambios: { starts_at: '2026-11-10T18:00:00', ends_at: '2026-11-10T19:30:00', max_bookings: 6 } }])
    expect(r.bloqueadas).toEqual(['b'])
    expect(propagarPlantilla(TPL, [clases[0]]).cambios).toEqual([])
  })
})

it('etiqueta de sección', () => {
  expect(etiquetaSeccion('escalada')).toBe('Escalada')
  expect(etiquetaSeccion('x')).toBe('Clase')
})
