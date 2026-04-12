import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import Layout from '../../components/Layout/Layout'
import './agenda.css'

/* ── Helpers ─────────────────────────────────────────────────────── */
const DAYS_SHORT  = ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom']
const MONTHS_LONG = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
const MONTHS_SHORT= ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic']
const HOURS       = Array.from({length:13}, (_,i) => i + 8) // 8..20

function monday(d) {
  const dt = new Date(d)
  const dow = dt.getDay() === 0 ? 6 : dt.getDay() - 1
  dt.setDate(dt.getDate() - dow)
  dt.setHours(0,0,0,0)
  return dt
}
function addDays(d, n) { const r = new Date(d); r.setDate(r.getDate()+n); return r }
function isoDate(d)  { return d.toISOString().split('T')[0] }
function fmtTime(iso){ if(!iso) return ''; const d=new Date(iso); return `${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}` }
function fmtLong(iso){ if(!iso) return ''; const d=new Date(iso); return `${DAYS_SHORT[d.getDay()===0?6:d.getDay()-1]} ${d.getDate()} ${MONTHS_SHORT[d.getMonth()]} · ${fmtTime(iso)}` }

const STATUS_BADGE = { confirmed:'badge-green', pending:'badge-gold', cancelled:'badge-gray', completed:'badge-gray' }
const STATUS_TXT   = { confirmed:'Confirmada', pending:'Pendiente', cancelled:'Cancelada', completed:'Completada' }
const HOUR_PX = 60  // px por hora

