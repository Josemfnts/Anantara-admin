import { describe, it, expect } from 'vitest'
import { actionLookupId, describeProposedAction, isDestructiveAction } from './proposedAction.js'

// Filas de appointments tal como las devuelve el lookup
//   appointments.select('id, starts_at, status, professionals(name), services(name, duration_minutes)')
const apptRow = (over = {}) => ({
  id: 'appt-1',
  starts_at: '2026-06-27T10:30:00',
  status: 'confirmed',
  professionals: { name: 'Marta C.' },
  services: { name: 'Fisioterapia', duration_minutes: 60 },
  ...over,
})

describe('actionLookupId — qué id se pide a appointments por tipo', () => {
  it('cancelar_cita → appointment_id', () => {
    expect(actionLookupId({ type: 'cancelar_cita', appointment_id: 'A' })).toBe('A')
  })
  it('confirmar_propuesta → appointment_id', () => {
    expect(actionLookupId({ type: 'confirmar_propuesta', appointment_id: 'B' })).toBe('B')
  })
  it('confirmar_followup_oferta → appointment_id', () => {
    expect(actionLookupId({ type: 'confirmar_followup_oferta', appointment_id: 'C' })).toBe('C')
  })
  it('aceptar_oferta_cancelacion → appointment_id', () => {
    expect(actionLookupId({ type: 'aceptar_oferta_cancelacion', appointment_id: 'D' })).toBe('D')
  })
  it('rechazar_oferta_cancelacion → appointment_id', () => {
    expect(actionLookupId({ type: 'rechazar_oferta_cancelacion', appointment_id: 'E' })).toBe('E')
  })
  it('descartar_propuesta → old_proposal_id', () => {
    expect(actionLookupId({ type: 'descartar_propuesta', old_proposal_id: 'F' })).toBe('F')
  })
  it('rechazar_propuesta → old_proposal_id (verificación de consistencia)', () => {
    expect(actionLookupId({ type: 'rechazar_propuesta', old_proposal_id: 'G' })).toBe('G')
  })
  it('proponer_cita → null (la cita aún no existe)', () => {
    expect(actionLookupId({ type: 'proponer_cita', starts_at: '2026-06-27T10:30:00' })).toBeNull()
  })
  it('reservar_clase → null (autodescrito por starts_at)', () => {
    expect(actionLookupId({ type: 'reservar_clase', starts_at: '2026-06-27T10:30:00' })).toBeNull()
  })
  it('apuntar_lista_espera → null (no es una cita)', () => {
    expect(actionLookupId({ type: 'apuntar_lista_espera', servicio: 'Masaje' })).toBeNull()
  })
  it('apuntar_lista_adelantar → null (no es una cita)', () => {
    expect(actionLookupId({ type: 'apuntar_lista_adelantar', prof: 'Marta' })).toBeNull()
  })
  it('tipo desconocido o action nula → null', () => {
    expect(actionLookupId({ type: 'lo_que_sea' })).toBeNull()
    expect(actionLookupId(null)).toBeNull()
  })
})

describe('isDestructiveAction', () => {
  it('cancelar_cita, descartar_propuesta y rechazar_propuesta son destructivas', () => {
    expect(isDestructiveAction({ type: 'cancelar_cita' })).toBe(true)
    expect(isDestructiveAction({ type: 'descartar_propuesta' })).toBe(true)
    expect(isDestructiveAction({ type: 'rechazar_propuesta' })).toBe(true)
  })
  it('rechazar_oferta_cancelacion NO es destructiva (declinar una oferta no destruye nada)', () => {
    expect(isDestructiveAction({ type: 'rechazar_oferta_cancelacion' })).toBe(false)
  })
  it('confirmar/aceptar/proponer/reservar/apuntar NO son destructivas', () => {
    for (const t of ['confirmar_propuesta', 'confirmar_followup_oferta', 'aceptar_oferta_cancelacion',
      'proponer_cita', 'reservar_clase', 'apuntar_lista_espera', 'apuntar_lista_adelantar']) {
      expect(isDestructiveAction({ type: t })).toBe(false)
    }
  })
  it('action nula → false', () => {
    expect(isDestructiveAction(null)).toBe(false)
  })
})

