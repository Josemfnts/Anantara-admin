import { describe, it, expect } from 'vitest'
import { leerLista, normalizarTelefono, anadirALista, diasVigentes, horaPropuestaOmitida } from './ajustesBot.js'

describe('leerLista', () => {
  it('lee JSON y aguanta basura', () => {
    expect(leerLista('["a","b"]')).toEqual(['a', 'b'])
    expect(leerLista('roto')).toEqual([])
    expect(leerLista(null)).toEqual([])
    expect(leerLista('{"a":1}')).toEqual([])
  })
})

describe('normalizarTelefono', () => {
  it('acepta espacios y prefijo', () => {
    expect(normalizarTelefono('600 111 222')).toBe('600111222')
    expect(normalizarTelefono('+34 600111222')).toBe('600111222')
  })
  it('rechaza lo que no son 9 dígitos', () => {
    expect(normalizarTelefono('12345')).toBeNull()
    expect(normalizarTelefono('')).toBeNull()
  })
})

describe('listas', () => {
  it('no duplica y ordena', () => {
    expect(anadirALista(['b'], 'a')).toEqual(['a', 'b'])
    expect(anadirALista(['a'], 'a')).toEqual(['a'])
  })
  it('quita los días pasados, conserva hoy', () => {
    expect(diasVigentes(['2026-11-01', '2026-11-03', '2026-11-02'], '2026-11-02')).toEqual(['2026-11-02', '2026-11-03'])
  })
})

describe('horaPropuestaOmitida', () => {
  const accion = { type: 'proponer_cita', starts_at: '2026-10-28T09:00:00' }
  const orig = 'Tengo hueco el miércoles a las 09:00 con Marcos.'
  it('texto sin tocar → nada', () => {
    expect(horaPropuestaOmitida(accion, orig, orig)).toBeNull()
  })
  it('texto cambiado que quita la hora → avisa', () => {
    expect(horaPropuestaOmitida(accion, 'Tengo pendientes, si no la semana que viene', orig)).toBe('09:00')
  })
  it('texto cambiado que conserva la hora en cualquier forma → nada', () => {
    expect(horaPropuestaOmitida(accion, 'Te va bien a las 9:00?', orig)).toBeNull()
    expect(horaPropuestaOmitida(accion, 'Te va bien a las 9?', orig)).toBeNull()
    expect(horaPropuestaOmitida(accion, 'a las 09.00 entonces', orig)).toBeNull()
  })
  it('no confunde otra hora', () => {
    expect(horaPropuestaOmitida(accion, 'a las 19:00 entonces', orig)).toBe('09:00')
  })
  it('otras acciones → nada', () => {
    expect(horaPropuestaOmitida({ type: 'cancelar_cita' }, 'x', orig)).toBeNull()
  })
})