/* ── Componente ──────────────────────────────────────────────────── */
export default function Agenda() {
  const [weekStart,    setWeekStart]    = useState(() => monday(new Date()))
  const [professionals,setProfessionals]= useState([])
  const [appointments, setAppointments] = useState([])
  const [loading,      setLoading]      = useState(true)
  const [selectedPro,  setSelectedPro]  = useState('all') // 'all' | id
  const [detailAppt,   setDetailAppt]   = useState(null)
  const [showNew,      setShowNew]      = useState(false)
  const [newSlot,      setNewSlot]      = useState(null)  // {date, hour, proId}
  const [toast,        setToast]        = useState(null)

  const weekEnd = addDays(weekStart, 6)

  useEffect(() => { fetchProfessionals() }, [])

  useEffect(() => {
    if (professionals.length > 0 || true) fetchAppointments()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekStart])

  async function fetchProfessionals() {
    const { data } = await supabase.from('professionals').select('id, full_name, specialty').order('full_name')
    setProfessionals(data || [])
  }

  async function fetchAppointments() {
    setLoading(true)
    const { data } = await supabase
      .from('appointments')
      .select('id, start_time, end_time, status, duration_minutes, patients(id, full_name, phone), professionals(id, full_name), services(name)')
      .gte('start_time', weekStart.toISOString())
      .lte('start_time', addDays(weekStart, 7).toISOString())
      .neq('status', 'cancelled')
      .order('start_time')
    setAppointments(data || [])
    setLoading(false)
  }

  // Citas del día para un profesional dado
  function apptsByDayPro(dayDate, proId) {
    const ds = isoDate(dayDate)
    return appointments.filter(a => {
      const aDate = isoDate(new Date(a.start_time))
      const matchPro = !proId || a.professionals?.id === proId
      return aDate === ds && matchPro
    })
  }

  // Top offset (px) desde las 8:00
  function apptTop(iso) {
    const d = new Date(iso)
    return (d.getHours() - 8) * HOUR_PX + (d.getMinutes() / 60) * HOUR_PX
  }
  function apptHeight(a) {
    const dur = a.duration_minutes || 45
    return Math.max((dur / 60) * HOUR_PX, 22)
  }

  const visiblePros = selectedPro === 'all' ? professionals : professionals.filter(p => p.id === selectedPro)
  const dayCols     = 7 * visiblePros.length

  function prevWeek() { setWeekStart(d => addDays(d, -7)) }
  function nextWeek() { setWeekStart(d => addDays(d,  7)) }
  function goToday()  { setWeekStart(monday(new Date())) }

  async function cancelAppt(id) {
    await supabase.from('appointments').update({ status:'cancelled' }).eq('id', id)
    setAppointments(prev => prev.map(a => a.id === id ? {...a, status:'cancelled'} : a))
    setDetailAppt(null)
    showToast('Cita cancelada')
  }

  function showToast(msg, isError=false) {
    setToast({ msg, isError })
    setTimeout(() => setToast(null), 3000)
  }

  function handleCellClick(day, hour, proId) {
    setNewSlot({ date: isoDate(day), hour, proId })
    setShowNew(true)
  }

  const weekLabel = `${weekStart.getDate()} – ${weekEnd.getDate()} de ${MONTHS_LONG[weekEnd.getMonth()]} ${weekEnd.getFullYear()}`

  const today = isoDate(new Date())

  return (
    <Layout
      title="Agenda · Osteopatía"
      actions={
        <button className="btn-primary" onClick={() => { setNewSlot(null); setShowNew(true) }}>
          + Nueva cita
        </button>
      }
    >
      {/* Controles de semana */}
      <div className="agenda-week-nav">
        <button className="agenda-week-btn" onClick={prevWeek}>← Anterior</button>
        <span className="agenda-week-label">{weekLabel}</span>
        <button className="agenda-today-btn" onClick={goToday}>Hoy</button>
        <button className="agenda-week-btn" onClick={nextWeek}>Siguiente →</button>
      </div>

      {/* Filtro de profesional */}
      {professionals.length > 1 && (
        <div className="agenda-pro-tabs">
          <button
            className={`agenda-pro-tab ${selectedPro === 'all' ? 'active' : ''}`}
            onClick={() => setSelectedPro('all')}
          >
            Todos
          </button>
          {professionals.map(p => (
            <button
              key={p.id}
              className={`agenda-pro-tab ${selectedPro === p.id ? 'active' : ''}`}
              onClick={() => setSelectedPro(p.id)}
            >
              {p.full_name.split(' ')[0]}
            </button>
          ))}
        </div>
      )}

      {/* Grid semanal */}
      <div className="agenda-grid-wrapper">
        <div className="agenda-grid" style={{'--day-cols': dayCols}}>

          {/* Header días */}
          <div className="agenda-header-row">
            <div className="agenda-time-gutter" />
            {Array.from({length:7}, (_,di) => {
              const day = addDays(weekStart, di)
              const ds  = isoDate(day)
              return visiblePros.length > 0
                ? visiblePros.map(p => (
                    <div key={`${ds}-${p.id}`} className={`agenda-day-header ${ds === today ? 'today' : ''}`}>
                      <div className="agenda-day-name">{DAYS_SHORT[di]}</div>
                      <div className="agenda-day-num">{day.getDate()}</div>
                    </div>
                  ))
                : (
                  <div key={ds} className={`agenda-day-header ${ds === today ? 'today' : ''}`}>
                    <div className="agenda-day-name">{DAYS_SHORT[di]}</div>
                    <div className="agenda-day-num">{day.getDate()}</div>
                  </div>
                )
            })}
          </div>

          {/* Sub-header profesionales */}
          {visiblePros.length > 1 && (
            <div className="agenda-pro-row">
              <div />
              {Array.from({length:7}, (_,di) =>
                visiblePros.map(p => (
                  <div key={`pro-${di}-${p.id}`} className="agenda-pro-cell">
                    {p.full_name.split(' ')[0]}
                  </div>
                ))
              )}
            </div>
          )}

          {/* Filas de horas */}
          {HOURS.map(h => (
            <div key={h} className="agenda-hour-row">
              <div className="agenda-hour-label">{h}:00</div>
              {Array.from({length:7}, (_,di) => {
                const day = addDays(weekStart, di)
                return visiblePros.length > 0
                  ? visiblePros.map(p => {
                      const cellAppts = apptsByDayPro(day, p.id).filter(a => {
                        const ah = new Date(a.start_time).getHours()
                        return ah === h
                      })
                      return (
                        <div
                          key={`cell-${di}-${p.id}-${h}`}
                          className="agenda-cell"
                          onClick={() => handleCellClick(day, h, p.id)}
                        >
                          {cellAppts.map(a => (
                            <div
                              key={a.id}
                              className={`appt-block ${a.status}`}
                              style={{
                                top: `${(new Date(a.start_time).getMinutes()/60)*HOUR_PX}px`,
                                height: `${apptHeight(a)}px`,
                              }}
                              onClick={e => { e.stopPropagation(); setDetailAppt(a) }}
                            >
                              <div className="appt-time">{fmtTime(a.start_time)}</div>
                              <div className="appt-name">{a.patients?.full_name || '—'}</div>
                            </div>
                          ))}
                        </div>
                      )
                    })
                  : (
                    <div
                      key={`cell-${di}-${h}`}
                      className="agenda-cell"
                      onClick={() => handleCellClick(day, h, null)}
                    />
                  )
              })}
            </div>
          ))}

        </div>
      </div>

      {/* Modal detalle de cita */}
      {detailAppt && (
        <ApptDetailModal
          appt={detailAppt}
          onClose={() => setDetailAppt(null)}
          onCancel={() => cancelAppt(detailAppt.id)}
        />
      )}

      {/* Modal nueva cita */}
      {showNew && (
        <NewApptModal
          professionals={professionals}
          defaultSlot={newSlot}
          onClose={() => setShowNew(false)}
          onCreated={(msg) => { showToast(msg); fetchAppointments(); setShowNew(false) }}
        />
      )}

      {toast && <div className={`toast ${toast.isError ? 'error' : ''}`}>{toast.msg}</div>}
    </Layout>
  )
}

