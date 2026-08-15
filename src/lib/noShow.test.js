import { describe, it, expect } from 'vitest'
import { esAusencia, importeCita, buildNoShowMessage, rankingAusencias } from './noShow.js'

const cita = (over = {}) => ({ services: { price: 40 }, ...over })

describe('esAusencia', () => {
  it('solo es ausencia si tiene no_show_at', () => {
    expect(esAusencia(cita())).toBe(false)
    expect(esAusencia(cita({ no_show_at: '2026-08-14T10:00:00Z' }))).toBe(true)
    expect(esAusencia(null)).toBe(false)
  })
})

describe('importeCita', () => {
  it('cita normal factura el precio entero', () => {
    expect(importeCita(cita())).toBe(40)
  })

  it('ausencia cobrada al 50% factura la mitad', () => {
    expect(importeCita(cita({ no_show_at: 'x', no_show_charge_pct: 50 }))).toBe(20)
  })

  it('ausencia perdonada (0%) no factura nada', () => {
    expect(importeCita(cita({ no_show_at: 'x', no_show_charge_pct: 0 }))).toBe(0)
  })

  it('ausencia cobrada al 100% factura igual que si hubiera venido', () => {
    expect(importeCita(cita({ no_show_at: 'x', no_show_charge_pct: 100 }))).toBe(40)
  })

  it('marcada pero sin decidir el % → no se cobra', () => {
    expect(importeCita(cita({ no_show_at: 'x' }))).toBe(0)
  })

  it('redondea a céntimos, sin decimales infinitos', () => {
    expect(importeCita({ services: { price: 35 }, no_show_at: 'x', no_show_charge_pct: 33 })).toBe(11.55)
  })

  it('sin precio no explota', () => {
    expect(importeCita({})).toBe(0)
    expect(importeCita({ services: {} })).toBe(0)
    expect(importeCita({ no_show_at: 'x', no_show_charge_pct: 50 })).toBe(0)
  })
})

describe('buildNoShowMessage', () => {
  const plantilla = 'Buenos días, no pudiste venir a la cita del {dia} a las {hora} y no nos avisaste, así que se factura el {porcentaje}% de la sesión.'

  it('sustituye los marcadores', () => {
    expect(buildNoShowMessage(plantilla, { dia: 'jueves 14 de agosto', hora: '10:00', porcentaje: 50 }))
      .toBe('Buenos días, no pudiste venir a la cita del jueves 14 de agosto a las 10:00 y no nos avisaste, así que se factura el 50% de la sesión.')
  })

  it('admite importe y profesional', () => {
    expect(buildNoShowMessage('{profesional} · {importe}', { profesional: 'Marcos', importe: 20 }))
      .toBe('Marcos · 20€')
  })

  it('un marcador sin dato queda vacío, nunca "undefined"', () => {
    const out = buildNoShowMessage(plantilla, { dia: 'jueves', hora: '10:00' })
    expect(out).not.toMatch(/undefined|null|\{porcentaje\}/)
  })

  it('el 0% se sustituye como 0, no se trata como vacío', () => {
    expect(buildNoShowMessage('se factura el {porcentaje}%', { porcentaje: 0 })).toBe('se factura el 0%')
  })

  it('sin plantilla devuelve cadena vacía', () => {
    expect(buildNoShowMessage(null, { dia: 'x' })).toBe('')
    expect(buildNoShowMessage('', {})).toBe('')
  })

  it('respeta el texto que escriba la secretaria, aunque no tenga marcadores', () => {
    expect(buildNoShowMessage('Te espero la próxima.', {})).toBe('Te espero la próxima.')
  })
})

describe('rankingAusencias', () => {
  const base = { services: { price: 40 } }
  const p = (id, nombre) => ({ id, full_name: nombre, phone: '600000000' })

  const citas = [
    { ...base, patient_id: 'a', patients: p('a', 'Ana'), no_show_at: 'x', no_show_charge_pct: 50, starts_at: '2026-08-01T10:00:00' },
    { ...base, patient_id: 'a', patients: p('a', 'Ana'), no_show_at: 'x', no_show_charge_pct: 0, starts_at: '2026-08-10T10:00:00' },
    { ...base, patient_id: 'a', patients: p('a', 'Ana'), no_show_at: 'x', no_show_charge_pct: 50, starts_at: '2026-08-12T10:00:00' },
    { ...base, patient_id: 'b', patients: p('b', 'Berto'), no_show_at: 'x', no_show_charge_pct: 50, starts_at: '2026-08-13T10:00:00' },
    { ...base, patient_id: 'c', patients: p('c', 'Cris'), starts_at: '2026-08-14T10:00:00' }, // vino: no cuenta
  ]

  it('ordena de más a menos ausencias', () => {
    const r = rankingAusencias(citas)
    expect(r.map(x => x.nombre)).toEqual(['Ana', 'Berto'])
    expect(r[0].total).toBe(3)
    expect(r[1].total).toBe(1)
  })

  it('separa cobradas de perdonadas', () => {
    const ana = rankingAusencias(citas)[0]
    expect(ana.cobradas).toBe(2)
    expect(ana.perdonadas).toBe(1)
  })

  it('suma el importe realmente facturado por las ausencias', () => {
    const ana = rankingAusencias(citas)[0]
    expect(ana.importe).toBe(40)   // 20 + 0 + 20
  })

  it('guarda la fecha de la última ausencia', () => {
    expect(rankingAusencias(citas)[0].ultima).toBe('2026-08-12T10:00:00')
  })

  it('quien asistió no aparece', () => {
    expect(rankingAusencias(citas).find(x => x.nombre === 'Cris')).toBeUndefined()
  })

  it('sin datos devuelve lista vacía, sin lanzar', () => {
    expect(rankingAusencias([])).toEqual([])
    expect(rankingAusencias()).toEqual([])
  })
})
