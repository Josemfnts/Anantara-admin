import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import Layout from '../../components/Layout/Layout'
import './agenda.css'

const MONTHS = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic']
function fmtDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return `${d.getDate()} ${MONTHS[d.getMonth()]} · ${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`
}

export default function Espera() {
  const [items,    setItems]    = useState([])
  const [loading,  setLoading]  = useState(true)
  const [pros,     setPros]     = useState([])
  const [toast,    setToast]    = useState(null)

  useEffect(() => {
    fetchAll()
  }, [])

  async function fetchAll() {
    const [waitRes, prosRes] = await Promise.all([
      supabase
        .from('waiting_list')
        .select('*, patients(full_name, phone), professionals(full_name), services(name)')
        .eq('status', 'waiting')
        .order('created_at'),
      supabase.from('professionals').select('id, full_name'),
    ])
    setItems(waitRes.data || [])
    setPros(prosRes.data || [])
    setLoading(false)
  }

  async function assignCita(item) {
    // Crear cita y marcar como atendido en lista de espera
    const date = prompt('Fecha y hora para la cita (YYYY-MM-DDTHH:MM):')
    if (!date) return
    try {
      const { error } = await supabase.from('appointments').insert({
        patient_id:      item.patients?.id || item.patient_id,
        professional_id: item.professionals?.id || item.professional_id,
        start_time:      new Date(date).toISOString(),
        status:          'confirmed',
      })
      if (error) throw error
      await supabase.from('waiting_list').update({ status: 'assigned' }).eq('id', item.id)
      setItems(prev => prev.filter(i => i.id !== item.id))
      showToast('Cita asignada correctamente')
    } catch (e) {
      showToast(e.message, true)
    }
  }

  async function removeFromList(id) {
    await supabase.from('waiting_list').update({ status: 'removed' }).eq('id', id)
    setItems(prev => prev.filter(i => i.id !== id))
    showToast('Eliminado de la lista')
  }

  function showToast(msg, err=false) {
    setToast({msg,err}); setTimeout(() => setToast(null), 3000)
  }

  return (
    <Layout title="Lista de espera">
      <div className="section-header" style={{marginBottom:16}}>
        <span className="section-title">Pacientes en espera</span>
        <span style={{fontSize:13, color:'var(--text-muted)'}}>
          {items.length} {items.length === 1 ? 'paciente' : 'pacientes'} en lista
        </span>
      </div>

      <div className="card" style={{overflow:'hidden'}}>
        {loading ? (
          [1,2,3].map(i => <div key={i} className="skel" style={{height:72, margin:12, borderRadius:12}} />)
        ) : items.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">✅</div>
            <div className="empty-state-title">Lista de espera vacía</div>
            <div className="empty-state-sub">No hay pacientes en espera actualmente</div>
          </div>
        ) : items.map((item, idx) => (
          <div key={item.id} className="wait-row">
            <div className="wait-position">{idx + 1}</div>
            <div className="wait-info">
              <div className="wait-name">{item.patients?.full_name || '—'}</div>
              <div className="wait-meta">
                {item.professionals?.full_name && `${item.professionals.full_name} · `}
                {item.services?.name && `${item.services.name} · `}
                Desde {fmtDate(item.created_at)}
              </div>
              {item.notes && <div style={{fontSize:11, color:'var(--text-muted)', marginTop:2}}>{item.notes}</div>}
            </div>
            <div style={{display:'flex', gap:8}}>
              <button className="btn-secondary" style={{fontSize:12, padding:'7px 12px'}} onClick={() => assignCita(item)}>
                Asignar cita
              </button>
              <button className="btn-ghost" style={{fontSize:12, padding:'7px 12px'}} onClick={() => removeFromList(item.id)}>
                Eliminar
              </button>
            </div>
          </div>
        ))}
      </div>

      {toast && <div className={`toast ${toast.err ? 'error' : ''}`}>{toast.msg}</div>}
    </Layout>
  )
}