/* ── Modal detalle ───────────────────────────────────────────────── */
function ApptDetailModal({ appt, onClose, onCancel }) {
  const STATUS_BADGE = { confirmed:'badge-green', pending:'badge-gold', cancelled:'badge-gray' }
  const STATUS_TXT   = { confirmed:'Confirmada',  pending:'Pendiente',  cancelled:'Cancelada' }
  const DAYS_SHORT   = ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom']
  const MONTHS_SHORT = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic']
  function fmtLong(iso) {
    if (!iso) return ''
    const d = new Date(iso)
    const dow = d.getDay() === 0 ? 6 : d.getDay() - 1
    const h = d.getHours().toString().padStart(2,'0')
    const m = d.getMinutes().toString().padStart(2,'0')
    return `${DAYS_SHORT[dow]} ${d.getDate()} ${MONTHS_SHORT[d.getMonth()]} · ${h}:${m}`
  }
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal appt-detail-modal" onClick={e => e.stopPropagation()}>
        <div className="appt-detail-header">
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
            <span className={`badge ${STATUS_BADGE[appt.status] || 'badge-gray'}`}>
              {STATUS_TXT[appt.status] || appt.status}
            </span>
            <button className="btn-ghost" style={{padding:'4px 10px',fontSize:12}} onClick={onClose}>✕</button>
          </div>
          <div className="appt-detail-patient" style={{marginTop:10}}>{appt.patients?.full_name || '—'}</div>
          <div className="appt-detail-phone">{appt.patients?.phone || ''}</div>
        </div>
        <div className="appt-detail-row">
          <span className="appt-detail-icon">📅</span>
          <span className="appt-detail-key">Fecha</span>
          <span className="appt-detail-val">{fmtLong(appt.start_time)}</span>
        </div>
        <div className="appt-detail-row">
          <span className="appt-detail-icon">👨‍⚕️</span>
          <span className="appt-detail-key">Profesional</span>
          <span className="appt-detail-val">{appt.professionals?.full_name || '—'}</span>
        </div>
        {appt.services?.name && (
          <div className="appt-detail-row">
            <span className="appt-detail-icon">🏥</span>
            <span className="appt-detail-key">Servicio</span>
            <span className="appt-detail-val">{appt.services.name}</span>
          </div>
        )}
        {appt.duration_minutes && (
          <div className="appt-detail-row">
            <span className="appt-detail-icon">⏱</span>
            <span className="appt-detail-key">Duración</span>
            <span className="appt-detail-val">{appt.duration_minutes} min</span>
          </div>
        )}
        <div className="modal-actions">
          {appt.status !== 'cancelled' && appt.status !== 'completed' && (
            <button className="btn-danger" onClick={onCancel}>Cancelar cita</button>
          )}
          <button className="btn-secondary" onClick={onClose}>Cerrar</button>
        </div>
      </div>
    </div>
  )
}

