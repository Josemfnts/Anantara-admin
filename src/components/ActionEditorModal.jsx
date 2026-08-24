// ActionEditorModal — Marta corrige la acción propuesta por el bot desde el panel
// del Bot Coach. Cambia el tipo, rellena campos según el tipo (calendario, cita
// a modificar, servicio…) y ve el texto autogenerado antes de aprobar.
//
// Objetivo: cuando el bot se equivoca (típico "cambio de fecha" que el bot lee
// como "cancelar"), Marta corrige EN el chat del panel en vez de salir a WhatsApp
// manual. Además el par (proposed_action, final_action) queda como training data.
//
// Props:
//   - patient: { id, full_name, phone }
//   - currentAction: proposed_action del bot (para pre-rellenar el tipo)
//   - currentText: draft actual (para partir de él)
//   - services: [{id, name, section, duration_minutes}] (ya cargados en el panel)
//   - professionals: [{id, name}]
//   - onCancel(): cierra sin guardar
//   - onConfirm(newAction, newText): cierra guardando; el consumidor actualiza
//     su estado local (draft + action override) y aprueba con /send-validated.
//   - botFetch: fetch al bot ya autenticado (para /proposal-slot-options)

import React, { useEffect, useMemo, useState } from 'react'
import { ProposalCalendar } from './ProposalCalendar.jsx'
import { generateActionText } from '../lib/generateActionText.js'

// Opciones del selector de tipo. Orden pensado para las correcciones más comunes.
const ACTION_OPTIONS = [
  { value: 'reprogramar',              label: '🔀 Reprogramar (cancelar + proponer nueva)' },
  { value: 'proponer_cita',            label: '📅 Proponer cita nueva' },
  { value: 'cancelar_cita',            label: '🗑 Cancelar cita' },
  { value: 'confirmar_propuesta',      label: '✅ Confirmar propuesta' },
  { value: 'descartar_propuesta',      label: '🗑 Descartar propuesta (sin proponer otra)' },
  { value: 'apuntar_lista_espera',     label: '📝 Apuntar a lista de espera' },
  { value: 'apuntar_lista_adelantar',  label: '📝 Apuntar para adelantar' },
  { value: 'confirmar_followup_oferta',label: '✅ Confirmar oferta de follow-up' },
  { value: 'aceptar_oferta_cancelacion',label:'✅ Aceptar hueco liberado' },
  { value: 'rechazar_oferta_cancelacion',label:'↩️ Declinar oferta de hueco' },
  { value: 'rechazar_propuesta',       label: '🔁 Rechazar y reofertar' },
  { value: 'reservar_clase',           label: '📅 Reservar clase' },
]

// Tipos que necesitan seleccionar una cita EXISTENTE del paciente.
const NEEDS_APPT_SELECT = new Set([
  'cancelar_cita', 'confirmar_propuesta', 'confirmar_followup_oferta',
  'aceptar_oferta_cancelacion', 'rechazar_oferta_cancelacion', 'oferta_proactiva',
])

// Tipos que necesitan elegir profesional + slot en el calendario.
const NEEDS_SLOT = new Set(['proponer_cita', 'reprogramar'])

// Tipos que necesitan un servicio (belleza/lista espera).
const NEEDS_SERVICE = new Set(['apuntar_lista_espera', 'apuntar_lista_adelantar'])

const DIAS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb']
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

function fmtAppt(a) {
  if (!a?.starts_at) return `#${(a?.id || '').slice(0, 6)}`
  const iso = a.starts_at.slice(0, 10)
  const y = +iso.slice(0, 4), m = +iso.slice(5, 7), d = +iso.slice(8, 10)
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay()
  const hora = a.starts_at.slice(11, 16)
  const prof = a.professionals?.name || '?'
  const status = a.status ? ` · ${a.status}` : ''
  return `${DIAS[dow]} ${d} ${MESES[m - 1]} ${hora} · ${prof}${status}`
}

