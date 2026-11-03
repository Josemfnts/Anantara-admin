// Belleza — jornadas (decisión de Josema, 03/11/2026): se fija un día con una franja
// (viene la profesional o el aparato) y se va juntando gente.
//
//   Lista de espera  = solicitudes sin jornada (desde el bot, la app o Marta).
//   Jornada          = beauty_sessions: día, franja, profesional, título, estado.
//   En la jornada    = beauty_requests con session_id. Cada una con su servicio
//                      (duración), su hora y si ya se le avisó (sent_at).
//
// Lo que resuelve para Marta:
// - Ver de un vistazo cuánta gente espera cada servicio y desde cuándo.
// - Llevar gente de la lista a una jornada, o apuntar a alguien a mano.
// - «Repartir horas»: pone las horas seguidas según la duración de cada servicio,
//   sin mover a quien ya tiene hora; marca solapes y lo que no cabe en la franja.
// - Avisar por WhatsApp solo a quien falta (si cambia la hora, vuelve a faltar).
// - Cancelar una jornada avisa a quien ya lo sabía y devuelve a todos a la lista.
// - Después de la jornada: pasar lista (vino / no vino) y cerrarla.
//
// Props: sb, botFetch, ui ({Btn,Inp,Sel,Modal,Sp,Em,Bg,Toggle,Toast}), onNav.

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { repartirHoras, ocupacion, conflictos, aMin, aHora, diaLegible, nombreCorto, PASO_MIN } from '../lib/jornadas.js'
import { ymd } from '../lib/clases.js'
import { AvisoModal, BuscadorPaciente } from './AvisosWhatsApp.jsx'

const pad = n => String(n).padStart(2, '0')
const QHOURS = Array.from({ length: (22 - 7) * 4 + 1 }, (_, i) => `${pad(7 + Math.floor(i / 4))}:${pad((i % 4) * 15)}`)
const hm = t => (t ? String(t).slice(0, 5) : '')
const diasDesde = iso => Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86400000))
const Mayus = s => s.charAt(0).toUpperCase() + s.slice(1)
const EN_JORNADA = ['waiting', 'confirmed', 'done', 'no_show']
const SEL_REQ = 'id,status,session_time,sent_at,created_at,notes,service_id,patient_id,session_id,patients(id,full_name,phone),services(id,name,duration_minutes)'
const EMPTY_J = { session_date: '', start_time: '10:00', end_time: '14:00', title: '', professional_id: '', notes: '', is_published: false, status: 'open' }

