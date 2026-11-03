import { describe, it, expect } from 'vitest'
import { repartirHoras, ocupacion, conflictos, rellenar, nombreCorto, telefonoWhatsApp, diaLegible } from './jornadas.js'

const J = { start_time: '10:00:00', end_time: '14:00:00' }

describe('repartirHoras', () => {
  it('reparte en orden y por duración desde el inicio', () => {
    const r = repartirHoras(J, [{ id: 'a', duracion: 90 }, { id: 'b', duracion: 30 }, { id: 'c', duracion: 60 }])
    expect(r.horas).toEqual({ a: '10:00', b: '11:30', c: '12:00' })
    expect(r.sinHueco).toEqual([])
  })
  it('no mueve a quien ya tiene hora y rellena los huecos', () => {
    const r = repartirHoras(J, [{ id: 'x', duracion: 60, hora: '10:30' }, { id: 'a', duracion: 30 }, { id: 'b', duracion: 60 }])
    expect(r.horas).toEqual({ a: '10:00', b: '11:30' })
  })
  it('salta al siguiente cuarto de hora tras una hora rara', () => {
    const r = repartirHoras(J, [{ id: 'x', duracion: 50, hora: '10:00' }, { id: 'a', duracion: 30 }])
    expect(r.horas.a).toBe('11:00')
  })
  it('quien no cabe queda en sinHueco', () => {
    const r = repartirHoras({ start_time: '10:00', end_time: '11:00' }, [{ id: 'a', duracion: 60 }, { id: 'b', duracion: 30 }])
    expect(r.horas).toEqual({ a: '10:00' })
    expect(r.sinHueco).toEqual(['b'])
  })
})

describe('ocupacion y conflictos', () => {
  it('suma duraciones contra la franja', () => {
    expect(ocupacion(J, [{ duracion: 90 }, { duracion: 60 }])).toEqual({ total: 240, usados: 150, libres: 90, pasa: false })
    expect(ocupacion(J, [{ duracion: 150 }, { duracion: 150 }]).pasa).toBe(true)
  })
  it('marca solapes y horas fuera de la franja', () => {
    const c = conflictos(J, [
      { id: 'a', duracion: 60, hora: '10:00' }, { id: 'b', duracion: 60, hora: '10:30' },
      { id: 'c', duracion: 60, hora: '13:30' }, { id: 'd', duracion: 30, hora: '12:00' },
    ])
    expect([...c].sort()).toEqual(['a', 'b', 'c'])
  })
})

describe('textos', () => {
  it('rellena la plantilla y deja lo desconocido', () => {
    expect(rellenar('Hola {nombre}, {hora} {otro}', { nombre: 'Ana', hora: '10:00' })).toBe('Hola Ana, 10:00 {otro}')
  })
  it('nombre corto y teléfono con prefijo', () => {
    expect(nombreCorto('MARÍA LÓPEZ')).toBe('María')
    expect(telefonoWhatsApp('612 345 678')).toBe('34612345678')
    expect(telefonoWhatsApp('+34612345678')).toBe('34612345678')
    expect(telefonoWhatsApp('1234')).toBe(null)
  })
  it('día legible', () => {
    expect(diaLegible('2026-11-12')).toBe('jueves 12 de noviembre')
  })
})
