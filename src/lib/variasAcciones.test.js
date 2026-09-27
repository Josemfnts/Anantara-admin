import { describe, it, expect } from 'vitest'
import {
  esVarias, accionesDe, finalActionDe, reemplazarAccion, hayDestructivaMarcada,
  propuestasAnulables, conAnulaciones, idsYaUsados,
} from './variasAcciones.js'

const confirmar = (id) => ({ type: 'confirmar_propuesta', appointment_id: id, patient_id: 'p1' })
const descartar = (id) => ({ type: 'descartar_propuesta', patient_id: 'p1', old_proposal_id: id })
const cancelar = (id) => ({ type: 'cancelar_cita', appointment_id: id, patient_id: 'p1' })
const proponer = (starts_at = '2026-10-01T10:00:00') => ({ type: 'proponer_cita', patient_id: 'p1', professional_id: 'prof1', starts_at })

describe('esVarias', () => {
  it('true con type varias y acciones array', () => {
    expect(esVarias({ type: 'varias', acciones: [confirmar('a')] })).toBe(true)
  })
  it('false si no hay array de acciones', () => {
    expect(esVarias({ type: 'varias' })).toBe(false)
  })
  it('false para una acción suelta', () => {
    expect(esVarias(confirmar('a'))).toBe(false)
  })
  it('false para null', () => {
    expect(esVarias(null)).toBe(false)
  })
})

describe('accionesDe', () => {
  it('null → []', () => {
    expect(accionesDe(null)).toEqual([])
  })
  it('acción suelta → array de 1', () => {
    const a = confirmar('a')
    expect(accionesDe(a)).toEqual([a])
  })
  it('varias → copia del array (no la misma referencia)', () => {
    const acciones = [confirmar('a'), descartar('b')]
    const v = { type: 'varias', acciones }
    const out = accionesDe(v)
    expect(out).toEqual(acciones)
    expect(out).not.toBe(acciones)
  })
})

describe('finalActionDe', () => {
  const acciones = [confirmar('a'), descartar('b'), cancelar('c')]

  it('0 marcadas → sin acción, sin aprobar', () => {
    expect(finalActionDe(acciones, [false, false, false])).toEqual({ final_action: null, action_approved: false })
  })
  it('1 marcada → esa acción SUELTA (no envuelta en varias)', () => {
    const r = finalActionDe(acciones, [false, true, false])
    expect(r.final_action).toEqual(descartar('b'))
    expect(r.action_approved).toBe(true)
  })
  it('≥2 marcadas → varias, en el orden original', () => {
    const r = finalActionDe(acciones, [true, false, true])
    expect(r.final_action).toEqual({ type: 'varias', acciones: [confirmar('a'), cancelar('c')] })
    expect(r.action_approved).toBe(true)
  })
  it('todas marcadas → varias con las 3, orden intacto', () => {
    const r = finalActionDe(acciones, [true, true, true])
    expect(r.final_action.acciones).toEqual(acciones)
  })
  it('marcadas más corto que acciones → los que faltan cuentan como no marcados', () => {
    const r = finalActionDe(acciones, [true])
    expect(r.final_action).toEqual(confirmar('a'))
  })
})

describe('reemplazarAccion', () => {
  it('sustituye una posición por una acción suelta', () => {
    const acciones = [confirmar('a'), descartar('b')]
    const out = reemplazarAccion(acciones, 0, cancelar('x'))
    expect(out).toEqual([cancelar('x'), descartar('b')])
  })
  it('si la nueva es varias, se APLANA en esa posición (nunca anida)', () => {
    const acciones = [confirmar('a'), descartar('b')]
    const nueva = { type: 'varias', acciones: [proponer(), descartar('z')] }
    const out = reemplazarAccion(acciones, 1, nueva)
    expect(out).toEqual([confirmar('a'), proponer(), descartar('z')])
    expect(out.some(esVarias)).toBe(false)
  })
  it('deduplica descartar_propuesta con el mismo old_proposal_id, quedándose con la última', () => {
    const acciones = [descartar('dup'), confirmar('a')]
    // Al editar la posición 1 metemos otro descartar('dup') vía una varias insertada.
    const nueva = { type: 'varias', acciones: [proponer(), descartar('dup')] }
    const out = reemplazarAccion(acciones, 1, nueva)
    // Solo debe quedar UN descartar('dup'), el insertado (el más reciente), y
    // el orden de lo demás se conserva.
    const descartes = out.filter(a => a.type === 'descartar_propuesta' && a.old_proposal_id === 'dup')
    expect(descartes.length).toBe(1)
    expect(out).toEqual([proponer(), descartar('dup')])
  })
  it('sin duplicados no toca nada', () => {
    const acciones = [confirmar('a'), descartar('b'), cancelar('c')]
    const out = reemplazarAccion(acciones, 2, cancelar('c2'))
    expect(out).toEqual([confirmar('a'), descartar('b'), cancelar('c2')])
  })
})