export function BellezaPage({ sb, botFetch, ui, onNav }) {
  const { Btn, Inp, Sel, Modal, Sp, Em, Bg, Toggle, Toast } = ui
  const [tab, setTab] = useState('jornadas')
  const [jornadas, setJornadas] = useState([])
  const [historial, setHistorial] = useState([])
  const [espera, setEspera] = useState([])
  const [services, setServices] = useState([])
  const [profs, setProfs] = useState([])
  const [loading, setLoading] = useState(true)
  const [errorCarga, setErrorCarga] = useState('')
  const [toast, setToast] = useState(null)
  const [saving, setSaving] = useState(false)
  const [jModal, setJModal] = useState(null)
  const [jForm, setJForm] = useState(EMPTY_J)
  const [detalleId, setDetalleId] = useState(null)
  const [elegidos, setElegidos] = useState(new Set())
  const [aviso, setAviso] = useState(null)
  const [confirmar, setConfirmar] = useState(null)
  const ok = msg => setToast({ msg, type: 'ok' })
  const fallo = msg => setToast({ msg, type: 'error' })

  const load = useCallback(async () => {
    setLoading(true)
    const hoy = ymd(new Date())
    const [svc, ps, js, hs, es] = await Promise.all([
      sb.from('services').select('id,name,duration_minutes,price,is_active').eq('section', 'beauty').order('name'),
      sb.from('professionals').select('id,name').eq('section', 'beauty').eq('is_active', true).order('name'),
      sb.from('beauty_sessions').select(`*,professionals(name),beauty_requests(${SEL_REQ})`).in('status', ['open', 'closed']).order('session_date').order('start_time'),
      sb.from('beauty_sessions').select('*,professionals(name),beauty_requests(id,status)').in('status', ['done', 'cancelled']).order('session_date', { ascending: false }).limit(30),
      sb.from('beauty_requests').select(SEL_REQ).is('session_id', null).eq('status', 'waiting').order('created_at'),
    ])
    const err = [svc, js, es].find(r => r.error)?.error
    setErrorCarga(err ? err.message : '')
    setServices(svc.data || []); setProfs(ps.data || [])
    setJornadas((js.data || []).map(j => ({ ...j, pasada: j.session_date < hoy, reqs: (j.beauty_requests || []).filter(r => EN_JORNADA.includes(r.status)) })))
    setHistorial(hs.data || [])
    setEspera(es.data || [])
    setLoading(false)
  }, [sb])
  useEffect(() => { load() }, [load])

  const detalle = useMemo(() => jornadas.find(j => j.id === detalleId) || null, [jornadas, detalleId])
  const porServicio = useMemo(() => {
    const g = {}
    for (const r of espera) (g[r.service_id] ||= { service: r.services, reqs: [] }).reqs.push(r)
    return Object.values(g).sort((a, b) => b.reqs.length - a.reqs.length)
  }, [espera])
  const abiertas = jornadas.filter(j => !j.pasada)
  const porCerrar = jornadas.filter(j => j.pasada)

  // ── Jornadas ──────────────────────────────────────────────────────────────
  const abrirJornada = (j, conEspera = null) => {
    setJForm(j ? { session_date: j.session_date, start_time: hm(j.start_time), end_time: hm(j.end_time), title: j.title || '', professional_id: j.professional_id || '', notes: j.notes || '', is_published: j.is_published, status: j.status }
      : { ...EMPTY_J, title: conEspera ? [...new Set(conEspera.map(r => r.services?.name))].join(' + ') : '' })
    setJModal(j || { nueva: true, conEspera })
  }

  const guardarJornada = async () => {
    const f = jForm
    if (!f.session_date) { fallo('Pon la fecha'); return }
    if (f.end_time <= f.start_time) { fallo('La hora de fin tiene que ser posterior a la de inicio'); return }
    setSaving(true)
    const payload = { session_date: f.session_date, start_time: f.start_time + ':00', end_time: f.end_time + ':00', title: f.title.trim() || null, professional_id: f.professional_id || null, notes: f.notes.trim() || null, is_published: f.is_published, status: f.status }
    let id = jModal.id, error
    if (jModal.nueva) {
      const r = await sb.from('beauty_sessions').insert(payload).select('id').single()
      error = r.error; id = r.data?.id
    } else {
      error = (await sb.from('beauty_sessions').update(payload).eq('id', id)).error
      // Si cambia el día o la franja, las horas dadas pueden dejar de valer: se
      // conservan, pero quien ya estaba avisado vuelve a «pendiente de avisar».
      const cambio = f.session_date !== jModal.session_date || payload.start_time.slice(0, 5) !== hm(jModal.start_time) || payload.end_time.slice(0, 5) !== hm(jModal.end_time)
      if (!error && cambio) await sb.from('beauty_requests').update({ sent_at: null, session_date: f.session_date }).eq('session_id', id).not('sent_at', 'is', null)
    }
    if (!error && jModal.conEspera?.length) {
      error = (await sb.from('beauty_requests').update({ session_id: id, session_date: f.session_date }).in('id', jModal.conEspera.map(r => r.id))).error
    }
    setSaving(false)
    if (error) { fallo('Error: ' + error.message); return }
    setJModal(null); setElegidos(new Set())
    ok(jModal.nueva ? `Jornada creada${jModal.conEspera?.length ? ` con ${jModal.conEspera.length} persona${jModal.conEspera.length !== 1 ? 's' : ''}` : ''}` : 'Jornada guardada')
    if (jModal.nueva) { setTab('jornadas'); setDetalleId(id) }
    load()
  }

  const cancelarJornada = async (j, avisados = null) => {
    const r1 = await sb.from('beauty_requests').update({ session_id: null, session_time: null, session_date: null, sent_at: null, status: 'waiting' })
      .eq('session_id', j.id).in('status', ['waiting', 'confirmed'])
    const r2 = await sb.from('beauty_sessions').update({ status: 'cancelled' }).eq('id', j.id)
    setAviso(null); setConfirmar(null); setDetalleId(null)
    if (r1.error || r2.error) { fallo('Error: ' + (r1.error || r2.error).message); load(); return }
    ok(`Jornada cancelada · ${j.reqs.length} vuelven a la lista de espera${avisados ? ` · ${avisados.length} avisada${avisados.length !== 1 ? 's' : ''}` : ''}`)
    load()
  }

  const cerrarJornada = async j => {
    const sinMarcar = j.reqs.filter(r => r.status === 'waiting' || r.status === 'confirmed').map(r => r.id)
    if (sinMarcar.length) await sb.from('beauty_requests').update({ status: 'done' }).in('id', sinMarcar)
    const { error } = await sb.from('beauty_sessions').update({ status: 'done' }).eq('id', j.id)
    setDetalleId(null)
    if (error) { fallo('Error: ' + error.message); return }
    ok('Jornada cerrada'); load()
  }

  // ── Personas ──────────────────────────────────────────────────────────────
  const ponerHora = async (j, r, hora) => {
    const cambios = { session_time: hora ? hora + ':00' : null, status: hora ? 'confirmed' : 'waiting', session_date: j.session_date }
    if (r.sent_at && hm(r.session_time) !== hora) cambios.sent_at = null
    const { error } = await sb.from('beauty_requests').update(cambios).eq('id', r.id)
    if (error) { fallo('Error al guardar la hora: ' + error.message); return }
    load()
  }

  const repartir = async j => {
    const items = ordenar(j.reqs).filter(r => r.status === 'waiting' || r.status === 'confirmed')
      .map(r => ({ id: r.id, duracion: r.services?.duration_minutes || 60, hora: hm(r.session_time) || null }))
    const { horas, sinHueco } = repartirHoras(j, items)
    const ids = Object.keys(horas)
    if (!ids.length) { sinHueco.length ? fallo(`No cabe nadie más en la franja (${sinHueco.length} sin hora)`) : ok('Todos tienen ya hora'); return }
    setSaving(true)
    const errores = []
    for (const id of ids) {
      const { error } = await sb.from('beauty_requests').update({ session_time: horas[id] + ':00', status: 'confirmed', session_date: j.session_date }).eq('id', id)
      if (error) errores.push(error.message)
    }
    setSaving(false)
    if (errores.length) fallo('Error: ' + errores[0])
    else ok(`${ids.length} hora${ids.length !== 1 ? 's' : ''} puesta${ids.length !== 1 ? 's' : ''}${sinHueco.length ? ` · ${sinHueco.length} no caben en la franja` : ''}`)
    load()
  }

  const traerDeEspera = async (j, ids) => {
    const { error } = await sb.from('beauty_requests').update({ session_id: j.id, session_date: j.session_date }).in('id', ids)
    if (error) { fallo('Error: ' + error.message); return }
    ok(`${ids.length} añadida${ids.length !== 1 ? 's' : ''} a la jornada`); load()
  }

  const apuntarAMano = async (j, paciente, serviceId) => {
    const { error } = await sb.from('beauty_requests').insert({ patient_id: paciente.id, service_id: serviceId, session_id: j.id, session_date: j.session_date, status: 'waiting' })
    if (error) { fallo(error.code === '23505' ? 'Ya está en la lista de espera de ese servicio: añádela desde ahí' : 'Error: ' + error.message); return }
    ok(`${paciente.full_name} apuntada a la jornada`); load()
  }

  const devolverAEspera = async r => {
    const { error } = await sb.from('beauty_requests').update({ session_id: null, session_time: null, session_date: null, sent_at: null, status: 'waiting' }).eq('id', r.id)
    if (error) { fallo(error.code === '23505' ? 'Ya tiene otra solicitud en espera de ese servicio' : 'Error: ' + error.message); return }
    ok('Vuelve a la lista de espera'); load()
  }

  const anular = async r => {
    setConfirmar(null)
    const { error } = await sb.from('beauty_requests').update({ status: 'cancelled' }).eq('id', r.id)
    if (error) { fallo('Error: ' + error.message); return }
    ok('Solicitud anulada'); load()
  }

  const asistencia = async (r, status) => {
    const { error } = await sb.from('beauty_requests').update({ status }).eq('id', r.id)
    if (error) { fallo('Error: ' + error.message); return }
    load()
  }

  const destinatarios = (j, reqs) => reqs.map(r => ({
    id: r.id, nombre: nombreCorto(r.patients?.full_name), nombreCompleto: r.patients?.full_name, phone: r.patients?.phone,
    datos: { servicio: r.services?.name || 'tu tratamiento', dia: diaLegible(j.session_date), hora: hm(r.session_time) },
  }))

  const avisarPendientes = j => {
    const pend = ordenar(j.reqs).filter(r => r.status === 'confirmed' && r.session_time && !r.sent_at)
    setAviso({
      titulo: `Avisar de su hora · ${diaLegible(j.session_date)}`, clave: 'plantilla_belleza_aviso', destinatarios: destinatarios(j, pend),
      onEnviado: async (ids, fallidos) => {
        if (ids.length) await sb.from('beauty_requests').update({ sent_at: new Date().toISOString() }).in('id', ids)
        setAviso(null)
        fallidos ? fallo(`${ids.length} avisadas · ${fallidos} no llegaron (siguen pendientes)`) : ok(`${ids.length} avisada${ids.length !== 1 ? 's' : ''}`)
        load()
      },
    })
  }

  const pedirCancelar = j => {
    const avisadas = j.reqs.filter(r => r.sent_at && (r.status === 'waiting' || r.status === 'confirmed'))
    if (!avisadas.length) { setConfirmar({ tipo: 'jornada', obj: j }); return }
    setAviso({
      titulo: 'Cancelar jornada y avisar', clave: 'plantilla_belleza_cancelacion', textoBoton: 'Cancelar jornada y avisar',
      destinatarios: destinatarios(j, avisadas),
      onEnviado: ids => cancelarJornada(j, ids),
    })
  }

  if (loading && !jornadas.length && !espera.length) return <Sp />

  return <>
    {toast && <Toast msg={toast.msg} type={toast.type} onDone={() => setToast(null)} />}
    <div className="section-header">
      <span className="section-title">Belleza</span>
      <div className="tab-pills" style={{ margin: 0 }}>
        {[['jornadas', `Jornadas${abiertas.length ? ` (${abiertas.length})` : ''}`], ['espera', `Lista de espera${espera.length ? ` (${espera.length})` : ''}`], ['historial', 'Historial']].map(([id, l]) =>
          <button key={id} className={`tab-pill ${tab === id ? 'active' : ''}`} onClick={() => setTab(id)}>{l}</button>)}
      </div>
    </div>
    {errorCarga && <div style={{ background: 'var(--error-light)', color: 'var(--error)', borderRadius: 10, padding: '10px 14px', marginBottom: 10, fontSize: 13 }}>
      No se pudieron cargar las jornadas ({errorCarga}). Si dice que falta una tabla o columna, falta aplicar la migración 0032.
    </div>}
    {services.filter(s => s.is_active).length === 0 && <div style={{ fontSize: 13, color: '#92400e', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, padding: '10px 14px', marginBottom: 10 }}>
      ⚠ No hay servicios de belleza activos. Créalos en <strong>Servicios</strong> (sección Belleza) con su duración: es lo que usa «Repartir horas».
      {onNav && <Btn variant="ghost" style={{ padding: '4px 10px', fontSize: 12, marginLeft: 8 }} onClick={() => onNav('servicios')}>Ir a Servicios</Btn>}
    </div>}

    {tab === 'jornadas' && <>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <Btn onClick={() => abrirJornada(null)}>+ Nueva jornada</Btn>
      </div>
      {porCerrar.length > 0 && <>
        <div style={tituloGrupo}>Por cerrar · pasa lista</div>
        {porCerrar.map(j => <TarjetaJornada key={j.id} j={j} ui={ui} onClick={() => setDetalleId(j.id)} />)}
      </>}
      {abiertas.length === 0 && porCerrar.length === 0
        ? <Em icon="✨" title="Sin jornadas" sub={espera.length ? `Hay ${espera.length} persona${espera.length !== 1 ? 's' : ''} en la lista de espera: crea una jornada desde ahí.` : 'Crea una jornada cuando sepas qué día viene la profesional o el aparato.'} />
        : abiertas.length > 0 && <>
          {porCerrar.length > 0 && <div style={tituloGrupo}>Próximas</div>}
          {abiertas.map(j => <TarjetaJornada key={j.id} j={j} ui={ui} onClick={() => setDetalleId(j.id)} />)}
        </>}
    </>}

    {tab === 'espera' && <>
      {elegidos.size > 0 && <div className="card" style={{ position: 'sticky', top: 8, zIndex: 3, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', padding: '10px 14px', marginBottom: 12 }}>
        <strong style={{ fontSize: 13, flex: 1 }}>{elegidos.size} elegida{elegidos.size !== 1 ? 's' : ''}</strong>
        {abiertas.length > 0 && <select className="field-input" style={{ width: 'auto' }} value="" onChange={e => { const j = abiertas.find(x => x.id === e.target.value); if (j) { traerDeEspera(j, [...elegidos]); setElegidos(new Set()) } }}>
          <option value="">Llevar a jornada…</option>
          {abiertas.map(j => <option key={j.id} value={j.id}>{Mayus(diaLegible(j.session_date))}{j.title ? ` · ${j.title}` : ''}</option>)}
        </select>}
        <Btn onClick={() => abrirJornada(null, espera.filter(r => elegidos.has(r.id)))}>Nueva jornada con ellas</Btn>
        <Btn variant="ghost" onClick={() => setElegidos(new Set())}>Quitar selección</Btn>
      </div>}
      {porServicio.length === 0
        ? <Em icon="✨" title="Nadie en espera" sub="Aquí entra quien pide un servicio de belleza por WhatsApp o desde la app." />
        : porServicio.map(g => {
          const todos = g.reqs.every(r => elegidos.has(r.id))
          return <div key={g.service?.id} className="card" style={{ padding: '14px 18px', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 10 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                <input type="checkbox" checked={todos} onChange={e => setElegidos(prev => { const s = new Set(prev); g.reqs.forEach(r => e.target.checked ? s.add(r.id) : s.delete(r.id)); return s })} />
                <span>
                  <span style={{ fontWeight: 700, fontSize: 15 }}>{g.service?.name}</span>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 8 }}>{g.reqs.length} esperando · {g.service?.duration_minutes || 60} min</span>
                </span>
              </label>
              <Btn variant="ghost" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => abrirJornada(null, g.reqs)}>Jornada con todas</Btn>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {g.reqs.map(r => <label key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: 'var(--cream)', borderRadius: 8, cursor: 'pointer' }}>
                <input type="checkbox" checked={elegidos.has(r.id)} onChange={e => setElegidos(prev => { const s = new Set(prev); e.target.checked ? s.add(r.id) : s.delete(r.id); return s })} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{r.patients?.full_name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{r.patients?.phone} · espera desde hace {diasDesde(r.created_at)} día{diasDesde(r.created_at) !== 1 ? 's' : ''}</div>
                </div>
                <Btn variant="ghost" style={{ padding: '4px 10px', fontSize: 11 }} onClick={e => { e.preventDefault(); setConfirmar({ tipo: 'anular', obj: r }) }}>Anular</Btn>
              </label>)}
            </div>
          </div>
        })}
    </>}

    {tab === 'historial' && (historial.length === 0
      ? <Em icon="📅" title="Sin jornadas pasadas" />
      : <div className="card" style={{ overflow: 'hidden' }}>
        {historial.map(j => {
          const reqs = j.beauty_requests || []
          const vino = reqs.filter(r => r.status === 'done').length, no = reqs.filter(r => r.status === 'no_show').length
          return <div key={j.id} className="slot-card">
            <div className="slot-info">
              <div className="slot-title">{Mayus(diaLegible(j.session_date))}{j.title ? ` · ${j.title}` : ''}</div>
              <div className="slot-meta">{hm(j.start_time)}–{hm(j.end_time)}{j.professionals?.name ? ` · ${j.professionals.name}` : ''}{j.status === 'done' ? ` · ${vino} vinieron${no ? ` · ${no} no` : ''}` : ''}</div>
            </div>
            <Bg variant={j.status === 'done' ? 'green' : 'red'}>{j.status === 'done' ? 'Hecha' : 'Cancelada'}</Bg>
          </div>
        })}
      </div>)}

    {detalle && <Modal title={`${Mayus(diaLegible(detalle.session_date))}${detalle.title ? ` · ${detalle.title}` : ''}`} onClose={() => setDetalleId(null)}>
      <DetalleJornada {...{ ui, sb, j: detalle, espera, services, saving }}
        onEditar={() => abrirJornada(detalle)} onRepartir={() => repartir(detalle)} onHora={(r, h) => ponerHora(detalle, r, h)}
        onAvisar={() => avisarPendientes(detalle)} onTraer={ids => traerDeEspera(detalle, ids)} onApuntar={(p, s) => apuntarAMano(detalle, p, s)}
        onDevolver={devolverAEspera} onAnular={r => setConfirmar({ tipo: 'anular', obj: r })} onAsistencia={asistencia}
        onCancelar={() => pedirCancelar(detalle)} onCerrar={() => cerrarJornada(detalle)} />
    </Modal>}

    {aviso && <AvisoModal ui={ui} sb={sb} botFetch={botFetch} {...aviso} onClose={() => setAviso(null)} />}

    {confirmar && <Modal title={confirmar.tipo === 'jornada' ? '¿Cancelar la jornada?' : '¿Anular la solicitud?'} onClose={() => setConfirmar(null)}>
      <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16, lineHeight: 1.6 }}>
        {confirmar.tipo === 'jornada'
          ? `Nadie estaba avisado todavía. Las ${confirmar.obj.reqs.length} personas vuelven a la lista de espera.`
          : `${confirmar.obj.patients?.full_name} deja de esperar ${confirmar.obj.services?.name}. No se le envía nada.`}
      </p>
      <div style={{ display: 'flex', gap: 10 }}>
        <Btn variant="ghost" onClick={() => setConfirmar(null)} style={{ flex: 1 }}>Volver</Btn>
        <Btn variant="danger" onClick={() => confirmar.tipo === 'jornada' ? cancelarJornada(confirmar.obj) : anular(confirmar.obj)} style={{ flex: 1 }}>{confirmar.tipo === 'jornada' ? 'Cancelar jornada' : 'Anular'}</Btn>
      </div>
    </Modal>}

    {jModal && <Modal title={jModal.nueva ? 'Nueva jornada' : 'Editar jornada'} onClose={() => setJModal(null)}>
      {jModal.conEspera?.length > 0 && <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>Se añaden {jModal.conEspera.length} persona{jModal.conEspera.length !== 1 ? 's' : ''} de la lista de espera.</p>}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 10 }}>
        <Inp label="Fecha" type="date" value={jForm.session_date} onChange={e => setJForm(f => ({ ...f, session_date: e.target.value }))} />
        <Sel label="Desde" value={jForm.start_time} onChange={e => setJForm(f => ({ ...f, start_time: e.target.value }))} options={QHOURS.map(h => [h, h])} />
        <Sel label="Hasta" value={jForm.end_time} onChange={e => setJForm(f => ({ ...f, end_time: e.target.value }))} options={QHOURS.map(h => [h, h])} />
      </div>
      <Inp label="Título (lo que se hace ese día)" value={jForm.title} placeholder="p. ej. Láser" onChange={e => setJForm(f => ({ ...f, title: e.target.value }))} />
      <Sel label="Profesional" value={jForm.professional_id} onChange={e => setJForm(f => ({ ...f, professional_id: e.target.value }))} options={[['', profs.length ? 'Sin asignar' : 'No hay profesionales de belleza dados de alta'], ...profs.map(p => [p.id, p.name])]} />
      <Inp label="Notas internas" value={jForm.notes} onChange={e => setJForm(f => ({ ...f, notes: e.target.value }))} />
      <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, margin: '4px 0 10px' }}>
        <Toggle on={jForm.is_published} onChange={v => setJForm(f => ({ ...f, is_published: v }))} /> Visible en la app (la gente puede apuntarse sola)
      </label>
      <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, marginBottom: 16 }}>
        <Toggle on={jForm.status === 'closed'} onChange={v => setJForm(f => ({ ...f, status: v ? 'closed' : 'open' }))} /> Completa (no se apunta nadie más desde la app)
      </label>
      <div style={{ display: 'flex', gap: 10 }}>
        <Btn variant="ghost" onClick={() => setJModal(null)} style={{ flex: 1 }}>Volver</Btn>
        <Btn onClick={guardarJornada} disabled={saving} style={{ flex: 1 }}>{saving ? 'Guardando…' : 'Guardar'}</Btn>
      </div>
    </Modal>}
  </>
}

