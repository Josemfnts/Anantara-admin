import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import Layout from '../../components/Layout/Layout'
import './pacientes.css'

const MONTHS = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic']
function fmtDate(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`
}
function fmtDateTime(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return `${d.getDate()} ${MONTHS[d.getMonth()]} · ${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`
}

const STATUS_TXT = { confirmed:'Confirmada', pending:'Pendiente', cancelled:'Cancelada', completed:'Completada' }
const STATUS_CLS = { confirmed:'badge-green', pending:'badge-gold', cancelled:'badge-red', completed:'badge-gray' }

export default function Pacientes() {
  const [patients,    setPatients]    = useState([])
  const [loading,     setLoading]     = useState(true)
  const [query,       setQuery]       = useState('')
  const [selected,    setSelected]    = useState(null)
  const [history,     setHistory]     = useState([])
  const [histLoading, setHistLoading] = useState(false)
  const [page,        setPage]        = useState(0)
  const [total,       setTotal]       = useState(0)
  const PAGE_SIZE = 20

  useEffect(() => {
    const t = setTimeout(() => fetchPatients(query, 0), 300)
    return () => clearTimeout(t)
  }, [query])

  async function fetchPatients(q, p) {
    setLoading(true)
    let req = supabase
      .from('patients')
      .select('id, full_name, phone, created_at', { count: 'exact' })
      .order('full_name')
      .range(p * PAGE_SIZE, (p + 1) * PAGE_SIZE - 1)

    if (q.trim()) {
      req = req.or(`full_name.ilike.%${q}%,phone.ilike.%${q}%`)
    }
    const { data, count } = await req
    setPatients(data || [])
    setTotal(count || 0)
    setPage(p)
    setLoading(false)
  }

  async function fetchHistory(patientId) {
    setHistLoading(true)
    const [appts, bookings] = await Promise.all([
      supabase.from('appointments')
        .select('id, start_time, status, professionals(full_name), services(name)')
        .eq('patient_id', patientId)
        .order('start_time', { ascending: false })
        .limit(20),
      supabase.from('bookings')
        .select('id, status, created_at, availability_slots(start_time, services(name))')
        .eq('patient_id', patientId)
        .order('created_at', { ascending: false })
        .limit(10),
    ])
    const a = (appts.data||[]).map(x => ({
      id: x.id, type:'osteo', typeLabel:'Osteopatía',
      name: x.services?.name || 'Osteopatía',
      pro:  x.professionals?.full_name,
      date: x.start_time, status: x.status,
    }))
    const b = (bookings.data||[]).map(x => {
      const name = x.availability_slots?.services?.name || 'Clase'
      return {
        id: x.id, type: name.toLowerCase().includes('yoga') ? 'yoga' : 'belleza',
        typeLabel: name.toLowerCase().includes('yoga') ? 'Yoga' : 'Belleza',
        name, date: x.availability_slots?.start_time || x.created_at,
        status: x.status,
      }
    })
    const all = [...a,...b].sort((x,y) => new Date(y.date)-new Date(x.date))
    setHistory(all)
    setHistLoading(false)
  }

  function selectPatient(p) {
    setSelected(p)
    fetchHistory(p.id)
  }

  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <Layout title="Pacientes">
      <div className="pac-layout">

        {/* Columna izquierda: lista */}
        <div className="pac-list-col">
          <div className="pac-search-bar">
            <span className="pac-search-icon">🔍</span>
            <input
              className="pac-search-input"
              placeholder="Buscar por nombre o teléfono…"
              value={query}
              onChange={e => setQuery(e.target.value)}
              autoFocus
            />
            {query && (
              <button className="pac-search-clear" onClick={() => setQuery('')}>✕</button>
            )}
          </div>
          <div style={{fontSize:12, color:'var(--text-muted)', marginBottom:10, paddingLeft:4}}>
            {total} paciente{total !== 1 ? 's' : ''}
          </div>

          <div className="card pac-table-card">
            {loading ? (
              [1,2,3,4,5].map(i => <div key={i} className="skel" style={{height:56, margin:'6px 12px', borderRadius:10}} />)
            ) : patients.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">👥</div>
                <div className="empty-state-title">Sin resultados</div>
                <div className="empty-state-sub">Prueba con otro nombre o teléfono</div>
              </div>
            ) : patients.map(p => (
              <div
                key={p.id}
                className={`pac-row ${selected?.id === p.id ? 'active' : ''}`}
                onClick={() => selectPatient(p)}
              >
                <div className="pac-avatar">{p.full_name?.slice(0,2).toUpperCase() || '?'}</div>
                <div className="pac-info">
                  <div className="pac-name">{p.full_name}</div>
                  <div className="pac-phone">{p.phone || 'Sin teléfono'}</div>
                </div>
                <span style={{fontSize:10,color:'#ccc'}}>›</span>
              </div>
            ))}
          </div>

          {/* Paginación */}
          {totalPages > 1 && (
            <div style={{display:'flex', justifyContent:'center', gap:8, marginTop:12}}>
              <button className="btn-ghost" style={{padding:'6px 12px'}} disabled={page===0} onClick={() => fetchPatients(query, page-1)}>← Anterior</button>
              <span style={{alignSelf:'center', fontSize:12, color:'var(--text-muted)'}}>{page+1} / {totalPages}</span>
              <button className="btn-ghost" style={{padding:'6px 12px'}} disabled={page>=totalPages-1} onClick={() => fetchPatients(query, page+1)}>Siguiente →</button>
            </div>
          )}
        </div>

        {/* Columna derecha: detalle */}
        <div className="pac-detail-col">
          {!selected ? (
            <div className="empty-state" style={{height:'100%', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center'}}>
              <div className="empty-state-icon">👆</div>
              <div className="empty-state-title">Selecciona un paciente</div>
              <div className="empty-state-sub">Haz click en un paciente para ver su historial</div>
            </div>
          ) : (
            <>
              {/* Cabecera del paciente */}
              <div className="card pac-detail-header">
                <div className="pac-detail-avatar">{selected.full_name?.slice(0,2).toUpperCase()}</div>
                <div>
                  <div className="pac-detail-name">{selected.full_name}</div>
                  <div className="pac-detail-phone">{selected.phone || 'Sin teléfono registrado'}</div>
                  <div style={{fontSize:11, color:'var(--text-muted)', marginTop:4}}>
                    Paciente desde {fmtDate(selected.created_at)}
                  </div>
                </div>
              </div>

              {/* Historial */}
              <div className="section-header" style={{marginTop:20, marginBottom:12}}>
                <span className="section-title">Historial de citas</span>
                <span style={{fontSize:12, color:'var(--text-muted)'}}>{history.length} registros</span>
              </div>

              {histLoading ? (
                [1,2,3].map(i => <div key={i} className="skel" style={{height:64, marginBottom:8, borderRadius:12}} />)
              ) : history.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state-icon">📋</div>
                  <div className="empty-state-title">Sin historial</div>
                  <div className="empty-state-sub">Este paciente no tiene citas registradas</div>
                </div>
              ) : history.map(item => (
                <div key={`${item.type}-${item.id}`} className="pac-hist-row">
                  <span className={`badge ${
                    item.type === 'osteo' ? 'badge-green' :
                    item.type === 'yoga'  ? 'badge-gold'  : 'badge-purple'
                  }`}>{item.typeLabel}</span>
                  <div className="pac-hist-info">
                    <div className="pac-hist-name">{item.name}{item.pro ? ` · ${item.pro}` : ''}</div>
                    <div className="pac-hist-date">{fmtDateTime(item.date)}</div>
                  </div>
                  <span className={`badge ${STATUS_CLS[item.status] || 'badge-gray'}`}>
                    {STATUS_TXT[item.status] || item.status}
                  </span>
                </div>
              ))}
            </>
          )}
        </div>

      </div>
    </Layout>
  )
}
