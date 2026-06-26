// Formateador puro de proposed_action para la tarjeta de validación de la secretaria.
//
// Contexto: en modo training el bot NO ejecuta acciones; propone un descriptor
// (proposed_action) que Marta aprueba en el panel, y SU clic dispara la acción real.
// Antes de aprobar tiene que ver EXACTAMENTE qué cita toca. El problema es que
// proposed_action no tiene forma única (ver docs/CONTRATO-BOTCOACH-API.md y la
// tabla id-por-tipo): unos tipos se AUTODESCRIBEN (traen día/hora en el propio
// action) y otros solo traen un id → ahí el lookup a `appointments` ES la identidad.
//
// Regla de oro (acordada): la identidad de la cita NUNCA se inventa. Si un tipo
// que depende de lookup no resuelve, se marca `unresolved` y NO se cae a
// future_appt ni a patient_name. Degradar es solo cosmético (p. ej. falta el
// nombre del profesional → se muestra el resto).
//
// Este módulo es PURO y no toca red: recibe el `appt` ya resuelto (o null) y
// devuelve el descriptor de UI. El lookup async lo hace el componente.

const DOW = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb']
const MON = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

// 'YYYY-MM-DD' → 'sáb 27 jun'. Parseo manual para no depender de la zona horaria.
function formatDay(isoDate) {
  if (!isoDate || isoDate.length < 10) return null
  const y = +isoDate.slice(0, 4)
  const m = +isoDate.slice(5, 7)
  const d = +isoDate.slice(8, 10)
  if (!y || !m || !d) return null
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay()
  return `${DOW[dow]} ${d} ${MON[m - 1]}`
}

// 'YYYY-MM-DDTHH:MM[:SS]' → { day:'sáb 27 jun', time:'10:30' }
function splitSlot(iso) {
  if (!iso || iso.length < 16) return { day: null, time: null }
  return { day: formatDay(iso.slice(0, 10)), time: iso.slice(11, 16) }
}

// Metadatos por tipo: etiqueta, icono, familia y si es destructiva.
// family: 'destructive' | 'confirm' | 'neutral' | 'list'
const META = {
  cancelar_cita:               { label: 'Cancelar cita',            icon: '🗑', family: 'destructive' },
  descartar_propuesta:         { label: 'Descartar propuesta',      icon: '🗑', family: 'destructive' },
  rechazar_propuesta:          { label: 'Rechazar y reofertar',     icon: '🔁', family: 'destructive' },
  confirmar_propuesta:         { label: 'Confirmar cita',           icon: '✅', family: 'confirm' },
  confirmar_followup_oferta:   { label: 'Confirmar oferta',         icon: '✅', family: 'confirm' },
  aceptar_oferta_cancelacion:  { label: 'Aceptar hueco liberado',   icon: '✅', family: 'confirm' },
  rechazar_oferta_cancelacion: { label: 'Declinar oferta',          icon: '↩️', family: 'neutral' },
  proponer_cita:               { label: 'Proponer cita',            icon: '📅', family: 'confirm' },
  reservar_clase:              { label: 'Reservar clase',           icon: '📅', family: 'confirm' },
  apuntar_lista_espera:        { label: 'Apuntar a lista de espera', icon: '📝', family: 'list' },
  apuntar_lista_adelantar:     { label: 'Apuntar para adelantar',   icon: '📝', family: 'list' },
}

const DESTRUCTIVE = new Set(['cancelar_cita', 'descartar_propuesta', 'rechazar_propuesta'])

// Tipos cuya identidad de cita se resuelve leyendo `appointments` por un id.
// El valor es el campo del action que lleva ese id.
const LOOKUP_ID_FIELD = {
  cancelar_cita:               'appointment_id',
  confirmar_propuesta:         'appointment_id',
  confirmar_followup_oferta:   'appointment_id',
  aceptar_oferta_cancelacion:  'appointment_id',
  rechazar_oferta_cancelacion: 'appointment_id',
  descartar_propuesta:         'old_proposal_id',
  rechazar_propuesta:          'old_proposal_id',
}

