// Escalada — clases con plazas (availability_slots + bookings).
//
// Lo que resuelve para Marta:
// - Plantillas recurrentes que se rellenan solas: «Rellenar plantillas» crea lo que
//   falte hasta 8 semanas en todas las activas, ya publicado si quiere.
// - Clases por semana, con borradores, publicadas y canceladas distinguibles, y
//   «Publicar borradores» de una vez.
// - Apuntados de cada clase: añadir a alguien a mano (por teléfono o en persona),
//   quitarle, avisarle por WhatsApp y pasar lista (vino / no vino) al acabar.
// - Cancelar una clase avisa a los apuntados (con vista previa del mensaje).
// - Editar una plantilla puede llevar el cambio a sus clases futuras.
//
// Las reservas viven en `bookings` (la misma tabla que la app y el bot); el aforo
// lo hace cumplir el trigger check_capacity de la base.
//
// Props: sb, botFetch, ui ({Btn,Inp,Sel,Modal,Sp,Em,Bg,Toggle,Toast}), onNav.

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { clasesQueFaltan, porSemana, propagarPlantilla, activas, ymd } from '../lib/clases.js'
import { diaLegible, nombreCorto } from '../lib/jornadas.js'
import { AvisoModal, BuscadorPaciente } from './AvisosWhatsApp.jsx'

const SECCION = 'escalada'
const DAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
const pad = n => String(n).padStart(2, '0')
const QHOURS = Array.from({ length: (22 - 7) * 4 + 1 }, (_, i) => `${pad(7 + Math.floor(i / 4))}:${pad((i % 4) * 15)}`)
const SEMANAS = 8
const localNow = () => { const d = new Date(); return `${ymd(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}:00` }
const hhmm = iso => String(iso || '').slice(11, 16)
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const fCorta = ymdStr => { const [, m, d] = ymdStr.split('-').map(Number); return `${d} ${MESES[m - 1]}` }
const EMPTY_TPL = { day_of_week: 2, start_time: '17:00', end_time: '18:30', max_bookings: 10, service_id: '', professional_id: '', is_active: true }

const estadoClase = s => s.cancelled_at ? ['red', 'Cancelada'] : s.is_published ? ['green', 'Publicada'] : ['gray', 'Borrador']