describe('describeProposedAction — AUTODESCRITOS (día/hora viajan en el action)', () => {
  it('cancelar_cita FSM usa date/time/prof del propio action, no del lookup', () => {
    const action = { type: 'cancelar_cita', appointment_id: 'X', date: '2026-06-27', time: '10:30', patient_name: 'Lucía Pérez', prof: 'Marta C.' }
    const d = describeProposedAction(action, { patientName: 'Lucía Pérez', appt: null })
    expect(d.unresolved).toBe(false)
    expect(d.day).toBe('sáb 27 jun')
    expect(d.time).toBe('10:30')
    expect(d.prof).toBe('Marta C.')
    expect(d.patient).toBe('Lucía Pérez')
    expect(d.destructive).toBe(true)
    // appt=null en un autodescrito → nota de consistencia, NO unresolved
    expect(d.note).toMatch(/agenda/i)
  })

  it('rechazar_propuesta usa rejected.slot16 (literal) → identidad NO depende del lookup', () => {
    const action = {
      type: 'rechazar_propuesta',
      old_proposal_id: 'G',
      rejected: { slot16: '2026-06-27T10:30', professional_id: 'p1' },
      next: { type: 'proponer_cita', starts_at: '2026-06-30T12:00:00' },
    }
    const d = describeProposedAction(action, { patientName: 'Lucía', appt: null })
    expect(d.unresolved).toBe(false)
    expect(d.day).toBe('sáb 27 jun')
    expect(d.time).toBe('10:30')
    expect(d.destructive).toBe(true)
  })

  it('proponer_cita usa starts_at; identidad = el propio hueco', () => {
    const action = { type: 'proponer_cita', starts_at: '2026-06-30T12:00:00', professional_id: 'p1' }
    const d = describeProposedAction(action, { patientName: 'Lucía', appt: null })
    expect(d.unresolved).toBe(false)
    expect(d.day).toBe('mar 30 jun')
    expect(d.time).toBe('12:00')
    expect(d.destructive).toBe(false)
  })

  it('apuntar_lista_espera describe el servicio, sin pretender mostrar una cita', () => {
    const d = describeProposedAction({ type: 'apuntar_lista_espera', servicio: 'Masaje' }, { patientName: 'Lucía' })
    expect(d.unresolved).toBe(false)
    expect(d.day).toBeNull()
    expect(d.time).toBeNull()
    expect(d.service).toBe('Masaje')
    expect(d.family).toBe('list')
  })
})

describe('describeProposedAction — IDENTIDAD POR LOOKUP', () => {
  it('confirmar_propuesta con appt resuelto → día/hora/prof del lookup', () => {
    const d = describeProposedAction({ type: 'confirmar_propuesta', appointment_id: 'appt-1' }, { patientName: 'Lucía', appt: apptRow() })
    expect(d.unresolved).toBe(false)
    expect(d.day).toBe('sáb 27 jun')
    expect(d.time).toBe('10:30')
    expect(d.prof).toBe('Marta C.')
    expect(d.destructive).toBe(false)
  })

  it('cancelar_cita (Haiku, sin date) con appt resuelto → día/hora del lookup', () => {
    const d = describeProposedAction({ type: 'cancelar_cita', appointment_id: 'appt-1', patient_id: 'pt1' }, { patientName: 'Lucía', appt: apptRow() })
    expect(d.unresolved).toBe(false)
    expect(d.day).toBe('sáb 27 jun')
    expect(d.time).toBe('10:30')
    expect(d.destructive).toBe(true)
  })
})

describe('describeProposedAction — NO RESUELTO NO RELLENA (la regla crítica)', () => {
  it('cancelar_cita (Haiku) sin appt → unresolved, sin día/hora, sin caer a patient_name como cita', () => {
    const d = describeProposedAction({ type: 'cancelar_cita', appointment_id: 'appt-borrado', patient_id: 'pt1' }, { patientName: 'Lucía Pérez', appt: null })
    expect(d.unresolved).toBe(true)
    expect(d.day).toBeNull()
    expect(d.time).toBeNull()
    expect(d.prof).toBeNull()
    expect(d.destructive).toBe(true)
    // El one-liner NO debe presentar un slot falso; debe avisar de la duda.
    expect(d.line).toMatch(/no se pudo resolver/i)
  })

  it('descartar_propuesta sin appt → unresolved, sin día/hora inventados', () => {
    const d = describeProposedAction({ type: 'descartar_propuesta', old_proposal_id: 'gone', patient_id: 'pt1' }, { patientName: 'Lucía', appt: null })
    expect(d.unresolved).toBe(true)
    expect(d.day).toBeNull()
    expect(d.time).toBeNull()
  })

  it('NUNCA usa future_appt: el descriptor solo recibe el appt resuelto por el id del action', () => {
    // Si el lookup del id del action devuelve null, no hay forma de colar otra cita.
    const d = describeProposedAction({ type: 'confirmar_propuesta', appointment_id: 'x' }, { patientName: 'Lucía', appt: null })
    expect(d.unresolved).toBe(true)
    expect(d.day).toBeNull()
  })
})
