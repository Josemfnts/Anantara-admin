import { useEffect, useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import Layout from '../../components/Layout/Layout'
import './dashboard.css'

const MONTHS = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic']
const WEEKDAYS = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado']

function fmtTime(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return `${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`
}
function fmtDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return `${d.getDate()} ${MONTHS[d.getMonth()]} · ${fmtTime(iso)}`
}
function todayRange() {
  const d = new Date()
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0,0,0).toISOString()
  const end   = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23,59,59).toISOString()
  return { start, end }
}
function weekRange() {
  const d   = new Date()
  const dow = d.getDay() === 0 ? 6 : d.getDay() - 1
  const mon = new Date(d); mon.setDate(d.getDate() - dow); mon.setHours(0,0,0,0)
  const sun = new Date(mon); sun.setDate(mon.getDate() + 6); sun.setHours(23,59,59)
  return { start: mon.toISOString(), end: sun.toISOString() }
}

export default function Dashboard() {
  const [stats,        setStats]        = useState(null)
  const [todayAppts,   setTodayAppts]   = useState([])
  const [upcomingSlots,setUpcomingSlots]= useState([])
  const [loading,      setLoading]      = useState(true)
  const [newNotifs,    setNewNotifs]    = useState([])

  const toastRef = useRef(null)

  useEffect(() => {
    fetchAll()
    const unsub = subscribeRealtime()
    return unsub
  }, [])

  async function fetchAll() {
    const { start: tStart, end: tEnd } = todayRange()
    const { start: wStart, end: wEnd } = weekRange()

    const [
      { count: citasHoy },
      { count: pendientes },
      { count: yogaSemana },
      appts,
      slots,
    ] = await Promise.all([
      supabase.from('appointments').select('*', { count: 'exact', head: true })
        .gte('start_time', tStart).lte('start_time', tEnd).neq('status', 'cancelled'),
      supabase.from('appointments').select('*', { count: 'exact', head: true })
        .eq('status', 'pending'),
      supabase.from('bookings').select('*', { count: 'exact', head: true })
        .gte('created_at', wStart).lte('created_at', wEnd),
      supabase.from('appointments')
        .select('id, start_time, status, patients(full_name, phone), professionals(full_name)')
        .gte('start_time', tStart).lte('start_time', tEnd)
        .neq('status', 'cancelled').order('start_time'),
      supabase.from('availability_slots')
        .select('id, start_time, max_bookings, services(name), bookings(count)')
        .eq('is_published', true)
        .gte('start_time', new Date().toISOString())
        .order('start_time').limit(5),
    ])

    setStats({ citasHoy: citasHoy || 0, pendientes: pendientes || 0, yogaSemana: yogaSemana || 0 })
    setTodayAppts(appts.data || [])
    setUpcomingSlots(slots.data || [])
    setLoading(false)
  }

  function subscribeRealtime() {
    const ch = supabase.channel('admin-notifs')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'appointments' }, payload => {
        setNewNotifs(n => [...n, { type: 'appointment', data: payload.new, id: Date.now() }])
        showToast('Nueva cita de osteopatía reservada')
        setStats(s => s ? { ...s, citasHoy: s.citasHoy + 1 } : s)
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'bookings' }, payload => {
        setNewNotifs(n => [...n, { type: 'booking', data: payload.new, id: Date.now() }])
        showToast('Nueva reserva de clase recibida')
      })
      .subscribe()
    return () => supabase.removeChannel(ch)
  }

  function showToast(msg) {
    if (toastRef.current) clearTimeout(toastRef.current)
    setToastMsg(msg)
    toastRef.current = setTimeout(() => setToastMsg(null), 4000)
  }
  const [toastMsg, setToastMsg] = useState(null)

  const now = new Date()
  const greeting = now.getHours() < 13 ? 'Buenos días' : now.getHours() < 20 ? 'Buenas tardes' : 'Buenas noches'
  const dateLabel = `${WEEKDAYS[now.getDay()]} ${now.getDate()} de ${MONTHS[now.getMonth()].charAt(0).toUpperCase() + MONTHS[now.getMonth()].slice(1)}`

  const STATUS_CLS = { confirmed:'badge-green', pending:'badge-gold', cancelled:'badge-red', completed:'badge-gray' }
  const STATUS_TXT = { confirmed:'Confirmada', pending:'Pendiente', cancelled:'Cancelada', completed:'Completada' }

  return (
    <Layout title="Dashboard" notifCount={newNotifs.length}>

      {/* Encabezado */}
      <div className="dash-greeting">
        <div>
          <h2 className="dash-greeting-text">{greeting} 👋</h2>
          <p className="dash-date">{dateLabel}</p>
        </div>
        {newNotifs.length > 0 && (
          <button className="dash-clear-notifs" onClick={() => setNewNotifs([])}>
            Limpiar {newNotifs.length} notificación{newNotifs.length !== 1 ? 'es' : ''}
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="dash-stats">
        {[
          { icon: '📅', label: 'Citas hoy',         val: stats?.citasHoy,   color: 'green',  to: '/agenda' },
          { icon: '⏳', label: 'Pendientes conf.',   val: stats?.pendientes, color: 'gold',   to: '/agenda' },
          { icon: '🧘', label: 'Reservas esta sem.', val: stats?.yogaSemana, color: 'purple', to: '/yoga' },
        ].map(s => (
          <Link key={s.label} to={s.to} className={`dash-stat-card dash-stat-${s.color}`}>
            <div className="dash-stat-icon">{s.icon}</div>
            <div className="dash-stat-val">
              {loading ? <div className="skel" style={{width:32,height:32}} /> : (s.val ?? '—')}
            </div>
            <div className="dash-stat-label">{s.label}</div>
          </Link>
        ))}
      </div>

      {/* Dos columnas */}
      <div className="dash-cols">

        {/* Citas de hoy */}
        <div className="card dash-section">
          <div className="section-header" style={{padding:'16px 20px 0'}}>
            <span className="section-title">Citas de hoy</span>
            <Link to="/agenda" className="btn-ghost" style={{fontSize:12,padding:'6px 12px'}}>
              Ver agenda →
            </Link>
          </div>
          <div className="dash-appt-list">
            {loading ? (
              [1,2,3].map(i => <div key={i} className="skel" style={{height:64,margin:'8px 20px',borderRadius:12}} />)
            ) : todayAppts.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">🗓</div>
                <div className="empty-state-title">Sin citas hoy</div>
                <div className="empty-state-sub">No hay citas programadas para hoy</div>
              </div>
            ) : todayAppts.map(a => (
              <div key={a.id} className="dash-appt-row">
                <div className="dash-appt-time">{fmtTime(a.start_time)}</div>
                <div className="dash-appt-info">
                  <div className="dash-appt-patient">{a.patients?.full_name || '—'}</div>
                  <div className="dash-appt-pro">{a.professionals?.full_name || '—'}</div>
                </div>
                <span className={`badge ${STATUS_CLS[a.status] || 'badge-gray'}`}>
                  {STATUS_TXT[a.status] || a.status}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Próximas clases / slots */}
        <div className="card dash-section">
          <div className="section-header" style={{padding:'16px 20px 0'}}>
            <span className="section-title">Próximas clases</span>
            <Link to="/yoga" className="btn-ghost" style={{fontSize:12,padding:'6px 12px'}}>
              Gestionar →
            </Link>
          </div>
          <div className="dash-appt-list">
            {loading ? (
              [1,2].map(i => <div key={i} className="skel" style={{height:64,margin:'8px 20px',borderRadius:12}} />)
            ) : upcomingSlots.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">🧘</div>
                <div className="empty-state-title">Sin clases publicadas</div>
                <div className="empty-state-sub">Publica clases de Yoga o Belleza</div>
              </div>
            ) : upcomingSlots.map(s => {
              const booked = Array.isArray(s.bookings) ? s.bookings.length : (s.bookings?.count || 0)
              const free   = (s.max_bookings || 10) - booked
              return (
                <div key={s.id} className="dash-appt-row">
                  <div className="dash-appt-time">{fmtTime(s.start_time)}<br/><span style={{fontSize:10,color:'#aaa'}}>{new Date(s.start_time).getDate()} {MONTHS[new Date(s.start_time).getMonth()]}</span></div>
                  <div className="dash-appt-info">
                    <div className="dash-appt-patient">{s.services?.name || 'Clase'}</div>
                    <div className="dash-appt-pro">{booked}/{s.max_bookings || 10} inscritos</div>
                  </div>
                  <span className={`badge ${free === 0 ? 'badge-red' : free <= 2 ? 'badge-gold' : 'badge-green'}`}>
                    {free === 0 ? 'Completo' : `${free} libres`}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

      </div>

      {toastMsg && <div className="toast">{toastMsg}</div>}
    </Layout>
  )
}