export function ActionEditorModal({
  patient,
  currentAction,
  currentText,
  services = [],
  professionals = [],
  onCancel,
  onConfirm,
  botFetch,
  sb,                      // cliente Supabase inyectado desde el padre
}) {
  const [type, setType] = useState(currentAction?.type || 'proponer_cita')
  const [selectedApptId, setSelectedApptId] = useState(null)
  const [profId, setProfId] = useState(currentAction?.professional_id || '')
  const [svcId, setSvcId] = useState(currentAction?.service_id || '')
  const [slotIso, setSlotIso] = useState(currentAction?.starts_at || null)
  const [text, setText] = useState(currentText || '')
  const [userEditedText, setUserEditedText] = useState(false)

  // Calendario del slot nuevo (mismo patrón que el cuadro de oferta).
  const [calMonth, setCalMonth] = useState(new Date())
  const [calDays, setCalDays] = useState({})
  const [calLoading, setCalLoading] = useState(false)
  const [selDay, setSelDay] = useState(null)

  // ─── Citas del paciente (para los selectores de cita) ────────────────────
  const [patAppts, setPatAppts] = useState([])
  useEffect(() => {
    if (!patient?.id) return
    let alive = true
    ;(async () => {
      const { data } = await sb.from('appointments')
        .select('id, starts_at, status, professionals(name)')
        .eq('patient_id', patient.id)
        .in('status', ['pending', 'confirmed'])
        .gte('starts_at', new Date().toISOString())
        .order('starts_at')
      if (alive) setPatAppts(data || [])
    })()
    return () => { alive = false }
  }, [patient?.id])

  // ─── Servicio y profesional derivados / seleccionados ────────────────────
  const profObj = useMemo(() => professionals.find(p => p.id === profId), [profId, professionals])
  const svcObj = useMemo(() => services.find(s => s.id === svcId), [svcId, services])

  // ─── Cargar el calendario del slot cuando corresponda ────────────────────
  const loadCal = async (date) => {
    if (!profId || !svcObj) { setCalDays({}); return }
    setCalLoading(true)
    try {
      const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      const r = await botFetch('/proposal-slot-options', {
        method: 'POST',
        body: JSON.stringify({
          action_type: 'proponer_cita', professional_id: profId, month,
          duration_minutes: svcObj?.duration_minutes || 60, patient_id: patient.id,
        }),
      })
      const data = await r.json().catch(() => ({}))
      if (data.ok) setCalDays(data.days || {})
    } catch { /* silencio */ }
    finally { setCalLoading(false) }
  }
  useEffect(() => {
    if (NEEDS_SLOT.has(type) && profId && svcObj) loadCal(calMonth)
    // eslint-disable-next-line
  }, [type, profId, svcId, calMonth?.getTime()])

  // ─── Descriptor y texto auto ─────────────────────────────────────────────
  // Construye el descriptor a partir del estado del modal (puro, testeable a ojo).
  const buildDescriptor = () => {
    if (!type) return null
    switch (type) {
      case 'cancelar_cita':
      case 'confirmar_propuesta':
      case 'confirmar_followup_oferta':
      case 'aceptar_oferta_cancelacion':
      case 'rechazar_oferta_cancelacion':
      case 'oferta_proactiva':
        return selectedApptId ? { type, appointment_id: selectedApptId, patient_id: patient.id } : null
      case 'descartar_propuesta':
        return { type }
      case 'apuntar_lista_espera':
      case 'apuntar_lista_adelantar':
        return svcObj ? { type, service_name: svcObj.name, patient_id: patient.id } : null
      case 'rechazar_propuesta':
        return { type }   // texto libre; el bot no lo commit ejecuta desde el panel
      case 'reservar_clase':
        // Requiere slot_id, que no elegimos aquí — texto libre.
        return { type }
      case 'proponer_cita':
        if (!profId || !svcObj || !slotIso) return null
        return {
          type,
          patient_id: patient.id,
          professional_id: profId,
          service_id: svcObj.id,
          starts_at: slotIso,
          ends_at: addMinutes(slotIso, svcObj.duration_minutes || 60),
          duration_minutes: svcObj.duration_minutes || 60,
        }
      case 'reprogramar':
        if (!selectedApptId || !profId || !svcObj || !slotIso) return null
        return {
          type,
          cancel: { appointment_id: selectedApptId, patient_id: patient.id },
          propose: {
            patient_id: patient.id,
            professional_id: profId,
            service_id: svcObj.id,
            starts_at: slotIso,
            ends_at: addMinutes(slotIso, svcObj.duration_minutes || 60),
            duration_minutes: svcObj.duration_minutes || 60,
          },
        }
      default:
        return null
    }
  }

  // Cada vez que cambian los datos, regenerar el texto (SI Marta no lo tocó).
  useEffect(() => {
    if (userEditedText) return
    const desc = buildDescriptor()
    if (!desc) { setText(''); return }
    const auto = generateActionText(desc, {
      patientName: patient?.full_name,
      profName: profObj?.name,
      serviceName: svcObj?.name,
      appt: patAppts.find(a => a.id === selectedApptId),
    })
    setText(auto)
    // eslint-disable-next-line
  }, [type, selectedApptId, profId, svcId, slotIso])

  const descriptor = buildDescriptor()
  const canSave = !!descriptor && (text || '').trim().length > 0

  const handleSave = () => {
    if (!canSave) return
    onConfirm(descriptor, text.trim())
  }

  // ─── Render ──────────────────────────────────────────────────────────────
  const showApptSelect = NEEDS_APPT_SELECT.has(type) || type === 'reprogramar'
  const showSlotPicker = NEEDS_SLOT.has(type)
  const showServiceOnly = NEEDS_SERVICE.has(type)

  return (
    // Layout en TRES bandas: título fijo arriba, cuerpo con scroll propio y
    // botones fijos abajo. Antes todo iba en un bloque y se confiaba en el
    // `overflow-y:auto` de la clase .modal; con el calendario abierto el
    // contenido crecía tanto que en el portátil los botones quedaban fuera de
    // pantalla (hubo que poner el zoom al 80% para llegar) y en el móvil no se
    // podía bajar. Reportado el 24-ago.
    //
    // `100dvh` (dynamic viewport height) en vez de `vh`: en el móvil, `vh` cuenta
    // la barra de direcciones aunque esté visible, así que el 90vh real se salía
    // de la pantalla. dvh mide lo que de verdad se ve. `overflow: hidden` en el
    // contenedor es lo que obliga al cuerpo a hacer su propio scroll.
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onCancel()}>
      <div className="modal" style={{
        maxWidth: 620,
        maxHeight: 'min(90dvh, 900px)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        padding: 0,
      }}>
        <div className="modal-title" style={{ flexShrink: 0, margin: 0, padding: '20px 24px 14px' }}>✏️ Cambiar acción</div>

        <div style={{
          display: 'flex', flexDirection: 'column', gap: 12,
          flex: 1, minHeight: 0, overflowY: 'auto', WebkitOverflowScrolling: 'touch',
          padding: '4px 24px 16px',
        }}>
          {/* Selector de tipo */}
          <label style={{ display: 'block' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.3 }}>Tipo de acción</div>
            <select value={type} onChange={e => { setType(e.target.value); setUserEditedText(false) }}
              className="field-input" style={{ width: '100%' }}>
              {ACTION_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </label>

          {/* Selector de cita — para tipos que la necesitan */}
          {showApptSelect && (
            <label>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.3 }}>
                {type === 'reprogramar' ? 'Cita a mover' : 'Cita a la que aplicar'}
              </div>
              {patAppts.length === 0 ? (
                <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '6px 10px', border: '1px dashed var(--border)', borderRadius: 6 }}>
                  Este paciente no tiene citas pending/confirmed futuras.
                </div>
              ) : (
                <select value={selectedApptId || ''} onChange={e => { setSelectedApptId(e.target.value || null); setUserEditedText(false) }}
                  className="field-input" style={{ width: '100%' }}>
                  <option value="">— elige una cita —</option>
                  {patAppts.map(a => <option key={a.id} value={a.id}>{fmtAppt(a)}</option>)}
                </select>
              )}
            </label>
          )}

          {/* Selector de servicio (lista espera) */}
          {showServiceOnly && (
            <label>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.3 }}>Servicio</div>
              <select value={svcId} onChange={e => { setSvcId(e.target.value); setUserEditedText(false) }}
                className="field-input" style={{ width: '100%' }}>
                <option value="">— elige servicio —</option>
                {services.map(s => <option key={s.id} value={s.id}>{s.name}{s.section ? ` (${s.section})` : ''}</option>)}
              </select>
            </label>
          )}

          {/* Selectores de prof + servicio + calendario del slot nuevo */}
          {showSlotPicker && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <label>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.3 }}>Profesional</div>
                  <select value={profId} onChange={e => { setProfId(e.target.value); setSlotIso(null); setUserEditedText(false) }}
                    className="field-input" style={{ width: '100%' }}>
                    <option value="">— elige —</option>
                    {professionals.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </label>
                <label>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.3 }}>Servicio</div>
                  <select value={svcId} onChange={e => { setSvcId(e.target.value); setSlotIso(null); setUserEditedText(false) }}
                    className="field-input" style={{ width: '100%' }}>
                    <option value="">— elige —</option>
                    {services.map(s => <option key={s.id} value={s.id}>{s.name} ({s.duration_minutes}m)</option>)}
                  </select>
                </label>
              </div>
              {profId && svcObj ? (
                <div style={{ padding: 10, border: '1px solid var(--border)', borderRadius: 8, background: '#fafaf7' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.3 }}>Elige día y hora</div>
                  <ProposalCalendar
                    month={calMonth} days={calDays} loading={calLoading}
                    onPrev={() => setCalMonth(new Date(calMonth.getFullYear(), calMonth.getMonth() - 1, 1))}
                    onNext={() => setCalMonth(new Date(calMonth.getFullYear(), calMonth.getMonth() + 1, 1))}
                    onSelectDay={setSelDay}
                    onSelectHour={(dayKey, hour) => { setSlotIso(`${dayKey}T${hour}:00`); setUserEditedText(false) }}
                    selectedDay={selDay}
                  />
                  {slotIso && (
                    <div style={{ marginTop: 8, fontSize: 12, color: 'var(--body)' }}>
                      Slot elegido: <strong>{slotIso.slice(0, 10)} {slotIso.slice(11, 16)}</strong>
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: 8 }}>
                  Elige profesional y servicio para ver el calendario.
                </div>
              )}
            </>
          )}

          {/* Textarea del mensaje al paciente */}
          <label>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.3 }}>
              Mensaje al paciente {userEditedText ? '(editado por ti)' : '(autogenerado)'}
            </div>
            <textarea value={text} onChange={e => { setText(e.target.value); setUserEditedText(true) }}
              rows={3} className="field-input" style={{ width: '100%', resize: 'vertical', fontSize: 13 }} />
          </label>

          {/* Aviso si el descriptor está incompleto */}
          {/* Decir QUÉ falta, no "rellena los campos". Un botón gris sin explicación
              es un callejón sin salida: se pulsa, no pasa nada y no se sabe por qué.
              Incluye el texto vacío, que también bloquea el guardado y antes no se
              avisaba en ningún sitio. */}
          {!canSave && (() => {
            const falta = []
            if (!descriptor) {
              if (['proponer_cita', 'reprogramar'].includes(type)) {
                if (!profId) falta.push('profesional')
                if (!svcId) falta.push('servicio')
                if (!slotIso) falta.push('día y hora')
              }
              if (['reprogramar', 'cancelar_cita', 'confirmar_propuesta', 'descartar_propuesta'].includes(type) && !selectedApptId) {
                falta.push('la cita sobre la que actuar')
              }
              if (type === 'apuntar_lista_espera' || type === 'apuntar_lista_adelantar') {
                if (!svcId) falta.push('servicio')
              }
              if (!falta.length) falta.push('algún dato de la acción')
            }
            if (!(text || '').trim()) falta.push('el mensaje para el paciente')
            return (
              <div style={{ fontSize: 12.5, color: '#b45309', background: '#fef3c7', border: '1px solid #fcd34d', padding: '8px 12px', borderRadius: 6 }}>
                Para guardar falta: <strong>{falta.join(', ')}</strong>.
              </div>
            )
          })()}

        </div>

        {/* Botones FUERA del cuerpo con scroll: se ven siempre, por largo que sea
            el formulario. Antes iban al final del contenido y con el calendario
            desplegado quedaban fuera de la pantalla. minHeight 44 = tamaño de
            toque cómodo en móvil. */}
        <div style={{
          flexShrink: 0, display: 'flex', gap: 8, justifyContent: 'flex-end',
          padding: '12px 24px', borderTop: '1px solid var(--border)', background: '#fff',
        }}>
          <button onClick={onCancel}
            style={{ padding: '10px 18px', minHeight: 44, border: '1px solid var(--border)', background: '#fff', borderRadius: 8, cursor: 'pointer', fontSize: 14 }}>
            Cancelar
          </button>
          <button onClick={handleSave} disabled={!canSave}
            style={{ padding: '10px 18px', minHeight: 44, border: 'none', background: canSave ? 'var(--green)' : 'var(--stone)', color: '#fff', borderRadius: 8, cursor: canSave ? 'pointer' : 'default', fontSize: 14, fontWeight: 600 }}>
            Guardar acción
          </button>
        </div>
      </div>
    </div>
  )
}

// 'YYYY-MM-DDTHH:MM(:SS)' + N min → mismo formato con offset. Pura.
function addMinutes(iso, minutes) {
  if (!iso || !iso.includes('T')) return iso
  const [date, time] = iso.split('T')
  const [hh, mm] = time.split(':').map(Number)
  const total = hh * 60 + mm + minutes
  const nh = String(Math.floor(total / 60) % 24).padStart(2, '0')
  const nm = String(total % 60).padStart(2, '0')
  return `${date}T${nh}:${nm}:00`
}