/* ── Modal nueva cita ────────────────────────────────────────────── */
function NewApptModal({ professionals, defaultSlot, onClose, onCreated }) {
  const [form, setForm] = useState({
    patientSearch: '',
    patientId: '',
    proId: defaultSlot?.proId || professionals[0]?.id || '',
    date: defaultSlot?.date || new Date().toISOString().split('T')[0],
    time: defaultSlot?.hour ? `${String(defaultSlot.hour).padStart(2,'0')}:00` : '10:00',
    duration: '45',
    notes: '',
  })
  const [patients, setPatients] = useState([])
  const [searching, setSearching] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  async function searchPatients(q) {
    if (q.length < 2) { setPatients([]); return }
    setSearching(true)
    const { data } = await supabase
      .from('patients')
      .select('id, full_name, phone')
      .or(`full_name.ilike.%${q}%,phone.ilike.%${q}%`)
      .limit(8)
    setPatients(data || [])
    setSearching(false)
  }

  function selectPatient(p) {
    setForm(f => ({...f, patientSearch: `${p.full_name} · ${p.phone||''}`, patientId: p.id}))
    setPatients([])
  }

  async function handleSave() {
    if (!form.patientId || !form.proId || !form.date || !form.time) {
      setError('Completa todos los campos obligatorios')
      return
    }
    setSaving(true)
    setError(null)
    const startTime = new Date(`${form.date}T${form.time}:00`)
    const { error: err } = await supabase.from('appointments').insert({
      patient_id:       form.patientId,
      professional_id:  form.proId,
      start_time:       startTime.toISOString(),
      duration_minutes: parseInt(form.duration) || 45,
      status:           'confirmed',
    })
    setSaving(false)
    if (err) { setError(err.message); return }
    onCreated('Cita creada correctamente')
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-title">Nueva cita de osteopatía</div>

        {/* Buscar paciente */}
        <div className="field-group new-appt-search">
          <label className="field-label">Paciente *</label>
          <input
            className="field-input"
            placeholder="Buscar por nombre o teléfono…"
            value={form.patientSearch}
            onChange={e => { setForm(f=>({...f, patientSearch:e.target.value, patientId:''})); searchPatients(e.target.value) }}
          />
          {patients.length > 0 && (
            <div className="patient-dropdown">
              {patients.map(p => (
                <div key={p.id} className="patient-option" onClick={() => selectPatient(p)}>
                  <div className="patient-option-name">{p.full_name}</div>
                  <div className="patient-option-phone">{p.phone}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Profesional */}
        <div className="field-group">
          <label className="field-label">Profesional *</label>
          <select className="field-input" value={form.proId} onChange={e => setForm(f=>({...f, proId:e.target.value}))}>
            <option value="">Seleccionar…</option>
            {professionals.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
          </select>
        </div>

        {/* Fecha + hora */}
        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:12}}>
          <div className="field-group">
            <label className="field-label">Fecha *</label>
            <input type="date" className="field-input" value={form.date} onChange={e => setForm(f=>({...f, date:e.target.value}))} />
          </div>
          <div className="field-group">
            <label className="field-label">Hora *</label>
            <input type="time" className="field-input" value={form.time} onChange={e => setForm(f=>({...f, time:e.target.value}))} />
          </div>
        </div>

        {/* Duración */}
        <div className="field-group">
          <label className="field-label">Duración (minutos)</label>
          <select className="field-input" value={form.duration} onChange={e => setForm(f=>({...f, duration:e.target.value}))}>
            {[30,45,60,90].map(d => <option key={d} value={d}>{d} min</option>)}
          </select>
        </div>

        {error && <p style={{color:'var(--red)',fontSize:13,marginBottom:8}}>{error}</p>}

        <div className="modal-actions">
          <button className="btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Guardando…' : 'Crear cita'}
          </button>
        </div>
      </div>
    </div>
  )
}
