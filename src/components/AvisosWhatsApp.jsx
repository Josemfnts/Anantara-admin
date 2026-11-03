// Piezas compartidas de Escalada y Belleza.
//
// - usePlantilla: texto de aviso guardado en app_config (Marta lo edita una vez y
//   se queda), con su valor por defecto en lib/jornadas.js.
// - AvisoModal: vista previa de los WhatsApp antes de mandarlos. Marta elige a
//   quién, retoca el texto y envía. Nada sale sin que pulse «Enviar».
// - enviarWhatsApp: POST /send-beauty del bot (envío en lote con pausa anti-baneo).
//   El teléfono va con el 34 delante: la base guarda 9 cifras y el endpoint no lo
//   añade (antes los mensajes de belleza no llegaban a nadie).
// - BuscadorPaciente: buscar por nombre (sin tildes) o teléfono.

import React, { useState, useEffect } from 'react'
import { rellenar, telefonoWhatsApp } from '../lib/jornadas.js'
import { usePlantilla, enviarWhatsApp } from '../lib/avisos.js'
import { normBusqueda } from '../lib/busqueda.js'

/**
 * destinatarios: [{ id, nombre, phone, datos: {servicio, dia, hora…} }]
 * onEnviado(idsOk) se llama con los ids a los que el bot confirmó el envío.
 */
export function AvisoModal({ ui, sb, botFetch, titulo, clave, destinatarios, onClose, onEnviado, textoBoton = 'Enviar' }) {
  const { Modal, Btn } = ui
  const [plantilla, guardarPlantilla] = usePlantilla(sb, clave)
  const [borrador, setBorrador] = useState(null)
  const [marcados, setMarcados] = useState(() => new Set(destinatarios.filter(d => telefonoWhatsApp(d.phone)).map(d => d.id)))
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')
  const texto = borrador ?? plantilla
  const ejemplo = destinatarios[0]

  const enviar = async () => {
    setEnviando(true); setError('')
    if (borrador != null && borrador !== plantilla) await guardarPlantilla(borrador)
    const elegidos = destinatarios.filter(d => marcados.has(d.id))
    const mensajes = elegidos.map(d => ({ id: d.id, phone: telefonoWhatsApp(d.phone), text: rellenar(texto, { nombre: d.nombre, ...d.datos }) }))
    try {
      const res = await enviarWhatsApp(botFetch, mensajes)
      const okPhones = new Set(res.filter(r => r.ok).map(r => r.phone))
      const ok = mensajes.filter(m => okPhones.has(m.phone)).map(m => m.id)
      const fallidos = mensajes.length - ok.length
      await onEnviado(ok, fallidos)
    } catch (e) {
      setError('No se pudo enviar: ' + e.message)
      setEnviando(false)
    }
  }

  return <Modal title={titulo} onClose={enviando ? () => {} : onClose}>
    <label className="field-label">Mensaje · {'{nombre} {servicio} {dia} {hora}'} se rellenan solos</label>
    <textarea className="field-input" rows={5} value={texto} onChange={e => setBorrador(e.target.value)} style={{ width: '100%', fontFamily: 'inherit', resize: 'vertical' }} />
    {ejemplo && <div style={{ fontSize: 12, color: 'var(--text-muted)', background: 'var(--cream)', borderRadius: 8, padding: '8px 10px', margin: '8px 0 14px', whiteSpace: 'pre-wrap' }}>
      <strong>Así le llega a {ejemplo.nombre}:</strong><br />{rellenar(texto, { nombre: ejemplo.nombre, ...ejemplo.datos })}
    </div>}
    <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6 }}>Destinatarios ({marcados.size})</div>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 14, maxHeight: 220, overflowY: 'auto' }}>
      {destinatarios.map(d => {
        const tel = telefonoWhatsApp(d.phone)
        return <label key={d.id} style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 13, padding: '6px 8px', background: 'var(--cream)', borderRadius: 6, opacity: tel ? 1 : .5 }}>
          <input type="checkbox" disabled={!tel} checked={marcados.has(d.id)} onChange={e => setMarcados(prev => { const s = new Set(prev); e.target.checked ? s.add(d.id) : s.delete(d.id); return s })} />
          <span style={{ flex: 1 }}>{d.nombreCompleto || d.nombre}{d.datos?.hora ? ` · ${d.datos.hora}` : ''}</span>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{tel ? d.phone : 'sin móvil válido'}</span>
        </label>
      })}
    </div>
    {error && <div style={{ color: 'var(--error)', fontSize: 13, marginBottom: 10 }}>{error}</div>}
    <div style={{ display: 'flex', gap: 10 }}>
      <Btn variant="ghost" onClick={onClose} disabled={enviando} style={{ flex: 1 }}>Ahora no</Btn>
      <Btn onClick={enviar} disabled={enviando || marcados.size === 0 || !texto.trim()} style={{ flex: 1 }}>
        {enviando ? `Enviando ${marcados.size}… (2 s por mensaje)` : `${textoBoton} (${marcados.size})`}
      </Btn>
    </div>
  </Modal>
}

export function BuscadorPaciente({ sb, onElegir, excluir = [], placeholder = 'Buscar paciente por nombre o teléfono…' }) {
  const [q, setQ] = useState('')
  const [res, setRes] = useState([])
  const fuera = excluir.join(',')
  useEffect(() => {
    if (q.trim().length < 2) return
    let vivo = true
    const t = setTimeout(async () => {
      const { data } = await sb.from('patients').select('id,full_name,phone')
        .or(`full_name_busqueda.ilike.%${normBusqueda(q)}%,phone.ilike.%${q.replace(/\D/g, '') || q}%`).limit(6)
      if (vivo) setRes((data || []).filter(p => !fuera.split(',').includes(p.id)))
    }, 250)
    return () => { vivo = false; clearTimeout(t) }
  }, [q, sb, fuera])
  return <div style={{ position: 'relative' }}>
    <input className="field-input" value={q} onChange={e => setQ(e.target.value)} placeholder={placeholder} style={{ width: '100%' }} />
    {q.trim().length >= 2 && res.length > 0 && <div className="card" style={{ position: 'absolute', zIndex: 5, left: 0, right: 0, marginTop: 4, overflow: 'hidden' }}>
      {res.map(p => <button key={p.id} type="button" onClick={() => { onElegir(p); setQ(''); setRes([]) }}
        style={{ display: 'flex', justifyContent: 'space-between', width: '100%', padding: '9px 12px', border: 'none', borderBottom: '1px solid var(--stone)', background: '#fff', cursor: 'pointer', fontSize: 13, textAlign: 'left' }}>
        <span>{p.full_name}</span><span style={{ color: 'var(--text-muted)', fontSize: 11 }}>{p.phone}</span>
      </button>)}
    </div>}
  </div>
}