export function EscaladaPage({ sb, botFetch, ui, onNav }) {
  const { Btn, Inp, Sel, Modal, Sp, Em, Bg, Toggle, Toast } = ui
  const [tab, setTab] = useState('clases')
  const [cuando, setCuando] = useState('proximas')
  const [slots, setSlots] = useState([])
  const [templates, setTemplates] = useState([])
  const [futurasTpl, setFuturasTpl] = useState({}) // template_id → última fecha generada
  const [services, setServices] = useState([])
  const [profs, setProfs] = useState([])
  const [profsDeSeccion, setProfsDeSeccion] = useState(true)
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState(null)
  const [saving, setSaving] = useState(false)
  const [tplModal, setTplModal] = useState(null)
  const [tplForm, setTplForm] = useState(EMPTY_TPL)
  const [propagar, setPropagar] = useState(true)
  const [slotModal, setSlotModal] = useState(null)
  const [slotForm, setSlotForm] = useState({})
  const [detalleId, setDetalleId] = useState(null)
  const [cancelar, setCancelar] = useState(null)
  const [aviso, setAviso] = useState(null)
  const [confirmar, setConfirmar] = useState(null)
  const [publicarAlGenerar, setPublicarAlGenerar] = useState(true)
  const ok = msg => setToast({ msg, type: 'ok' })
  const fallo = msg => setToast({ msg, type: 'error' })

  const load = useCallback(async () => {
    setLoading(true)
    const now = localNow()
    const [{ data: svcs }, { data: ps }, { data: tpls }] = await Promise.all([
      sb.from('services').select('id,name,duration_minutes,price').eq('section', SECCION).eq('is_active', true).order('name'),
      sb.from('professionals').select('id,name,section').eq('is_active', true).order('name'),
      sb.from('class_templates').select('*,services(name),professionals(name)').eq('section', SECCION).order('day_of_week').order('start_time'),
    ])
    const deSeccion = (ps || []).filter(p => p.section === SECCION)
    setProfsDeSeccion(deSeccion.length > 0)
    setProfs(deSeccion.length ? deSeccion : (ps || []))
    setServices(svcs || [])
    setTemplates(tpls || [])
    const svcIds = (svcs || []).map(s => s.id)
    if (!svcIds.length) { setSlots([]); setLoading(false); return }
    const desde = new Date(); desde.setDate(desde.getDate() - SEMANAS * 7)
    let q = sb.from('availability_slots')
      .select('id,starts_at,ends_at,max_bookings,is_published,cancelled_at,template_id,service_id,professional_id,professionals(id,name),services(id,name,price),bookings(id,status,booked_via,patient_id,patients(id,full_name,phone))')
      .in('service_id', svcIds)
    q = cuando === 'proximas'
      ? q.gte('starts_at', now).order('starts_at', { ascending: true })
      : q.lt('starts_at', now).gte('starts_at', `${ymd(desde)}T00:00:00`).order('starts_at', { ascending: false })
    const { data: sl, error } = await q.limit(300)
    if (error) fallo('Error al cargar las clases: ' + error.message)
    setSlots(sl || [])
    // Hasta dónde llega cada plantilla (para avisar de que se está acabando).
    const { data: gen } = await sb.from('availability_slots').select('template_id,starts_at')
      .in('template_id', (tpls || []).map(t => t.id).concat('00000000-0000-0000-0000-000000000000'))
      .gte('starts_at', now)
    const hasta = {}
    for (const g of gen || []) { const d = g.starts_at.slice(0, 10); if (!hasta[g.template_id] || d > hasta[g.template_id]) hasta[g.template_id] = d }
    setFuturasTpl(hasta)
    setLoading(false)
  }, [sb, cuando])
  useEffect(() => { load() }, [load])

  const detalle = useMemo(() => slots.find(s => s.id === detalleId) || null, [slots, detalleId])
  const borradores = slots.filter(s => !s.is_published && !s.cancelled_at)
  const semanas = useMemo(() => porSemana(slots), [slots])

  // ── Plantillas ────────────────────────────────────────────────────────────
  const rellenarPlantillas = async (soloTpl = null) => {
    const lista = soloTpl ? [soloTpl] : templates.filter(t => t.is_active)
    if (!lista.length) { fallo('No hay plantillas activas'); return }
    setSaving(true)
    const { data: existentes } = await sb.from('availability_slots').select('template_id,starts_at')
      .in('template_id', lista.map(t => t.id)).gte('starts_at', `${ymd(new Date())}T00:00:00`)
    const porTpl = {}
    for (const e of existentes || []) (porTpl[e.template_id] ||= []).push(e.starts_at.slice(0, 10))
    const nuevas = lista.flatMap(t => clasesQueFaltan(t, porTpl[t.id] || [], new Date(), SEMANAS))
      .map(c => ({ ...c, is_published: publicarAlGenerar }))
    if (!nuevas.length) { setSaving(false); ok(`Ya estaban todas las clases de las próximas ${SEMANAS} semanas`); return }
    const { error } = await sb.from('availability_slots').insert(nuevas)
    setSaving(false)
    if (error) { fallo('Error: ' + error.message); return }
    ok(`${nuevas.length} clase${nuevas.length !== 1 ? 's' : ''} creada${nuevas.length !== 1 ? 's' : ''}${publicarAlGenerar ? ' y publicada' + (nuevas.length !== 1 ? 's' : '') : ' en borrador'}`)
    load()
  }

  const abrirTpl = tpl => {
    setTplForm(tpl
      ? { day_of_week: tpl.day_of_week, start_time: tpl.start_time?.slice(0, 5), end_time: tpl.end_time?.slice(0, 5), max_bookings: tpl.max_bookings, service_id: tpl.service_id || '', professional_id: tpl.professional_id || '', is_active: tpl.is_active }
      : { ...EMPTY_TPL, service_id: services[0]?.id || '', professional_id: profs[0]?.id || '' })
    setPropagar(true)
    setTplModal(tpl || 'new')
  }

  const guardarTpl = async () => {
    if (!tplForm.service_id || !tplForm.professional_id) { fallo('Elige servicio y monitor'); return }
    if (tplForm.end_time <= tplForm.start_time) { fallo('La hora de fin tiene que ser posterior a la de inicio'); return }
    if (Number(tplForm.max_bookings) < 1) { fallo('Pon al menos 1 plaza'); return }
    setSaving(true)
    const payload = { section: SECCION, day_of_week: Number(tplForm.day_of_week), start_time: tplForm.start_time + ':00', end_time: tplForm.end_time + ':00', max_bookings: Number(tplForm.max_bookings), service_id: tplForm.service_id, professional_id: tplForm.professional_id, is_active: tplForm.is_active }
    const editando = tplModal?.id
    const { error } = editando
      ? await sb.from('class_templates').update(payload).eq('id', editando)
      : await sb.from('class_templates').insert(payload)
    if (error) { setSaving(false); fallo('Error: ' + error.message); return }
    let extra = ''
    if (editando && propagar) {
      const { data: futuras } = await sb.from('availability_slots').select('id,starts_at,ends_at,max_bookings,bookings(status)')
        .eq('template_id', editando).gte('starts_at', localNow()).is('cancelled_at', null)
      const { cambios, bloqueadas } = propagarPlantilla({ ...payload, id: editando }, futuras || [])
      for (const c of cambios) await sb.from('availability_slots').update(c.cambios).eq('id', c.id)
      extra = cambios.length ? ` · ${cambios.length} clase${cambios.length !== 1 ? 's' : ''} actualizada${cambios.length !== 1 ? 's' : ''}` : ''
      if (bloqueadas.length) extra += ` · ${bloqueadas.length} sin tocar (tienen más apuntados que las plazas nuevas)`
    }
    setSaving(false); setTplModal(null)
    ok((editando ? 'Plantilla actualizada' : 'Plantilla creada') + extra)
    load()
  }

  const borrarTpl = async tpl => {
    const { error } = await sb.from('class_templates').delete().eq('id', tpl.id)
    setConfirmar(null)
    if (error) { fallo('Error: ' + error.message); return }
    ok('Plantilla borrada · sus clases siguen ahí'); load()
  }

  const pausarTpl = async tpl => {
    const { error } = await sb.from('class_templates').update({ is_active: !tpl.is_active }).eq('id', tpl.id)
    if (error) { fallo('Error: ' + error.message); return }
    ok(tpl.is_active ? 'Plantilla pausada · las clases ya creadas siguen' : 'Plantilla activa'); load()
  }

  // ── Clases ────────────────────────────────────────────────────────────────
  const publicarBorradores = async () => {
    const ids = borradores.map(s => s.id)
    const { error } = await sb.from('availability_slots').update({ is_published: true }).in('id', ids)
    if (error) { fallo('Error: ' + error.message); return }
    ok(`${ids.length} clase${ids.length !== 1 ? 's' : ''} publicada${ids.length !== 1 ? 's' : ''}`); load()
  }

  const togglePublicar = async slot => {
    const { error } = await sb.from('availability_slots').update({ is_published: !slot.is_published }).eq('id', slot.id)
    if (error) { fallo('Error: ' + error.message); return }
    ok(slot.is_published ? 'Clase ocultada: ya no se puede reservar' : 'Clase publicada'); load()
  }

  const abrirClase = slot => {
    setSlotForm(slot
      ? { date: slot.starts_at.slice(0, 10), start_time: hhmm(slot.starts_at), end_time: hhmm(slot.ends_at), max_bookings: slot.max_bookings }
      : { date: '', start_time: '17:00', end_time: '18:30', max_bookings: 10, service_id: services[0]?.id || '', professional_id: profs[0]?.id || '', publicar: true })
    setSlotModal(slot || 'new')
  }

  const guardarClase = async () => {
    const f = slotForm, nueva = slotModal === 'new'
    if (!f.date || !f.start_time || !f.end_time) { fallo('Falta fecha u hora'); return }
    if (f.end_time <= f.start_time) { fallo('La hora de fin tiene que ser posterior a la de inicio'); return }
    if (nueva && (!f.service_id || !f.professional_id)) { fallo('Elige servicio y monitor'); return }
    const ocupadas = nueva ? 0 : activas(slotModal.bookings).length
    if (Number(f.max_bookings) < Math.max(1, ocupadas)) { fallo(`Ya hay ${ocupadas} apuntados: no puedes dejar menos plazas`); return }
    setSaving(true)
    const base = { starts_at: `${f.date}T${f.start_time}:00`, ends_at: `${f.date}T${f.end_time}:00`, max_bookings: Number(f.max_bookings) }
    const { error } = nueva
      ? await sb.from('availability_slots').insert({ ...base, service_id: f.service_id, professional_id: f.professional_id, is_published: !!f.publicar, template_id: null })
      : await sb.from('availability_slots').update(base).eq('id', slotModal.id)
    setSaving(false)
    if (error) { fallo('Error: ' + error.message); return }
    const cambioHora = !nueva && (base.starts_at.slice(0, 16) !== slotModal.starts_at.slice(0, 16))
    setSlotModal(null)
    ok(nueva ? 'Clase creada' : cambioHora && ocupadas ? `Clase movida · avisa a los ${ocupadas} apuntados desde la clase` : 'Clase actualizada')
    load()
  }

  const borrarClase = async slot => {
    setConfirmar(null)
    const { error } = await sb.from('availability_slots').delete().eq('id', slot.id)
    if (error) { fallo('No se puede borrar: tiene historial de reservas. Cancélala.'); return }
    ok('Clase borrada'); load()
  }

  const cancelarClase = async (slot, idsAvisados = null) => {
    const ahora = new Date().toISOString()
    const r1 = await sb.from('bookings').update({ status: 'cancelled', cancelled_by: 'secretary', cancelled_at: ahora })
      .eq('slot_id', slot.id).neq('status', 'cancelled')
    const r2 = await sb.from('availability_slots').update({ is_published: false, cancelled_at: ahora }).eq('id', slot.id)
    setCancelar(null); setAviso(null)
    if (r1.error || r2.error) { fallo('Error al cancelar: ' + (r1.error || r2.error).message); load(); return }
    ok(idsAvisados ? `Clase cancelada · ${idsAvisados.length} avisado${idsAvisados.length !== 1 ? 's' : ''}` : 'Clase cancelada')
    load()
  }

  const reabrirClase = async slot => {
    const { error } = await sb.from('availability_slots').update({ cancelled_at: null }).eq('id', slot.id)
    if (error) { fallo('Error: ' + error.message); return }
    ok('Clase reabierta en borrador · los apuntados siguen cancelados'); load()
  }

  // ── Apuntados ─────────────────────────────────────────────────────────────
  const apuntar = async (slot, p) => {
    const ya = (slot.bookings || []).find(b => b.patient_id === p.id)
    const { error } = ya
      ? await sb.from('bookings').update({ status: 'confirmed', booked_via: 'secretary', cancelled_by: null, cancelled_at: null }).eq('id', ya.id)
      : await sb.from('bookings').insert({ patient_id: p.id, slot_id: slot.id, status: 'confirmed', booked_via: 'secretary' })
    if (error) { fallo(/plazas/i.test(error.message) ? 'La clase está llena' : 'Error: ' + error.message); return }
    ok(`${p.full_name} apuntado/a`); load()
  }

  const quitar = async b => {
    const { error } = await sb.from('bookings').update({ status: 'cancelled', cancelled_by: 'secretary', cancelled_at: new Date().toISOString() }).eq('id', b.id)
    if (error) { fallo('Error: ' + error.message); return }
    ok('Quitado/a de la clase'); load()
  }

  const asistencia = async (ids, status) => {
    const { error } = await sb.from('bookings').update({ status }).in('id', ids)
    if (error) { fallo('Error: ' + error.message); return }
    load()
  }

  const destinatarios = (slot, bookings) => bookings.map(b => ({
    id: b.id, nombre: nombreCorto(b.patients?.full_name), nombreCompleto: b.patients?.full_name, phone: b.patients?.phone,
    datos: { servicio: slot.services?.name || 'escalada', dia: diaLegible(slot.starts_at), hora: hhmm(slot.starts_at) },
  }))

  if (loading && !slots.length && !templates.length) return <Sp />
  const sinServicio = services.length === 0

  return <>
    {toast && <Toast msg={toast.msg} type={toast.type} onDone={() => setToast(null)} />}
    <div className="section-header">
      <span className="section-title">Escalada</span>
      <div className="tab-pills" style={{ margin: 0 }}>
        <button className={`tab-pill${tab === 'clases' ? ' active' : ''}`} onClick={() => setTab('clases')}>Clases</button>
        <button className={`tab-pill${tab === 'plantillas' ? ' active' : ''}`} onClick={() => setTab('plantillas')}>Plantillas</button>
      </div>
    </div>

    {sinServicio && <Aviso>
      No hay ningún servicio de escalada activo, así que no se pueden crear clases. Créalo en <strong>Servicios</strong> (sección Escalada), con su precio.
      {onNav && <Btn variant="ghost" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => onNav('servicios')}>Ir a Servicios</Btn>}
    </Aviso>}
    {!sinServicio && !profsDeSeccion && <Aviso>
      No hay ningún monitor de escalada dado de alta: de momento se ofrecen todos los profesionales. Da de alta al monitor en <strong>Profesionales</strong> (sección Escalada).
      {onNav && <Btn variant="ghost" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => onNav('profesionales')}>Ir a Profesionales</Btn>}
    </Aviso>}
    {!sinServicio && services.some(s => s.price == null) && <Aviso>
      {services.filter(s => s.price == null).map(s => s.name).join(', ')} no tiene precio: el bot no puede decírselo a quien pregunte.
    </Aviso>}

    {tab === 'plantillas' && <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
          <Toggle on={publicarAlGenerar} onChange={setPublicarAlGenerar} /> Publicar al crear
        </label>
        <div style={{ display: 'flex', gap: 8 }}>
          <Btn variant="ghost" onClick={() => rellenarPlantillas()} disabled={saving || !templates.some(t => t.is_active)}>⚡ Rellenar {SEMANAS} semanas</Btn>
          <Btn onClick={() => abrirTpl(null)} disabled={sinServicio}>+ Nueva plantilla</Btn>
        </div>
      </div>
      {templates.length === 0
        ? <Em icon="🔁" title="Sin plantillas" sub="Una plantilla es una clase que se repite cada semana (p. ej. martes 17:00). Crea una y rellena las próximas semanas de un toque." />
        : <div className="card" style={{ overflow: 'hidden' }}>
          {templates.map(tpl => {
            const hasta = futurasTpl[tpl.id]
            const corta = tpl.is_active && (!hasta || hasta < ymd(new Date(Date.now() + 21 * 86400000)))
            return <div key={tpl.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderBottom: '1px solid var(--border)', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
                  {DAYS[tpl.day_of_week]}s · {tpl.start_time?.slice(0, 5)} – {tpl.end_time?.slice(0, 5)}
                  <Bg variant={tpl.is_active ? 'green' : 'gray'}>{tpl.is_active ? 'Activa' : 'Pausada'}</Bg>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                  {tpl.services?.name || '—'} · {tpl.professionals?.name || '—'} · {tpl.max_bookings} plazas
                </div>
                <div style={{ fontSize: 11, marginTop: 2, color: corta ? 'var(--error)' : 'var(--text-muted)' }}>
                  {hasta ? `Clases creadas hasta el ${fCorta(hasta)}` : 'Sin clases futuras'}{corta ? ' · rellena para no quedarte sin clases' : ''}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <Btn variant="ghost" style={{ padding: '4px 10px', fontSize: 11 }} disabled={saving || !tpl.is_active} onClick={() => rellenarPlantillas(tpl)}>⚡ Rellenar</Btn>
                <Btn variant="ghost" style={{ padding: '4px 10px', fontSize: 11 }} onClick={() => abrirTpl(tpl)}>✏️</Btn>
                <Toggle on={tpl.is_active} onChange={() => pausarTpl(tpl)} />
                <Btn variant="danger" style={{ padding: '4px 10px', fontSize: 11 }} onClick={() => setConfirmar({ tipo: 'tpl', obj: tpl })}>🗑</Btn>
              </div>
            </div>
          })}
        </div>}
    </>}

    {tab === 'clases' && <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
        <div className="tab-pills" style={{ margin: 0 }}>
          {[['proximas', 'Próximas'], ['pasadas', `Pasadas (${SEMANAS} sem.)`]].map(([id, l]) => <button key={id} className={`tab-pill${cuando === id ? ' active' : ''}`} onClick={() => setCuando(id)}>{l}</button>)}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {cuando === 'proximas' && borradores.length > 0 && <Btn variant="gold" onClick={publicarBorradores}>Publicar {borradores.length} borrador{borradores.length !== 1 ? 'es' : ''}</Btn>}
          <Btn onClick={() => abrirClase(null)} disabled={sinServicio}>+ Clase suelta</Btn>
        </div>
      </div>
      {loading ? <Sp /> : slots.length === 0
        ? <Em icon="🧗" title={cuando === 'proximas' ? 'Sin clases próximas' : 'Sin clases pasadas'} sub={cuando === 'proximas' ? 'Crea una plantilla y pulsa «Rellenar», o añade una clase suelta.' : ''} />
        : semanas.map(sem => <div key={sem.lunes} style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.04em', margin: '4px 2px 6px' }}>
            Semana del {fCorta(sem.lunes)}
          </div>
          <div className="card" style={{ overflow: 'hidden' }}>
            {sem.clases.map(slot => {
              const ap = activas(slot.bookings)
              const pct = slot.max_bookings > 0 ? Math.round(ap.length / slot.max_bookings * 100) : 0
              const [v, l] = estadoClase(slot)
              const pendienteLista = cuando === 'pasadas' && !slot.cancelled_at && ap.some(b => b.status === 'confirmed')
              return <div key={slot.id} className="slot-card" style={{ cursor: 'pointer', opacity: slot.cancelled_at ? .6 : 1 }} onClick={() => setDetalleId(slot.id)}>
                <div className="slot-info">
                  <div className="slot-title">{diaLegible(slot.starts_at).replace(/^./, c => c.toUpperCase())} · {hhmm(slot.starts_at)}–{hhmm(slot.ends_at)}</div>
                  <div className="slot-meta">{slot.services?.name}{slot.professionals?.name ? ` · ${slot.professionals.name}` : ''} · {ap.length}/{slot.max_bookings} plazas{slot.services?.price != null ? ` · ${slot.services.price} €` : ''}</div>
                  <div className="slot-bar"><div className="slot-bar-fill" style={{ width: `${pct}%` }} /></div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end' }} onClick={e => e.stopPropagation()}>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {pendienteLista && <Bg variant="gold">Pasar lista</Bg>}
                    {ap.length >= slot.max_bookings && !slot.cancelled_at && <Bg variant="purple">Llena</Bg>}
                    <Bg variant={v}>{l}</Bg>
                  </div>
                  {!slot.cancelled_at && cuando === 'proximas' && <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                    <Btn variant={slot.is_published ? 'secondary' : 'primary'} style={{ padding: '4px 8px', fontSize: 11 }} onClick={() => togglePublicar(slot)}>{slot.is_published ? 'Ocultar' : 'Publicar'}</Btn>
                    <Btn variant="ghost" style={{ padding: '4px 8px', fontSize: 11 }} onClick={() => abrirClase(slot)}>✏️</Btn>
                  </div>}
                </div>
              </div>
            })}
          </div>
        </div>)}
    </>}

    {detalle && <Modal title={`${detalle.services?.name || 'Clase'} · ${diaLegible(detalle.starts_at)} ${hhmm(detalle.starts_at)}`} onClose={() => setDetalleId(null)}>
      <DetalleClase {...{ ui, sb, slot: detalle, pasada: detalle.starts_at < localNow(), apuntar, quitar, asistencia }}
        onAvisar={bs => setAviso({ titulo: 'Avisar por WhatsApp', clave: 'plantilla_clase_aviso', destinatarios: destinatarios(detalle, bs), onEnviado: async (ids, f) => { setAviso(null); ok(`${ids.length} avisado${ids.length !== 1 ? 's' : ''}${f ? ` · ${f} no llegaron` : ''}`) } })}
        onCancelar={() => setCancelar(detalle)}
        onBorrar={() => setConfirmar({ tipo: 'clase', obj: detalle })}
        onReabrir={() => reabrirClase(detalle)} />
    </Modal>}

    {cancelar && !aviso && <Modal title="¿Cancelar esta clase?" onClose={() => setCancelar(null)}>
      <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16, lineHeight: 1.6 }}>
        Clase del <strong>{diaLegible(cancelar.starts_at)} a las {hhmm(cancelar.starts_at)}</strong>.
        {activas(cancelar.bookings).length > 0 ? <> Se cancelan las <strong>{activas(cancelar.bookings).length} reservas</strong>. ¿Les avisamos por WhatsApp?</> : ' No tiene apuntados.'}
      </p>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <Btn variant="ghost" onClick={() => setCancelar(null)} style={{ flex: 1 }}>Volver</Btn>
        <Btn variant="danger" onClick={() => cancelarClase(cancelar)} style={{ flex: 1 }}>Cancelar{activas(cancelar.bookings).length ? ' sin avisar' : ''}</Btn>
        {activas(cancelar.bookings).length > 0 && <Btn onClick={() => setAviso({
          titulo: 'Aviso de cancelación', clave: 'plantilla_clase_cancelacion', textoBoton: 'Cancelar y avisar',
          destinatarios: destinatarios(cancelar, activas(cancelar.bookings)),
          onEnviado: ids => cancelarClase(cancelar, ids),
        })} style={{ flex: '1 1 100%' }}>Cancelar y avisar</Btn>}
      </div>
    </Modal>}

    {aviso && <AvisoModal ui={ui} sb={sb} botFetch={botFetch} {...aviso} onClose={() => setAviso(null)} />}

    {confirmar && <Modal title={confirmar.tipo === 'tpl' ? '¿Borrar la plantilla?' : '¿Borrar la clase?'} onClose={() => setConfirmar(null)}>
      <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
        {confirmar.tipo === 'tpl' ? 'Las clases que ya creó se quedan; solo deja de generar nuevas.' : 'Desaparece del todo. Solo se puede si nunca tuvo reservas.'}
      </p>
      <div style={{ display: 'flex', gap: 10 }}>
        <Btn variant="ghost" onClick={() => setConfirmar(null)} style={{ flex: 1 }}>Volver</Btn>
        <Btn variant="danger" onClick={() => confirmar.tipo === 'tpl' ? borrarTpl(confirmar.obj) : borrarClase(confirmar.obj)} style={{ flex: 1 }}>Borrar</Btn>
      </div>
    </Modal>}

    {tplModal && <Modal title={tplModal?.id ? 'Editar plantilla' : 'Nueva plantilla'} onClose={() => setTplModal(null)}>
      <Sel label="Servicio" value={tplForm.service_id} onChange={e => setTplForm(f => ({ ...f, service_id: e.target.value }))} options={[['', 'Seleccionar…'], ...services.map(s => [s.id, s.name])]} />
      <Sel label="Monitor" value={tplForm.professional_id} onChange={e => setTplForm(f => ({ ...f, professional_id: e.target.value }))} options={[['', 'Seleccionar…'], ...profs.map(p => [p.id, p.name])]} />
      <Sel label="Día de la semana" value={String(tplForm.day_of_week)} onChange={e => setTplForm(f => ({ ...f, day_of_week: Number(e.target.value) }))} options={[1, 2, 3, 4, 5, 6, 0].map(i => [String(i), DAYS[i]])} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
        <Sel label="Inicio" value={tplForm.start_time} onChange={e => setTplForm(f => ({ ...f, start_time: e.target.value }))} options={QHOURS.map(h => [h, h])} />
        <Sel label="Fin" value={tplForm.end_time} onChange={e => setTplForm(f => ({ ...f, end_time: e.target.value }))} options={QHOURS.map(h => [h, h])} />
        <Inp label="Plazas" type="number" min={1} value={tplForm.max_bookings} onChange={e => setTplForm(f => ({ ...f, max_bookings: e.target.value }))} />
      </div>
      <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, margin: '4px 0 12px' }}>
        <Toggle on={tplForm.is_active} onChange={v => setTplForm(f => ({ ...f, is_active: v }))} /> Plantilla activa
      </label>
      {tplModal?.id && <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, marginBottom: 16 }}>
        <input type="checkbox" checked={propagar} onChange={e => setPropagar(e.target.checked)} />
        Aplicar hora y plazas a sus clases futuras (las que ya tienen apuntados conservan el día)
      </label>}
      <div style={{ display: 'flex', gap: 10 }}>
        <Btn variant="ghost" onClick={() => setTplModal(null)} style={{ flex: 1 }}>Cancelar</Btn>
        <Btn onClick={guardarTpl} disabled={saving} style={{ flex: 1 }}>{saving ? 'Guardando…' : 'Guardar'}</Btn>
      </div>
    </Modal>}

    {slotModal && <Modal title={slotModal === 'new' ? 'Clase suelta' : 'Editar clase'} onClose={() => setSlotModal(null)}>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>{slotModal === 'new' ? 'Una clase que no se repite. Para las semanales, usa una plantilla.' : 'Solo cambia esta clase, no la plantilla.'}</p>
      {slotModal === 'new' && <>
        <Sel label="Servicio" value={slotForm.service_id} onChange={e => setSlotForm(f => ({ ...f, service_id: e.target.value }))} options={[['', 'Seleccionar…'], ...services.map(s => [s.id, s.name])]} />
        <Sel label="Monitor" value={slotForm.professional_id} onChange={e => setSlotForm(f => ({ ...f, professional_id: e.target.value }))} options={[['', 'Seleccionar…'], ...profs.map(p => [p.id, p.name])]} />
      </>}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 10 }}>
        <Inp label="Fecha" type="date" value={slotForm.date} onChange={e => setSlotForm(f => ({ ...f, date: e.target.value }))} />
        <Sel label="Inicio" value={slotForm.start_time} onChange={e => setSlotForm(f => ({ ...f, start_time: e.target.value }))} options={QHOURS.map(h => [h, h])} />
        <Sel label="Fin" value={slotForm.end_time} onChange={e => setSlotForm(f => ({ ...f, end_time: e.target.value }))} options={QHOURS.map(h => [h, h])} />
      </div>
      <Inp label="Plazas" type="number" min={1} value={slotForm.max_bookings} onChange={e => setSlotForm(f => ({ ...f, max_bookings: e.target.value }))} />
      {slotModal === 'new' && <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, margin: '4px 0 12px' }}>
        <Toggle on={!!slotForm.publicar} onChange={v => setSlotForm(f => ({ ...f, publicar: v }))} /> Publicar ya (se puede reservar)
      </label>}
      <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
        <Btn variant="ghost" onClick={() => setSlotModal(null)} style={{ flex: 1 }}>Cancelar</Btn>
        <Btn onClick={guardarClase} disabled={saving} style={{ flex: 1 }}>{saving ? 'Guardando…' : 'Guardar'}</Btn>
      </div>
    </Modal>}
  </>
}