export function isDestructiveAction(action) {
  return !!action && DESTRUCTIVE.has(action.type)
}

// Devuelve el id de `appointments` a resolver para este action, o null si el
// tipo es autodescrito (trae el slot) o no representa una cita.
export function actionLookupId(action) {
  if (!action) return null
  const field = LOOKUP_ID_FIELD[action.type]
  if (!field) return null
  return action[field] || null
}

// ¿La identidad de la cita viaja en el propio action? (no depende del lookup)
function selfDescribedSlot(action) {
  switch (action.type) {
    case 'cancelar_cita':
      // FSM trae date+time; Haiku no → entonces NO es autodescrito.
      if (action.date && action.time) return { day: formatDay(action.date), time: action.time }
      return null
    case 'rechazar_propuesta':
      return action.rejected?.slot16 ? splitSlot(action.rejected.slot16) : null
    case 'proponer_cita':
    case 'reservar_clase':
      return action.starts_at ? splitSlot(action.starts_at) : null
    default:
      return null
  }
}

function composeLine({ unresolved, patient, day, time, prof, service, extra }) {
  if (unresolved) return '⚠️ No se pudo resolver la cita'
  const parts = [patient, day, time, prof || service].filter(Boolean)
  if (extra) parts.push(extra)
  return parts.join(' · ')
}

// action: el proposed_action crudo.
// opts.patientName: nombre del paciente de la conversación (join, no del slot).
// opts.appt: fila de appointments ya resuelta por actionLookupId, o null.
export function describeProposedAction(action, { patientName = null, appt = null } = {}) {
  if (!action || !action.type) {
    return { type: null, label: 'Acción', icon: '⚙️', family: 'neutral', destructive: false,
      patient: patientName, day: null, time: null, prof: null, service: null,
      line: composeLine({ unresolved: false, patient: patientName }), unresolved: false, note: null }
  }

  const meta = META[action.type] || { label: action.type, icon: '⚙️', family: 'neutral' }
  const destructive = DESTRUCTIVE.has(action.type)
  const patient = action.patient_name || patientName || null

  let day = null, time = null, prof = null, service = null
  let unresolved = false, note = null, extra = null

  const self = selfDescribedSlot(action)
  const needsLookup = !!LOOKUP_ID_FIELD[action.type]

  if (self) {
    // AUTODESCRITO: el slot viene del action. El lookup, si lo hay, es solo
    // verificación de consistencia — nunca pisa el slot del action.
    day = self.day
    time = self.time
    prof = action.prof || appt?.professionals?.name || null
    if (needsLookup && !appt) note = 'La cita ya no figura en la agenda'
    // rechazar_propuesta: añadir la nueva oferta (cosmético) si viene en next.
    if (action.type === 'rechazar_propuesta' && action.next?.starts_at) {
      const n = splitSlot(action.next.starts_at)
      if (n.day) extra = `nueva oferta: ${n.day} ${n.time}`
    }
  } else if (needsLookup) {
    // IDENTIDAD POR LOOKUP: el día/hora SOLO pueden salir del appt resuelto.
    if (appt && appt.starts_at) {
      const s = splitSlot(appt.starts_at)
      day = s.day
      time = s.time
      prof = appt.professionals?.name || null
      service = appt.services?.name || null
    } else {
      // No resuelto: NO se rellena con nada que parezca el slot.
      unresolved = true
    }
  } else {
    // Tipos sin cita (listas) u otros autodescritos cosméticos.
    switch (action.type) {
      case 'apuntar_lista_espera':
        service = action.servicio || null
        break
      case 'apuntar_lista_adelantar':
        prof = action.prof || null
        if (action.target_date) { day = formatDay(action.target_date); time = action.preferred_hour || null }
        break
      default:
        break
    }
  }

  const line = composeLine({ unresolved, patient, day, time, prof, service, extra })

  return {
    type: action.type,
    label: meta.label,
    icon: meta.icon,
    family: meta.family,
    destructive,
    patient,
    day,
    time,
    prof,
    service,
    line,
    unresolved,
    note,
  }
}