const tituloGrupo = { fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.04em', margin: '6px 2px 8px' }

// Primero los que tienen hora (por hora), luego los que no (por antigüedad).
function ordenar(reqs) {
  return [...reqs].sort((a, b) => {
    if (a.session_time && b.session_time) return a.session_time < b.session_time ? -1 : 1
    if (a.session_time) return -1
    if (b.session_time) return 1
    return a.created_at < b.created_at ? -1 : 1
  })
}

function resumen(j) {
  const vivos = j.reqs.filter(r => r.status === 'waiting' || r.status === 'confirmed')
  const items = vivos.map(r => ({ id: r.id, duracion: r.services?.duration_minutes || 60, hora: hm(r.session_time) || null }))
  return {
    vivos, items,
    occ: ocupacion(j, items),
    malos: conflictos(j, items),
    sinHora: vivos.filter(r => !r.session_time).length,
    pendientes: vivos.filter(r => r.session_time && !r.sent_at).length,
  }
}

function TarjetaJornada({ j, ui, onClick }) {
  const { Bg } = ui
  const { vivos, occ, malos, sinHora, pendientes } = resumen(j)
  const pct = occ.total ? Math.min(100, Math.round(occ.usados / occ.total * 100)) : 0
  const sinMarcar = j.pasada ? j.reqs.filter(r => r.status === 'waiting' || r.status === 'confirmed').length : 0
  return <div className="card interactive" onClick={onClick} style={{ padding: '14px 18px', marginBottom: 10 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 15 }}>{Mayus(diaLegible(j.session_date))}{j.title ? ` · ${j.title}` : ''}</div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
          {hm(j.start_time)}–{hm(j.end_time)}{j.professionals?.name ? ` · ${j.professionals.name}` : ''} · {j.pasada ? j.reqs.length : vivos.length} persona{(j.pasada ? j.reqs.length : vivos.length) !== 1 ? 's' : ''}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
        {j.pasada && sinMarcar > 0 && <Bg variant="gold">Pasar lista</Bg>}
        {!j.pasada && malos.size > 0 && <Bg variant="red">Solapes</Bg>}
        {!j.pasada && sinHora > 0 && <Bg variant="gold">{sinHora} sin hora</Bg>}
        {!j.pasada && pendientes > 0 && <Bg variant="purple">{pendientes} sin avisar</Bg>}
        {j.status === 'closed' && <Bg variant="gray">Completa</Bg>}
        {j.is_published && <Bg variant="blue">En la app</Bg>}
      </div>
    </div>
    {!j.pasada && <>
      <div className="slot-bar" style={{ marginTop: 10 }}><div className="slot-bar-fill" style={{ width: `${pct}%`, background: occ.pasa ? 'var(--error)' : undefined }} /></div>
      <div style={{ fontSize: 11, color: occ.pasa ? 'var(--error)' : 'var(--text-muted)', marginTop: 4 }}>
        {occ.pasa ? `Se pasa ${occ.usados - occ.total} min de la franja` : `Quedan ${Math.floor(occ.libres / 60)} h ${occ.libres % 60} min libres`}
      </div>
    </>}
  </div>
}

function DetalleJornada({ ui, sb, j, espera, services, saving, onEditar, onRepartir, onHora, onAvisar, onTraer, onApuntar, onDevolver, onAnular, onAsistencia, onCancelar, onCerrar }) {
  const { Btn, Bg, Em } = ui
  const { occ, malos, sinHora, pendientes } = resumen(j)
  const [traer, setTraer] = useState(false)
  const [marcados, setMarcados] = useState(new Set())
  const [nuevo, setNuevo] = useState(null)
  const [svcNuevo, setSvcNuevo] = useState('')
  const lista = ordenar(j.reqs)
  const ini = aMin(j.start_time), fin = aMin(j.end_time)
  const horas = QHOURS.filter(h => aMin(h) >= ini && aMin(h) < fin && aMin(h) % PASO_MIN === 0)
  const activos = services.filter(s => s.is_active)

  return <>
    <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 6 }}>
      {hm(j.start_time)}–{hm(j.end_time)}{j.professionals?.name ? ` · ${j.professionals.name}` : ''}{j.notes ? ` · ${j.notes}` : ''}
    </div>
    {!j.pasada && <div style={{ fontSize: 12, marginBottom: 12, color: occ.pasa ? 'var(--error)' : 'var(--text-muted)' }}>
      Ocupado {Math.floor(occ.usados / 60)} h {occ.usados % 60} min de {Math.floor(occ.total / 60)} h {occ.total % 60} min
      {malos.size > 0 && <span style={{ color: 'var(--error)' }}> · {malos.size} con la hora pisada o fuera de la franja</span>}
    </div>}

    {lista.length === 0 ? <Em icon="👥" title="Nadie en esta jornada" sub="Añade gente de la lista de espera o apunta a alguien." />
      : <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
        {lista.map(r => {
          const dur = r.services?.duration_minutes || 60
          const h = hm(r.session_time)
          const malo = malos.has(r.id)
          return <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', background: malo ? 'var(--error-light)' : 'var(--cream)', borderRadius: 8, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 150 }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{r.patients?.full_name}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{r.services?.name} · {dur} min · {r.patients?.phone}</div>
            </div>
            {j.pasada ? <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              <span style={{ fontSize: 12, marginRight: 4 }}>{h || '—'}</span>
              <Btn variant={r.status === 'done' ? 'primary' : 'ghost'} style={{ padding: '4px 8px', fontSize: 11 }} onClick={() => onAsistencia(r, 'done')}>Vino</Btn>
              <Btn variant={r.status === 'no_show' ? 'danger' : 'ghost'} style={{ padding: '4px 8px', fontSize: 11 }} onClick={() => onAsistencia(r, 'no_show')}>No vino</Btn>
            </div> : <>
              <select className="field-input" value={h} onChange={e => onHora(r, e.target.value)} style={{ width: 92, padding: '4px 6px', fontSize: 12 }}>
                <option value="">—</option>
                {(h && !horas.includes(h) ? [h, ...horas] : horas).map(x => <option key={x} value={x}>{x}{aMin(x) + dur > fin ? ' ⚠' : ''}</option>)}
              </select>
              {h && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>→ {aHora(aMin(h) + dur)}</span>}
              {r.sent_at ? <Bg variant="green">Avisada</Bg> : h ? <Bg variant="purple">Sin avisar</Bg> : null}
              <Btn variant="ghost" title="Devolver a la lista de espera" style={{ padding: '4px 8px', fontSize: 11 }} onClick={() => onDevolver(r)}>↩</Btn>
              <Btn variant="ghost" title="Anular" style={{ padding: '4px 8px', fontSize: 11 }} onClick={() => onAnular(r)}>✕</Btn>
            </>}
          </div>
        })}
      </div>}

    {!j.pasada && <>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
        <Btn onClick={onRepartir} disabled={saving || sinHora === 0} style={{ flex: 1 }}>⏱ Repartir horas{sinHora ? ` (${sinHora})` : ''}</Btn>
        <Btn variant="secondary" onClick={onAvisar} disabled={pendientes === 0} style={{ flex: 1 }}>📲 Avisar{pendientes ? ` (${pendientes})` : ''}</Btn>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
        <Btn variant="ghost" onClick={() => { setTraer(t => !t); setMarcados(new Set()) }} disabled={espera.length === 0} style={{ flex: 1 }}>+ De la lista de espera ({espera.length})</Btn>
        <Btn variant="ghost" onClick={() => setNuevo(n => n ? null : {})} style={{ flex: 1 }}>+ Apuntar a alguien</Btn>
      </div>
      {traer && <div style={{ border: '1px solid var(--stone)', borderRadius: 10, padding: 10, marginBottom: 10 }}>
        <div style={{ maxHeight: 220, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
          {espera.map(r => <label key={r.id} style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, padding: '4px 6px' }}>
            <input type="checkbox" checked={marcados.has(r.id)} onChange={e => setMarcados(prev => { const s = new Set(prev); e.target.checked ? s.add(r.id) : s.delete(r.id); return s })} />
            <span style={{ flex: 1 }}>{r.patients?.full_name}</span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{r.services?.name} · {diasDesde(r.created_at)} d</span>
          </label>)}
        </div>
        <Btn onClick={() => { onTraer([...marcados]); setTraer(false) }} disabled={marcados.size === 0} style={{ width: '100%', marginTop: 8 }}>Añadir {marcados.size || ''}</Btn>
      </div>}
      {nuevo && <div style={{ border: '1px solid var(--stone)', borderRadius: 10, padding: 10, marginBottom: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {nuevo.paciente
          ? <div style={{ fontSize: 13 }}><strong>{nuevo.paciente.full_name}</strong> · {nuevo.paciente.phone} <button type="button" onClick={() => setNuevo({})} style={{ border: 'none', background: 'none', color: 'var(--terra)', cursor: 'pointer' }}>cambiar</button></div>
          : <BuscadorPaciente sb={sb} excluir={j.reqs.map(r => r.patient_id)} onElegir={p => setNuevo({ paciente: p })} />}
        <select className="field-input" value={svcNuevo} onChange={e => setSvcNuevo(e.target.value)}>
          <option value="">¿Qué servicio?</option>
          {activos.map(s => <option key={s.id} value={s.id}>{s.name} · {s.duration_minutes} min</option>)}
        </select>
        <Btn onClick={() => { onApuntar(nuevo.paciente, svcNuevo); setNuevo(null); setSvcNuevo('') }} disabled={!nuevo.paciente || !svcNuevo}>Apuntar</Btn>
      </div>}
    </>}

    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', borderTop: '1px solid var(--stone)', paddingTop: 12 }}>
      {j.pasada
        ? <Btn onClick={onCerrar} style={{ flex: 1 }}>Cerrar jornada</Btn>
        : <>
          <Btn variant="ghost" onClick={onEditar} style={{ flex: 1 }}>✏️ Editar</Btn>
          <Btn variant="danger" onClick={onCancelar} style={{ flex: 1 }}>Cancelar jornada</Btn>
        </>}
    </div>
    {j.pasada && <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>Al cerrar, quien no esté marcado cuenta como que vino.</p>}
  </>
}
