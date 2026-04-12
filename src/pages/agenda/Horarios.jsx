import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import Layout from '../../components/Layout/Layout'
import './agenda.css'

const DAYS = ['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo']
// day_of_week: 1=Lun…7=Dom (ISO)

function emptySchedule() {
  return DAYS.map((_, i) => ({
    day_of_week: i + 1,
    active: i < 5,
    start_time: '09:00',
    end_time:   '14:00',
  }))
}

export default function Horarios() {
  const [professionals, setProfessionals] = useState([])
  const [selectedPro,   setSelectedPro]   = useState('')
  const [schedule,      setSchedule]      = useState(emptySchedule())
  const [loading,       setLoading]       = useState(false)
  const [saving,        setSaving]        = useState(false)
  const [toast,         setToast]         = useState(null)

  useEffect(() => {
    supabase.from('professionals').select('id, full_name').order('full_name')
      .then(({ data }) => {
        setProfessionals(data || [])
        if (data?.length) setSelectedPro(data[0].id)
      })
  }, [])

  useEffect(() => {
    if (selectedPro) fetchSchedule(selectedPro)
  }, [selectedPro])

  async function fetchSchedule(proId) {
    setLoading(true)
    const { data } = await supabase
      .from('working_hours')
      .select('*')
      .eq('professional_id', proId)
    setLoading(false)

    const base = emptySchedule()
    if (data?.length) {
      data.forEach(wh => {
        const idx = (wh.day_of_week - 1 + 7) % 7  // 1=Lun→0
        if (base[idx]) {
          base[idx].active     = true
          base[idx].start_time = wh.start_time?.slice(0,5) || '09:00'
          base[idx].end_time   = wh.end_time?.slice(0,5)   || '14:00'
          base[idx].id         = wh.id
        }
      })
    }
    setSchedule(base)
  }

  function update(i, field, val) {
    setSchedule(prev => prev.map((d, idx) => idx === i ? {...d, [field]: val} : d))
  }

  async function handleSave() {
    if (!selectedPro) return
    setSaving(true)
    try {
      // Borrar todos los horarios del profesional y recragar
      await supabase.from('working_hours').delete().eq('professional_id', selectedPro)

      const toInsert = schedule
        .filter(d => d.active)
        .map(d => ({
          professional_id: selectedPro,
          day_of_week:     d.day_of_week,
          start_time:      d.start_time,
          end_time:        d.end_time,
        }))

      if (toInsert.length > 0) {
        const { error } = await supabase.from('working_hours').insert(toInsert)
        if (error) throw error
      }
      showToast('Horarios guardados correctamente')
    } catch (e) {
      showToast(e.message, true)
    } finally {
      setSaving(false)
    }
  }

  function showToast(msg, err=false) {
    setToast({ msg, err })
    setTimeout(() => setToast(null), 3000)
  }

  return (
    <Layout
      title="Horarios de trabajo"
      actions={
        <button className="btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? 'Guardando…' : '💾 Guardar horarios'}
        </button>
      }
    >
      {/* Selector profesional */}
      <div className="card" style={{padding:20, marginBottom:20}}>
        <div style={{display:'flex', alignItems:'center', gap:16, flexWrap:'wrap'}}>
          <label className="field-label" style={{margin:0}}>Profesional:</label>
          <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
            {professionals.map(p => (
              <button
                key={p.id}
                className={`agenda-pro-tab ${selectedPro===p.id ? 'active' : ''}`}
                onClick={() => setSelectedPro(p.id)}
              >
                {p.full_name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Grid de horarios */}
      <div className="card" style={{padding:20, overflowX:'auto'}}>
        <div className="section-header" style={{marginBottom:20}}>
          <span className="section-title">Horario semanal</span>
          <span style={{fontSize:12, color:'var(--text-muted)'}}>Activa los días que trabaja y configura las horas</span>
        </div>

        {loading ? (
          <div className="skel" style={{height:200}} />
        ) : (
          <div style={{display:'flex', flexDirection:'column', gap:8}}>
            {schedule.map((day, i) => (
              <div key={i} style={{
                display:'grid', gridTemplateColumns:'130px 80px 1fr',
                alignItems:'center', gap:16,
                padding:'12px 16px',
                background: day.active ? 'var(--green-subtle)' : '#fafafa',
                borderRadius:'var(--radius)',
                border: `1px solid ${day.active ? '#d0e8d4' : 'var(--border)'}`,
              }}>
                {/* Nombre + toggle */}
                <div style={{display:'flex', alignItems:'center', gap:10}}>
                  <label style={{
                    display:'inline-flex', alignItems:'center', gap:6,
                    cursor:'pointer', userSelect:'none',
                    fontSize:13, fontWeight:700,
                    color: day.active ? 'var(--green-dark)' : 'var(--text-muted)',
                  }}>
                    <input
                      type="checkbox"
                      checked={day.active}
                      onChange={e => update(i, 'active', e.target.checked)}
                      style={{accentColor:'var(--green)', width:16, height:16}}
                    />
                    {DAYS[i]}
                  </label>
                </div>

                {/* Estado */}
                <span style={{
                  fontSize:11, fontWeight:700,
                  color: day.active ? 'var(--green)' : '#aaa',
                }}>
                  {day.active ? 'Activo' : 'Libre'}
                </span>

                {/* Horas */}
                <div style={{
                  display:'flex', alignItems:'center', gap:10,
                  opacity: day.active ? 1 : 0.3,
                  pointerEvents: day.active ? 'auto' : 'none',
                }}>
                  <input
                    type="time" className="field-input"
                    style={{width:110}}
                    value={day.start_time}
                    onChange={e => update(i, 'start_time', e.target.value)}
                  />
                  <span style={{color:'var(--text-muted)', fontSize:13}}>–</span>
                  <input
                    type="time" className="field-input"
                    style={{width:110}}
                    value={day.end_time}
                    onChange={e => update(i, 'end_time', e.target.value)}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {toast && <div className={`toast ${toast.err ? 'error' : ''}`}>{toast.msg}</div>}
    </Layout>
  )
}
