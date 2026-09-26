import { describe, it, expect } from 'vitest'
import {
  isValidCustomDuration, addMinutes, buildPersonalizadaDescriptor, esPersonalizada,
  CUSTOM_DURATION_MIN, CUSTOM_DURATION_MAX,
} from './citaPersonalizada.js'

describe('isValidCustomDuration', () => {
  it('acepta enteros dentro de 10–240', () => {
    expect(isValidCustomDuration(10)).toBe(true)
    expect(isValidCustomDuration(240)).toBe(true)
    expect(isValidCustomDuration(45)).toBe(true)
    expect(isValidCustomDuration(CUSTOM_DURATION_MIN)).toBe(true)
    expect(isValidCustomDuration(CUSTOM_DURATION_MAX)).toBe(true)
  })
  it('rechaza fuera de rango', () => {
    expect(isValidCustomDuration(9)).toBe(false)
    expect(isValidCustomDuration(241)).toBe(false)
    expect(isValidCustomDuration(0)).toBe(false)
    expect(isValidCustomDuration(-10)).toBe(false)
  })
  it('rechaza no enteros, vacío o basura', () => {
    expect(isValidCustomDuration(45.5)).toBe(false)
    expect(isValidCustomDuration('')).toBe(false)
    expect(isValidCustomDuration(null)).toBe(false)
    expect(isValidCustomDuration(undefined)).toBe(false)
    expect(isValidCustomDuration('abc')).toBe(false)
  })
  it('un string numérico entero sí vale (viene de un <input>)', () => {
    expect(isValidCustomDuration('45')).toBe(true)
  })
})

describe('addMinutes', () => {
  it('suma minutos dentro de la misma hora', () => {
    expect(addMinutes('2026-06-30T12:00:00', 45)).toBe('2026-06-30T12:45:00')
  })
  it('cruza la hora', () => {
    expect(addMinutes('2026-06-30T12:40', 30)).toBe('2026-06-30T13:10:00')
  })
  it('cruza medianoche (no cambia el string de fecha — mismo comportamiento que antes)', () => {
    expect(addMinutes('2026-06-30T23:50', 20)).toBe('2026-06-30T00:10:00')
  })
  it('sin T o sin iso, devuelve tal cual', () => {
    expect(addMinutes(null, 30)).toBeNull()
    expect(addMinutes('no-es-iso', 30)).toBe('no-es-iso')
  })
})

describe('buildPersonalizadaDescriptor', () => {
  const base = { patientId: 'pt1', professionalId: 'p1', startsAt: '2026-06-30T12:00:00', durationMinutes: 45, paraQuien: 'Agustín' }

  it('genera el descriptor exacto acordado', () => {
    const d = buildPersonalizadaDescriptor(base)
    expect(d).toEqual({
      type: 'proponer_cita',
      patient_id: 'pt1',
      professional_id: 'p1',
      service_id: null,
      starts_at: '2026-06-30T12:00:00',
      ends_at: '2026-06-30T12:45:00',
      duration_minutes: 45,
      para_quien: 'Agustín',
      personalizada: true,
    })
  })

  it('para_quien vacío o solo espacios → null (no cadena vacía)', () => {
    expect(buildPersonalizadaDescriptor({ ...base, paraQuien: '' }).para_quien).toBeNull()
    expect(buildPersonalizadaDescriptor({ ...base, paraQuien: '   ' }).para_quien).toBeNull()
    expect(buildPersonalizadaDescriptor({ ...base, paraQuien: undefined }).para_quien).toBeNull()
  })

  it('recorta espacios de para_quien', () => {
    expect(buildPersonalizadaDescriptor({ ...base, paraQuien: '  Agustín  ' }).para_quien).toBe('Agustín')
  })

  it('duración inválida → null, no se puede aprobar', () => {
    expect(buildPersonalizadaDescriptor({ ...base, durationMinutes: 5 })).toBeNull()
    expect(buildPersonalizadaDescriptor({ ...base, durationMinutes: 300 })).toBeNull()
    expect(buildPersonalizadaDescriptor({ ...base, durationMinutes: 'x' })).toBeNull()
    expect(buildPersonalizadaDescriptor({ ...base, durationMinutes: null })).toBeNull()
  })

  it('faltan datos obligatorios → null', () => {
    expect(buildPersonalizadaDescriptor({ ...base, patientId: null })).toBeNull()
    expect(buildPersonalizadaDescriptor({ ...base, professionalId: null })).toBeNull()
    expect(buildPersonalizadaDescriptor({ ...base, startsAt: null })).toBeNull()
    expect(buildPersonalizadaDescriptor()).toBeNull()
  })
})

describe('esPersonalizada', () => {
  it('true con el flag explícito', () => {
    expect(esPersonalizada({ type: 'proponer_cita', personalizada: true })).toBe(true)
  })
  it('false sin el flag aunque no traiga service_id (propuesta normal del bot sin servicio)', () => {
    expect(esPersonalizada({ type: 'proponer_cita', service_id: null, duration_minutes: 60 })).toBe(false)
  })
  it('false en una proponer_cita normal (con servicio)', () => {
    expect(esPersonalizada({ type: 'proponer_cita', service_id: 'svc1', duration_minutes: 60 })).toBe(false)
  })
  it('false si no hay duration_minutes aunque falte el servicio (dato insuficiente)', () => {
    expect(esPersonalizada({ type: 'proponer_cita', service_id: null })).toBe(false)
  })
  it('false para otros tipos u objetos vacíos', () => {
    expect(esPersonalizada({ type: 'cancelar_cita', personalizada: true })).toBe(false)
    expect(esPersonalizada(null)).toBe(false)
    expect(esPersonalizada(undefined)).toBe(false)
  })
})