describe('hayDestructivaMarcada', () => {
  const acciones = [confirmar('a'), descartar('b'), cancelar('c')]
  it('true si alguna marcada es destructiva', () => {
    expect(hayDestructivaMarcada(acciones, [true, true, false])).toBe(true)
  })
  it('false si las marcadas no son destructivas', () => {
    expect(hayDestructivaMarcada(acciones, [true, false, false])).toBe(false)
  })
  it('false si ninguna está marcada', () => {
    expect(hayDestructivaMarcada(acciones, [false, false, false])).toBe(false)
  })
})

describe('propuestasAnulables', () => {
  const AHORA = new Date('2026-09-27T12:00:00Z')
  const citas = [
    { id: '1', status: 'pending', cancellation_hold_id: null, starts_at: '2026-10-01T10:00:00' },
    { id: '2', status: 'pending', cancellation_hold_id: 'hold1', starts_at: '2026-10-01T10:00:00' }, // con hold: no cuenta
    { id: '3', status: 'confirmed', cancellation_hold_id: null, starts_at: '2026-10-01T10:00:00' }, // no pending
    { id: '4', status: 'pending', cancellation_hold_id: null, starts_at: '2020-01-01T10:00:00' }, // pasada
    { id: '5', status: 'pending', cancellation_hold_id: null, starts_at: '2026-11-01T10:00:00' },
  ]

  it('solo pending, sin hold y futuras', () => {
    const out = propuestasAnulables(citas, { ahora: AHORA })
    expect(out.map(c => c.id)).toEqual(['1', '5'])
  })
  it('excluirIds quita las que ya usa otra sub-acción', () => {
    const out = propuestasAnulables(citas, { ahora: AHORA, excluirIds: ['1'] })
    expect(out.map(c => c.id)).toEqual(['5'])
  })
  it('lista vacía o sin citas → []', () => {
    expect(propuestasAnulables([], { ahora: AHORA })).toEqual([])
    expect(propuestasAnulables(undefined, { ahora: AHORA })).toEqual([])
  })
})

describe('conAnulaciones', () => {
  it('sin ids → la acción tal cual (no la envuelve)', () => {
    const accion = proponer()
    expect(conAnulaciones(accion, [], 'p1')).toBe(accion)
    expect(conAnulaciones(accion, undefined, 'p1')).toBe(accion)
  })
  it('con ids → varias con la propuesta primero y un descartar por id', () => {
    const accion = proponer()
    const out = conAnulaciones(accion, ['x', 'y'], 'p1')
    expect(out).toEqual({
      type: 'varias',
      acciones: [accion, descartar('x'), descartar('y')],
    })
  })
  it('filtra ids vacíos/falsy', () => {
    const accion = proponer()
    const out = conAnulaciones(accion, [null, 'x', ''], 'p1')
    expect(out.acciones).toEqual([accion, descartar('x')])
  })
})

describe('idsYaUsados', () => {
  it('recoge appointment_id y old_proposal_id de las OTRAS acciones', () => {
    const acciones = [confirmar('a'), descartar('b'), cancelar('c')]
    expect(idsYaUsados(acciones, 0).sort()).toEqual(['b', 'c'])
  })
  it('sin idxExcluir, cuenta todas', () => {
    const acciones = [confirmar('a'), descartar('b')]
    expect(idsYaUsados(acciones).sort()).toEqual(['a', 'b'])
  })
  it('ignora acciones autodescritas sin id de lookup (proponer_cita)', () => {
    const acciones = [proponer(), confirmar('a')]
    expect(idsYaUsados(acciones, 1)).toEqual([])
  })
  it('sin acciones → []', () => {
    expect(idsYaUsados([])).toEqual([])
  })
})
