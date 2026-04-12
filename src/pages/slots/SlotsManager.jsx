/**
 * SlotsManager — componente reutilizable para Yoga y Belleza.
 * section: 'yoga' | 'belleza'
 */
import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import Layout from '../../components/Layout/Layout'
import './slots.css'

const MONTHS = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic']
const WEEKDAYS = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb']

function fmtDateTime(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const h = d.getHours().toString().padStart(2,'0')
  const m = d.getMinutes().toString().padStart(2,'0')
  return `${WEEKDAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]} · ${h}:${m}h`
}

const SECTION_CONFIG = {
  yoga:    { title: 'Yoga',    icon: '🧘', color: '#C8A535', badgeCls: 'badge-gold',   bgCls: 'slot-yoga' },
  belleza: { title: 'Belleza', icon: '✨', color: '#7a52b0', badgeCls: 'badge-purple', bgCls: 'slot-belleza' },
}

export default function SlotsManager({ section }) {
  const cfg = SECTION_CONFIG[section] || SECTION_CONFIG.yoga

  const [slots,     setSlots]     = useState([])
  const [services,  setServices]  = useState([])
  const [pros,      setPros]      = useState([])
  const [loading,   setLoading]   = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editSlot,  setEditSlot]  = useState(null)
  const [showBookings, setShowBookings] = useState(null) // slot id
  const [bookingsList, setBookingsList] = useState([])
  const [toast,     setToast]     = useState(null)
  const [filter,    setFilter]    = useState('all') // all | published | draft | past

  useEffect(() => {
    fetchSlots()
    fetchMeta()
  }, [section])

  async function fetchSlots() {
    setLoading(true)
    const { data } = await supabase
      .from('availability_slots')
      .select('*, services(name, id), professionals(full_name, id), bookings(id, patients(full_name, phone))')
      .order('start_time', { ascending: false })
    // Filtrar por sección si hay servicios que lo indiquen
    setSlots(data || [])
    setLoading(false)
  }

  async function fetchMeta() {
    const [svRes, prRes] = await Promise.all([
      supabase.from('services').select('id, name').order('name'),
      supabase.from('professionals').select('id, full_name').order('full_name'),
    ])
    setServices(svRes.data || [])
    setPros(prRes.data || [])
  }

  async function togglePublish(slot) {
    const { error } = await supabase
      .from('availability_slots')
      .update({ is_published: !slot.is_published })
      .eq('id', slot.id)
    if (!error) {
      setSlots(prev => prev.map(s => s.id === slot.id ? {...s, is_published: !s.is_published} : s))
      showToast(slot.is_published ? 'Slot despublicado' : 'Slot publicado')
    }
  }

  async function deleteSlot(id) {
    if (!confirm('¿Eliminar este slot y todas sus reservas?')) return
    await supabase.from('bookings').delete().eq('slot_id', id)
    await supabase.from('availability_slots').delete().eq('id', id)
    setSlots(prev => prev.filter(s => s.id !== id))
    showToast('Slot eliminado')
  }

  async function openBookings(slot) {
    setShowBookings(slot.id)
    setBookingsList(slot.bookings || [])
  }

  function showToast(msg, err=false) {
    setToast({msg,err}); setTimeout(() => setToast(null), 3000)
  }

  const now = new Date()
  const filtered = slots.filter(s => {
    const d = new Date(s.start_time)
    if (filter === 'published') return s.is_published && d >= now
    if (filter === 'draft')     return !s.is_published
    if (filter === 'past')      return d < now
    return true
  })

  return (
    <Layout
      title={cfg.title}
      actions={
        <button className="btn-primary" onClick={() => { setEditSlot(null); setShowModal(true) }}>
          + Nuevo slot
        </button>
      }
    >
      {/* Filtros */}
      <div style={{display:'flex', gap:8, marginBottom:16, flexWrap:'wrap'}}>
        {[
          { key:'all',       label:'Todos' },
          { key:'published', label:'Publicados' },
          { key:'draft',     label:'Borradores' },
          { key:'past',      label:'Pasados' },
        ].map(f => (
          <button key={f.key}
            className={`agenda-pro-tab ${filter===f.key ? 'active' : ''}`}
            onClick={() => setFilter(f.key)}
          >{f.label}</button>
        ))}
        <span style={{marginLeft:'auto', fontSize:13, color:'var(--text-muted)', alignSelf:'center'}}>
          {filtered.length} slots
        </span>
      </div>

      {/* Lista de slots */}
      {loading ? (
        [1,2,3].map(i => <div key={i} className="skel" style={{height:96, marginBottom:12, borderRadius:16}} />)
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">{cfg.icon}</div>
          <div className="empty-state-title">No hay slots aquí</div>
          <div className="empty-state-sub">Crea el primer slot con el botón "Nuevo slot"</div>
        </div>
      ) : (
        <div className="slots-list">
          {filtered.map(slot => {
            const booked = Array.isArray(slot.bookings) ? slot.bookings.length : 0
            const free   = (slot.max_bookings || 10) - booked
            const isPast = new Date(slot.start_time) < now
            return (
              <div key={slot.id} className={`slot-card card ${isPast ? 'slot-past' : ''}`}>
                <div className={`slot-accent ${cfg.bgCls}`}>{cfg.icon}</div>
                <div className="slot-main">
                  <div className="slot-top">
                    <span className="slot-name">{slot.services?.name || cfg.title}</span>
                    <div style={{display:'flex', gap:6, alignItems:'center'}}>
                      {slot.is_published
                        ? <span className="badge badge-green">Publicado</span>
                        : <span className="badge badge-gray">Borrador</span>}
                      {isPast && <span className="badge badge-gray">Pasado</span>}
                    </div>
                  </div>
                  <div className="slot-meta">
                    <span>📅 {fmtDateTime(slot.start_time)}</span>
                    {slot.duration_minutes && <span>⏱ {slot.duration_minutes} min</span>}
                    {slot.professionals?.full_name && <span>👤 {slot.professionals.full_name}</span>}
                    {slot.price != null && <span>💶 {slot.price}€</span>}
                  </div>
                  <div className="slot-footer">
                    <div className="slot-plazas">
                      <div className="slot-plazas-bar">
                        <div className="slot-plazas-fill" style={{
                          width: `${Math.min((booked/(slot.max_bookings||10))*100, 100)}%`,
                          background: free <= 0 ? 'var(--red)' : free <= 2 ? 'var(--gold)' : 'var(--green)',
                        }} />
                      </div>
                      <span className="slot-plazas-text">
                        {booked}/{slot.max_bookings||10} inscritos · {free > 0 ? `${free} libres` : 'Completo'}
                      </span>
                    </div>
                    <div className="slot-actions">
                      {booked > 0 && (
                        <button className="btn-ghost" style={{fontSize:12,padding:'6px 10px'}} onClick={() => openBookings(slot)}>
                          Ver inscritos ({booked})
                        </button>
                      )}
                      {!isPast && (
                        <button
                          className={slot.is_published ? 'btn-ghost' : 'btn-secondary'}
                          style={{fontSize:12,padding:'6px 10px'}}
                          onClick={() => togglePublish(slot)}
                        >
                          {slot.is_published ? 'Despublicar' : 'Publicar'}
                        </button>
                      )}
                      <button className="btn-ghost" style={{fontSize:12,padding:'6px 10px'}} onClick={() => { setEditSlot(slot); setShowModal(true) }}>
                        Editar
                      </button>
                      <button className="btn-danger" style={{fontSize:12,padding:'6px 10px'}} onClick={() => deleteSlot(slot.id)}>
                        Eliminar
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal crear/editar */}
      {showModal && (
        <SlotFormModal
          slot={editSlot}
          services={services}
          pros={pros}
          section={section}
          onClose={() => setShowModal(false)}
          onSaved={(msg) => { showToast(msg); fetchSlots(); setShowModal(false) }}
        />
      )}

      {/* Modal inscritos */}
      {showBookings && (
        <div className="modal-overlay" onClick={() => setShowBookings(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">Inscritos</div>
            {bookingsList.length === 0 ? (
              <p style={{color:'var(--text-muted)', fontSize:13}}>Sin inscritos aún</p>
            ) : bookingsList.map((b, i) => (
              <div key={b.id} style={{
                display:'flex', alignItems:'center', gap:12,
                padding:'10px 0', borderBottom:'1px solid var(--border)',
              }}>
                <span style={{
                  width:28,height:28,background:'var(--green-subtle)',color:'var(--green)',
                  borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',
                  fontSize:12,fontWeight:800,flexShrink:0
                }}>{i+1}</span>
                <div>
                  <div style={{fontSize:13,fontWeight:700}}>{b.patients?.full_name || '—'}</div>
                  <div style={{fontSize:11,color:'var(--text-muted)'}}>{b.patients?.phone || ''}</div>
                </div>
              </div>
            ))}
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setShowBookings(null)}>Cerrar</button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className={`toast ${toast.err ? 'error' : ''}`}>{toast.msg}</div>}
    </Layout>
  )
}

/* ── Modal de formulario ─────────────────────────────────────────── */
function SlotFormModal({ slot, services, pros, section, onClose, onSaved }) {
  const defaultDate = slot?.start_time
    ? new Date(slot.start_time).toISOString().split('T')[0]
    : new Date().toISOString().split('T')[0]
  const defaultTime = slot?.start_time
    ? `${new Date(slot.start_time).getHours().toString().padStart(2,'0')}:${new Date(slot.start_time).getMinutes().toString().padStart(2,'0')}`
    : '10:00'

  const [form, setForm] = useState({
    service_id:       slot?.services?.id || slot?.service_id || '',
    professional_id:  slot?.professionals?.id || slot?.professional_id || '',
    date:             defaultDate,
    time:             defaultTime,
    duration_minutes: slot?.duration_minutes || 60,
    max_bookings:     slot?.max_bookings || 10,
    price:            slot?.price ?? '',
    is_published:     slot?.is_published ?? false,
  })
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState(null)

  async function handleSave() {
    if (!form.date || !form.time) { setError('Fecha y hora son obligatorias'); return }
    setSaving(true); setError(null)
    const start = new Date(`${form.date}T${form.time}:00`).toISOString()
    const payload = {
      service_id:       form.service_id || null,
      professional_id:  form.professional_id || null,
      start_time:       start,
      duration_minutes: parseInt(form.duration_minutes) || 60,
      max_bookings:     parseInt(form.max_bookings) || 10,
      price:            form.price !== '' ? parseFloat(form.price) : null,
      is_published:     form.is_published,
    }
    let err
    if (slot?.id) {
      ({ error: err } = await supabase.from('availability_slots').update(payload).eq('id', slot.id))
    } else {
      ({ error: err } = await supabase.from('availability_slots').insert(payload))
    }
    setSaving(false)
    if (err) { setError(err.message); return }
    onSaved(slot ? 'Slot actualizado' : 'Slot creado correctamente')
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{maxWidth:520}} onClick={e => e.stopPropagation()}>
        <div className="modal-title">{slot ? 'Editar slot' : 'Nuevo slot'}</div>

        <div className="field-group">
          <label className="field-label">Servicio</label>
          <select className="field-input" value={form.service_id} onChange={e => setForm(f=>({...f, service_id:e.target.value}))}>
            <option value="">Sin servicio asociado</option>
            {services.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>

        <div className="field-group">
          <label className="field-label">Profesional (opcional)</label>
          <select className="field-input" value={form.professional_id} onChange={e => setForm(f=>({...f, professional_id:e.target.value}))}>
            <option value="">Sin profesional asignado</option>
            {pros.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
          </select>
        </div>

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

        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12}}>
          <div className="field-group">
            <label className="field-label">Duración (min)</label>
            <select className="field-input" value={form.duration_minutes} onChange={e => setForm(f=>({...f, duration_minutes:e.target.value}))}>
              {[30,45,60,75,90,120].map(d => <option key={d} value={d}>{d} min</option>)}
            </select>
          </div>
          <div className="field-group">
            <label className="field-label">Plazas máx.</label>
            <input type="number" className="field-input" min={1} max={50} value={form.max_bookings} onChange={e => setForm(f=>({...f, max_bookings:e.target.value}))} />
          </div>
          <div className="field-group">
            <label className="field-label">Precio (€)</label>
            <input type="number" className="field-input" min={0} step={0.5} placeholder="0" value={form.price} onChange={e => setForm(f=>({...f, price:e.target.value}))} />
          </div>
        </div>

        <div className="field-group">
          <label style={{display:'flex', alignItems:'center', gap:10, cursor:'pointer', userSelect:'none'}}>
            <input type="checkbox" checked={form.is_published} onChange={e => setForm(f=>({...f, is_published:e.target.checked}))}
              style={{accentColor:'var(--green)', width:16, height:16}} />
            <span style={{fontSize:13, fontWeight:600, color:'var(--text)'}}>Publicar inmediatamente</span>
          </label>
        </div>

        {error && <p style={{color:'var(--red)', fontSize:13, marginBottom:8}}>{error}</p>}

        <div className="modal-actions">
          <button className="btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Guardando…' : slot ? 'Actualizar' : 'Crear slot'}
          </button>
        </div>
      </div>
    </div>
  )
}