function Aviso({ children }) {
  return <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, padding: '10px 14px', marginBottom: 10, fontSize: 13, color: '#92400e', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
    <span style={{ flex: 1, minWidth: 220 }}>⚠ {children}</span>
  </div>
}

const VIA = { app: 'App', whatsapp: 'WhatsApp', secretary: 'Recepción' }

function DetalleClase({ ui, sb, slot, pasada, apuntar, quitar, asistencia, onAvisar, onCancelar, onBorrar, onReabrir }) {
  const { Btn, Em } = ui
  const ap = activas(slot.bookings)
  const llena = ap.length >= slot.max_bookings
  const sinHistorial = (slot.bookings || []).length === 0
  const pendientes = ap.filter(b => b.status === 'confirmed').map(b => b.id)
  return <>
    <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>
      {slot.professionals?.name || 'Sin monitor'} · {ap.length}/{slot.max_bookings} plazas{slot.cancelled_at ? ' · CANCELADA' : ''}
    </div>

    {!slot.cancelled_at && !pasada && !llena && <div style={{ marginBottom: 12 }}>
      <BuscadorPaciente sb={sb} excluir={ap.map(b => b.patient_id)} placeholder="Apuntar a alguien: nombre o teléfono…" onElegir={p => apuntar(slot, p)} />
    </div>}

    {ap.length === 0 ? <Em icon="👥" title="Nadie apuntado" /> : <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
      {ap.map(b => <div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', background: 'var(--cream)', borderRadius: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600 }}>{b.patients?.full_name || '—'}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{b.patients?.phone || 'sin teléfono'} · {VIA[b.booked_via] || b.booked_via}</div>
        </div>
        {pasada ? <div style={{ display: 'flex', gap: 4 }}>
          <Btn variant={b.status === 'completed' ? 'primary' : 'ghost'} style={{ padding: '4px 8px', fontSize: 11 }} onClick={() => asistencia([b.id], 'completed')}>Vino</Btn>
          <Btn variant={b.status === 'no_show' ? 'danger' : 'ghost'} style={{ padding: '4px 8px', fontSize: 11 }} onClick={() => asistencia([b.id], 'no_show')}>No vino</Btn>
        </div> : !slot.cancelled_at && <Btn variant="ghost" style={{ padding: '4px 8px', fontSize: 11 }} onClick={() => quitar(b)}>Quitar</Btn>}
      </div>)}
    </div>}

    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {pasada && pendientes.length > 0 && <Btn onClick={() => asistencia(pendientes, 'completed')} style={{ flex: 1 }}>Vinieron todos ({pendientes.length})</Btn>}
      {!pasada && !slot.cancelled_at && ap.length > 0 && <Btn variant="secondary" onClick={() => onAvisar(ap)} style={{ flex: 1 }}>📲 Avisar a los apuntados</Btn>}
      {!pasada && !slot.cancelled_at && <Btn variant="danger" onClick={onCancelar} style={{ flex: 1 }}>Cancelar clase</Btn>}
      {slot.cancelled_at && !pasada && <Btn variant="ghost" onClick={onReabrir} style={{ flex: 1 }}>Reabrir</Btn>}
      {sinHistorial && <Btn variant="danger" onClick={onBorrar} style={{ flex: '0 0 auto' }}>🗑</Btn>}
    </div>
  </>
}
