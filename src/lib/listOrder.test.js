import { describe, it, expect } from 'vitest'
import { moveItem } from './listOrder.js'

describe('moveItem — reordenado puro para las listas (subir/bajar)', () => {
  const base = () => [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }]

  it('subir: mueve el elemento una posición hacia arriba', () => {
    expect(moveItem(base(), 2, 1).map(x => x.id)).toEqual(['a', 'c', 'b', 'd'])
  })
  it('bajar: mueve el elemento una posición hacia abajo', () => {
    expect(moveItem(base(), 1, 2).map(x => x.id)).toEqual(['a', 'c', 'b', 'd'])
  })
  it('no muta el array original', () => {
    const arr = base()
    moveItem(arr, 0, 3)
    expect(arr.map(x => x.id)).toEqual(['a', 'b', 'c', 'd'])
  })
  it('from===to → copia sin cambios', () => {
    expect(moveItem(base(), 2, 2).map(x => x.id)).toEqual(['a', 'b', 'c', 'd'])
  })
  it('fuera de rango → copia sin cambios (no rompe en los extremos)', () => {
    expect(moveItem(base(), 0, -1).map(x => x.id)).toEqual(['a', 'b', 'c', 'd'])
    expect(moveItem(base(), 3, 4).map(x => x.id)).toEqual(['a', 'b', 'c', 'd'])
  })
})
