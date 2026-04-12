import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import Layout from '../../components/Layout/Layout'
import './agenda.css'

const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
const MONTH_SHORT = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic']
const DAYS_LABELS = ['L','M','X','J','V','S','D']

function pad(n) { return String(n).padStart(2,'0') }
function isoDate(y,m,d) { return `${y}-${pad(m+1)}-${pad(d)}` }
function buildGrid(y, m) {
  const first = new Date(y, m, 1)
  const last  = new Date(y, m+1, 0).getDate()
  let offset  = first.getDay() - 1; if (offset < 0) offset = 6
  const cells = []
  for (let i = 0; i < offset; i++) cells.push(null)
  for (let d = 1; d <= last; d++) cells.push(d)
  return cells
}

export default function Bloqueados() {
  const today = new Date(); today.setHours(0,0,0,0)
  const [professionals, setProfessionals] = useState([])
  const [selectedPro,   setSelectedPro]   = useState('')
  const [year,   setYear]   = useState(today.getFullYear())
  const [month,  setMonth]  = useState(today.getMonth())
  const [blocked, setBlocked] = useState([]) // [{id, date, reason}]
  const [showModal, setShowModal] = useState(false)
  const [newDate,   setNewDate]   = useState('')
  const [newReason, setNewReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [toast,  setToast]  = useState(null)

  useEffect(() => {
    supabase.from('professionals').select('id, full_name').order('full_name')
      .then(({ data }) => {
        setProfessionals(data || [])
        if (data?.length) setSelectedPro(data[0].id)
      })
  }, [])

  useEffect(() => {
    if (selectedPro) fetchBlocked(selectedPro)
  }, [selectedPro, year, month])

  async function fetchBlocked(proId) {
    const start = isoDate(year, month, 1)
    const end   = isoDate(year, month, new Date(year, month+1, 0).getDate())
    const { data } = await supabase
      .from('blocked_days')
      .select('id, date, reason')
      .eq('professional_id', proId)
      .gte('date', start)
      .lte('date', end)
      .order('date')
    setBlocked(data || [])
  }

  async function addBlocked() {
    if (!newDate) return
    setSaving(true)
    const { error } = await supabase.from('blocked_days').insert({
      professional_id: selectedPro,
      date:   newDate,
      reason: newReason || null,
    })
    setSaving(false)
    if (error) { showToast(error.message, true); return }
    showToast('Día bloqueado añadido')
    setShowModal(false); setNewDate(''); setNewReason('')
    fetchBlocked(selectedPro)
  }

  async function removeBlocked(id) {
    await supabase.from('blocked_days').delete().eq('id', id)
    setBlocked(prev => prev.filter(b => b.id !== id))
    showToast('Día desbloqueado')
  }

  function toggleDay(day) {
    const ds = isoDate(year, month, day)
    const existing = blocked.find(b => b.date === ds)
    if (existing) { removeBlocked(existing.id) }
    else { setNewDate(ds); setShowModal(true) }
  }

  function showToast(msg, err=false) {
    setToast({msg,err}); setTimeout(() => setToast(null), 3000)
  }
  function prevMonth() { if(month===0){setYear(y=>y-1);setMonth(11)} else setMonth(m=>m-1) }
  function nextMonth() { if(month===11){setYear(y=>y+1);setMonth(0)} else setMonth(m=>m+1) }

  const grid       = buildGrid(year, month)
  const blockedSet = new Set(blocked.map(b => b.date))
  const todayDs    = isoDate(today.getFullYear(), today.getMonth(), today.getDate())

  return (
    <Layout
      title="Días bloqueados"
      actions={
        <button className="btn-primary" onClick={() => { setNewDate(''); setShowModal(true) }}>
          + Bloquear día
        </button>
      }
    >
      {/* Selector profesional */}
      <div className="card" style={{padding:20, marginBottom:20}}>
        <div style={{display:'flex', alignItems:'center', gap:12, flexWrap:'wrap'}}>
          <span className="field-label" style={{margin:0}}>Profesional:</span>
          {professionals.map(p => (
            <button key={p.id}
              className={`agenda-pro-tab ${selectedPro===p.id ? 'active' : ''}`}
              onClick={() => setSelectedPro(p.id)}
            >{p.full_name}</button>
          ))}
        </div>
      </div>

      <div className="blocked-cal-wrapper">

        {/* Mini calendario */}
        <div className="mini-cal">
          <div className="mini-cal-nav">
            <button className="mini-cal-btn" onClick={prevMonth}>‹</button>
            <span className="mini-cal-month">{MONTHS[month]} {year}</span>
            <button className="mini-cal-btn" onClick={nextMonth}>›</button>
          </div>
          <div className="mini-cal-grid">
            {DAYS_LABELS.map(d => <div key={d} className="mini-cal-lbl">{d}</div>)}
            {grid.map((day, i) => {
              if (!day) return <div key={`e-${i}`} />
              const ds    = isoDate(year, month, day)
              const isPast = new Date(ds) < today
              const isBlk  = blockedSet.has(ds)
              const isTod  = ds === todayDs
              let cls = 'mini-cal-day'
              if (isPast)    cls += ' past'
              else if (isBlk) cls += ' blocked'
              else if (isTod) cls += ' today active'
              else            cls += ' active'
              return (
                <div key={day} className={cls} title={isBlk ? 'Click para desbloquear' : 'Click para bloquear'}
                  onClick={() => !isPast && toggleDay(day)}>
                  {day}
                </div>
              )
            })}
          </div>
          <p style={{fontSize:11,color:'var(--text-muted)',textAlign:'center',marginTop:12}}>
            Rojo = bloqueado · Click para alternar
          </p>
        </div>

        {/* Lista de días bloqueados */}
        <div>
          <div className="section-header" style={{marginBottom:12}}>
            <span className="section-title">
              Días bloqueados · {MONTHS[month]}
            </span>
          </div>
          {blocked.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">✅</div>
              <div className="empty-state-title">Sin días bloqueados</div>
              <div className="empty-state-sub">Este mes no hay días bloqueados para este profesional</div>
            </div>
          ) : (
            <div className="card blocked-list">
              {blocked.map(b => {
                const d = new Date(b.date + 'T12:00:00')
                return (
                  <div key={b.id} className="blocked-item">
                    <div>
                      <div className="blocked-date">
                        {d.getDate()} de {MONTH_SHORT[d.getMonth()]} de {d.getFullYear()}
                      </div>
                      {b.reason && <div className="blocked-reason">{b.reason}</div>}
                    </div>
                    <button className="blocked-remove" onClick={() => removeBlocked(b.id)}>
                      Desbloquear
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Modal añadir */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">Bloquear día</div>
            <div className="field-group">
              <label className="field-label">Fecha *</label>
              <input type="date" className="field-input" value={newDate}
                min={todayDs}
                onChange={e => setNewDate(e.target.value)} />
            </div>
            <div className="field-group">
              <label className="field-label">Motivo (opcional)</label>
              <input className="field-input" placeholder="Vacaciones, formación…" value={newReason}
                onChange={e => setNewReason(e.target.value)} />
            </div>
            <div className="modal-actions">
              <button className="btn-ghost" onClick={() => setShowModal(false)}>Cancelar</button>
              <button className="btn-primary" onClick={addBlocked} disabled={!newDate || saving}>
                {saving ? 'Guardando…' : 'Bloquear'}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className={`toast ${toast.err ? 'error' : ''}`}>{toast.msg}</div>}
    </Layout>
  )
}
