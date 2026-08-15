// AutonomiaPage — panel para ir soltando al bot casuística a casuística.
//
// Encargo de Josema (2026-08-14), "el de mejora máxima": un botón de automático
// por CADA función/casuística que maneja el bot (no por categoría gruesa, que
// mezcla cosas irreversibles con cosas triviales), con estadísticas de acierto
// por semana para monitorizar rendimiento y atajar las peores antes de soltar
// más. Esta pantalla NO decide nada sola: activar el automático es siempre un
// clic humano, con freno de muestra mínima y confirmación cuando la casuística
// toca la agenda.
//
// El SQL de la migración 0015_autonomia_por_casuistica.sql puede no estar
// aplicado todavía en Supabase (tabla bot_autonomy, columna
// bot_coach_reviews.casuistica, columna bot_config.autonomia_global_off):
// cualquier consulta contra ellas puede fallar. Todo va en try/catch con un
// aviso claro y estados de carga/error independientes por bloque — nunca una
// pantalla en blanco.
//
// El mapa de casuísticas (etiqueta + si muta la agenda) está DUPLICADO aquí a
// mano desde anantara-whatsapp/v5/src/coach/casuistica.js: son proyectos
// separados y este panel no puede importar del bot. SI SE TOCA ESE FICHERO,
// HAY QUE TOCAR ESTA COPIA TAMBIÉN (mantener en sync a mano).
//
// Props:
//   - sb: cliente Supabase ya inicializado, inyectado por el padre.
//   - onToast({msg, type}): type 'ok' | 'error'. Puede no venir.

import React, { useState, useEffect, useCallback, useMemo } from 'react'

// ─── Catálogo de casuísticas (copia manual — ver cabecera) ─────────────────
const CASUISTICAS = {
  // Sin efecto en la agenda (candidatas naturales a ir primero en auto).
  confirmar_d1:        { label: 'Confirma el recordatorio D-1', muta: false },
  saludo:              { label: 'Saludo', muta: false },
  agradecimiento:      { label: 'Agradecimiento', muta: false },
  cortesia_silencio:   { label: 'Cortesía sin contexto (silencio)', muta: false },
  info_horario:        { label: 'Pregunta de horario/servicios', muta: false },
  consultar_cita:      { label: 'Consulta sus citas', muta: false },
  // Mutan la agenda (soltar solo con mucha muestra y acierto).
  confirmar_propuesta: { label: 'Acepta una propuesta', muta: true },
  confirmar_followup:  { label: 'Acepta la oferta de follow-up', muta: true },
  aceptar_wl:          { label: 'Acepta un hueco liberado', muta: true },
  rechazar_wl:         { label: 'Rechaza un hueco liberado', muta: true },
  rechazar_followup:   { label: 'Rechaza la oferta de follow-up', muta: true },
  proponer_cita:       { label: 'Propone cita nueva', muta: true },
  rechazar_propuesta:  { label: 'Rechaza y reoferta', muta: true },
  descartar_propuesta: { label: 'Descarta la propuesta', muta: true },
  cancelar_cita:       { label: 'Cancela una cita', muta: true },
  reprogramar:         { label: 'Reprograma (cancela + propone)', muta: true },
  anotar_cita:         { label: 'Anota en la cita', muta: true },
  oferta_proactiva:    { label: 'Oferta proactiva de cita', muta: true },
  lista_espera:        { label: 'Apunta en lista de espera', muta: true },
  // Derivación y resto.
  avisar_secretaria:   { label: 'Deriva a la secretaria', muta: false },
  otra:                { label: 'Otra', muta: false },
}
const CASUISTICA_KEYS = Object.keys(CASUISTICAS)
function casuisticaLabel(clave) { return CASUISTICAS[clave]?.label || clave || 'Otra' }
function casuisticaMuta(clave) { return !!CASUISTICAS[clave]?.muta }

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const WEEK_OPTIONS = [['4', '4 semanas'], ['8', '8 semanas'], ['12', '12 semanas']]

function pad(n) { return String(n).padStart(2, '0') }

// Fecha de corte 'YYYY-MM-DDTHH:MM:SS' para filtrar las últimas N semanas, sin
// pasar por toISOString (mismo patrón que AusenciasPage: hora local de pared).
function cutoffIso(weeks) {
  const now = new Date()
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - weeks * 7)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T00:00:00`
}

// Lunes de la semana ISO a la que pertenece una fecha, como 'YYYY-MM-DD'.
function mondayKey(iso) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  const day = d.getDay() // 0 dom … 6 sáb
  const diff = (day === 0 ? -6 : 1) - day
  const m = new Date(d.getFullYear(), d.getMonth(), d.getDate() + diff)
  return `${m.getFullYear()}-${pad(m.getMonth() + 1)}-${pad(m.getDate())}`
}

// 'YYYY-MM-DD' (lunes) → '14 ago 2026'.
function fmtWeek(key) {
  if (!key) return '—'
  const y = key.slice(0, 4), m = +key.slice(5, 7), d = +key.slice(8, 10)
  return `${d} ${MESES[m - 1]} ${y}`
}

// Mensajes de Supabase para columna/tabla inexistente varían, pero todos
// mencionan la columna, la tabla o "schema cache". Si no reconocemos el
// patrón, se muestra igualmente el error real para no dejar la pantalla muda.
function friendlyError(e) {
  const msg = e?.message || String(e || 'Error desconocido')
  if (/column|does not exist|schema cache|relation .*bot_autonomy|bot_autonomy|casuistica|autonomia_global_off/i.test(msg)) {
    return 'Falta aplicar la migración 0015_autonomia_por_casuistica.sql en Supabase. (' + msg + ')'
  }
  return `No se pudo cargar: ${msg}`
}

function Sp() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 32 }}>
      <div style={{ width: 28, height: 28, border: '3px solid var(--border)', borderTopColor: 'var(--green)', borderRadius: '50%', animation: 'autSpin .7s linear infinite' }} />
      <style>{'@keyframes autSpin{to{transform:rotate(360deg)}}'}</style>
    </div>
  )
}

function ErrorBanner({ text }) {
  return (
    <div style={{ fontSize: 13, color: '#7f1d1d', background: '#fecdd3', border: '1px solid #f87171', padding: '10px 14px', borderRadius: 8 }}>
      ⚠️ {text}
    </div>
  )
}

function Toggle({ on, onChange, disabled, saving }) {
  return (
    <button
      type="button"
      className={`toggle ${on ? 'on' : 'off'}`}
      onClick={() => { if (!disabled && !saving) onChange(!on) }}
      disabled={disabled || saving}
      style={(disabled || saving) ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}
      title={disabled ? 'Faltan casos para poder activarlo' : undefined}
    >
      <span className="toggle-knob" />
    </button>
  )
}

function pctChip(pct) {
  if (pct == null) return <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>—</span>
  let bg, border, color
  if (pct >= 90) { bg = '#dcfce7'; border = '#4ade80'; color = '#166534' }
  else if (pct >= 70) { bg = '#fef3c7'; border = '#fcd34d'; color = '#92400e' }
  else { bg = '#fecdd3'; border = '#f87171'; color = '#7f1d1d' }
  return (
    <span style={{ display: 'inline-block', minWidth: 46, textAlign: 'center', padding: '2px 10px', borderRadius: 999, fontSize: 12, fontWeight: 700, background: bg, border: `1px solid ${border}`, color }}>
      {pct}%
    </span>
  )
}

// Modal propio de confirmación al activar una casuística que toca la agenda.
// Nada de window.confirm: hay que dejar explícito qué va a pasar.
function ConfirmMutaModal({ row, saving, onCancel, onConfirm }) {
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && !saving && onCancel()}>
      <div className="modal" style={{ maxWidth: 440 }}>
        <div className="modal-title">⚠️ Activar automático</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: 13, color: 'var(--body)' }}>
          <p style={{ margin: 0 }}>
            Vas a poner en automático <strong>{casuisticaLabel(row.casuistica)}</strong>.
          </p>
          <p style={{ margin: 0 }}>
            Esta casuística <strong>modifica la agenda</strong> (cancela, propone, reprograma o similar).
            A partir de ahora se ejecutará sola, sin que nadie la revise antes de que le llegue al paciente.
          </p>
          <p style={{ margin: 0, color: 'var(--text-muted)' }}>
            Muestra actual: {row.total} caso{row.total !== 1 ? 's' : ''} · acierto {row.pct == null ? '—' : `${row.pct}%`}.
          </p>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
            <button className="btn btn-ghost" onClick={onCancel} disabled={saving}>Cancelar</button>
            <button className="btn btn-primary" onClick={onConfirm} disabled={saving}>
              {saving ? 'Activando…' : 'Sí, activar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export function AutonomiaPage({ sb, onToast }) {
  // ─── Botón de pánico (bot_config.autonomia_global_off) ────────────────────
  const [panicOff, setPanicOff] = useState(false)
  const [panicLoading, setPanicLoading] = useState(true)
  const [panicError, setPanicError] = useState(null)
  const [panicSaving, setPanicSaving] = useState(false)

  useEffect(() => {
    let alive = true
    ;(async () => {
      setPanicLoading(true); setPanicError(null)
      try {
        const { data, error } = await sb.from('bot_config')
          .select('autonomia_global_off').limit(1).maybeSingle()
        if (error) throw error
        if (!alive) return
        setPanicOff(!!data?.autonomia_global_off)
      } catch (e) {
        if (alive) setPanicError(friendlyError(e))
      } finally {
        if (alive) setPanicLoading(false)
      }
    })()
    return () => { alive = false }
  }, [sb])

  const togglePanic = async () => {
    if (panicSaving) return
    setPanicSaving(true)
    const newVal = !panicOff
    try {
      const { data, error } = await sb.from('bot_config')
        .update({ autonomia_global_off: newVal, updated_at: new Date().toISOString() })
        .eq('id', 1).select('id')
      if (error) throw error
      if (!data?.length) throw new Error('no se encontró la configuración del bot (bot_config id=1)')
      setPanicOff(newVal)
      onToast?.({ msg: newVal ? 'Autonomía desactivada globalmente' : 'Autonomía global reactivada', type: 'ok' })
    } catch (e) {
      onToast?.({ msg: friendlyError(e), type: 'error' })
    } finally {
      setPanicSaving(false)
    }
  }

  // ─── bot_autonomy: filas por casuística ────────────────────────────────────
  const [autonomyRows, setAutonomyRows] = useState([])
  const [autonomyLoading, setAutonomyLoading] = useState(true)
  const [autonomyError, setAutonomyError] = useState(null)
  const [notaDrafts, setNotaDrafts] = useState({})
  const [autoSavingKey, setAutoSavingKey] = useState(null)
  const [confirmRow, setConfirmRow] = useState(null)
  const [confirmSaving, setConfirmSaving] = useState(false)

  const loadAutonomy = useCallback(async () => {
    setAutonomyLoading(true); setAutonomyError(null)
    try {
      const { data, error } = await sb.from('bot_autonomy')
        .select('casuistica, auto, min_muestra, nota')
      if (error) throw error
      const rows = data || []
      setAutonomyRows(rows)
      setNotaDrafts(Object.fromEntries(rows.map(r => [r.casuistica, r.nota || ''])))
    } catch (e) {
      setAutonomyError(friendlyError(e))
      setAutonomyRows([])
    } finally {
      setAutonomyLoading(false)
    }
  }, [sb])
  useEffect(() => { loadAutonomy() }, [loadAutonomy])

  // ─── bot_coach_reviews: histórico para agregar acierto/semana ─────────────
  const [weeks, setWeeks] = useState('8')
  const [reviews, setReviews] = useState([])
  const [reviewsLoading, setReviewsLoading] = useState(true)
  const [reviewsError, setReviewsError] = useState(null)

  const loadReviews = useCallback(async () => {
    setReviewsLoading(true); setReviewsError(null)
    try {
      const { data, error } = await sb.from('bot_coach_reviews')
        .select('casuistica, verdict, created_at')
        .gte('created_at', cutoffIso(Number(weeks)))
        .limit(5000)
      if (error) throw error
      setReviews(data || [])
    } catch (e) {
      setReviewsError(friendlyError(e))
      setReviews([])
    } finally {
      setReviewsLoading(false)
    }
  }, [sb, weeks])
  useEffect(() => { loadReviews() }, [loadReviews])

  // ─── Escritura: auto y nota ─────────────────────────────────────────────
  const setAuto = useCallback(async (casuistica, newVal) => {
    setAutoSavingKey(casuistica)
    try {
      let updated_by = null
      try {
        const { data: u } = await sb.auth.getUser()
        updated_by = u?.user?.email || null
      } catch { /* no bloquea el guardado si no se puede saber quién es */ }
      const { data, error } = await sb.from('bot_autonomy')
        .update({ auto: newVal, updated_at: new Date().toISOString(), updated_by })
        .eq('casuistica', casuistica)
        .select('casuistica')
      if (error) throw error
      if (!data?.length) throw new Error(`no se encontró "${casuistica}" en bot_autonomy`)
      setAutonomyRows(rows => rows.map(r => r.casuistica === casuistica ? { ...r, auto: newVal } : r))
      onToast?.({ msg: newVal ? `${casuisticaLabel(casuistica)}: automático activado` : `${casuisticaLabel(casuistica)}: vuelto a manual`, type: 'ok' })
    } catch (e) {
      onToast?.({ msg: friendlyError(e), type: 'error' })
    } finally {
      setAutoSavingKey(null)
    }
  }, [sb, onToast])

  const saveNota = useCallback(async (casuistica, text) => {
    try {
      let updated_by = null
      try {
        const { data: u } = await sb.auth.getUser()
        updated_by = u?.user?.email || null
      } catch { /* idem */ }
      const { data, error } = await sb.from('bot_autonomy')
        .update({ nota: text, updated_at: new Date().toISOString(), updated_by })
        .eq('casuistica', casuistica)
        .select('casuistica')
      if (error) throw error
      if (!data?.length) throw new Error(`no se encontró "${casuistica}" en bot_autonomy`)
      setAutonomyRows(rows => rows.map(r => r.casuistica === casuistica ? { ...r, nota: text } : r))
      onToast?.({ msg: 'Nota guardada', type: 'ok' })
    } catch (e) {
      onToast?.({ msg: friendlyError(e), type: 'error' })
    }
  }, [sb, onToast])

  // ─── Agregación en JS (una sola consulta, nunca una por casuística) ───────
  const statsByCasuistica = useMemo(() => {
    const m = {}
    for (const r of reviews) {
      const key = r.casuistica || 'otra'
      if (!m[key]) m[key] = { total: 0, sent: 0, auto: 0, modified: 0, rejected: 0 }
      const s = m[key]
      // 'pending' no cuenta en el total: aún no está resuelto.
      if (r.verdict === 'sent') { s.total++; s.sent++ }
      else if (r.verdict === 'auto_sent') { s.total++; s.auto++ }
      else if (r.verdict === 'modified') { s.total++; s.modified++ }
      else if (r.verdict === 'rejected') { s.total++; s.rejected++ }
    }
    return m
  }, [reviews])

  const displayRows = useMemo(() => {
    const order = new Map(CASUISTICA_KEYS.map((k, i) => [k, i]))
    return [...autonomyRows]
      .sort((a, b) => (order.has(a.casuistica) ? order.get(a.casuistica) : 999) - (order.has(b.casuistica) ? order.get(b.casuistica) : 999))
      .map(row => {
        const s = statsByCasuistica[row.casuistica] || { total: 0, sent: 0, auto: 0, modified: 0, rejected: 0 }
        const aciertos = s.sent + s.auto
        const pct = s.total > 0 ? Math.round((aciertos / s.total) * 1000) / 10 : null
        return { ...row, ...s, pct }
      })
  }, [autonomyRows, statsByCasuistica])

  // ─── Evolución semanal de la casuística seleccionada ───────────────────────
  const [selectedCasuistica, setSelectedCasuistica] = useState(null)

  const weeklyForSelected = useMemo(() => {
    if (!selectedCasuistica) return []
    const byWeek = {}
    for (const r of reviews) {
      if (r.casuistica !== selectedCasuistica || r.verdict === 'pending') continue
      const wk = mondayKey(r.created_at)
      if (!wk) continue
      if (!byWeek[wk]) byWeek[wk] = { total: 0, sent: 0, modified: 0, rejected: 0 }
      const s = byWeek[wk]
      s.total++
      if (r.verdict === 'sent' || r.verdict === 'auto_sent') s.sent++
      else if (r.verdict === 'modified') s.modified++
      else if (r.verdict === 'rejected') s.rejected++
    }
    return Object.entries(byWeek)
      .map(([week, s]) => ({ week, ...s, pct: s.total > 0 ? Math.round((s.sent / s.total) * 1000) / 10 : null }))
      .sort((a, b) => (a.week < b.week ? 1 : -1))
  }, [reviews, selectedCasuistica])

  // ─── Activar/desactivar desde la fila (con freno y confirmación) ──────────
  const handleToggle = (row, newVal) => {
    if (!newVal) { setAuto(row.casuistica, false); return } // apagar nunca confirma
    const minMuestra = row.min_muestra ?? 999999
    if (row.total < minMuestra) return // freno: el interruptor ya sale deshabilitado
    if (casuisticaMuta(row.casuistica)) { setConfirmRow(row); return }
    setAuto(row.casuistica, true)
  }

  const confirmActivate = async () => {
    if (!confirmRow) return
    setConfirmSaving(true)
    await setAuto(confirmRow.casuistica, true)
    setConfirmSaving(false)
    setConfirmRow(null)
  }

  const dataError = autonomyError || reviewsError
  const dataLoading = autonomyLoading || reviewsLoading

  return (
    <>
      <div className="section-header">
        <span className="section-title">Autonomía del bot</span>
      </div>

      {/* ── 1. Botón de pánico ───────────────────────────────────────────── */}
      <div className="card" style={{ padding: 20, marginBottom: 16, ...(panicOff ? { border: '1.5px solid #dc2626', background: '#fef2f2' } : {}) }}>
        {panicLoading ? <Sp /> : panicError ? <ErrorBanner text={panicError} /> : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontWeight: 700, color: 'var(--ink,var(--body))', marginBottom: 4 }}>Autonomía global</div>
              {panicOff ? (
                <div style={{ fontSize: 14, fontWeight: 700, color: '#b91c1c' }}>
                  🛑 Autonomía desactivada globalmente — todo pasa por la secretaria
                </div>
              ) : (
                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                  El bot actúa solo en las casuísticas marcadas como automático abajo.
                </div>
              )}
            </div>
            <button
              className={`btn ${panicOff ? 'btn-primary' : 'btn-danger'}`}
              onClick={togglePanic}
              disabled={panicSaving}
            >
              {panicSaving ? 'Guardando…' : (panicOff ? 'Reactivar autonomía' : '🛑 Desactivar todo (pánico)')}
            </button>
          </div>
        )}
      </div>

      {/* ── Selector de ventana (afecta a las dos tablas de abajo) ─────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
        <div className="tab-pills" style={{ margin: 0 }}>
          {WEEK_OPTIONS.map(([id, label]) => (
            <button key={id} className={`tab-pill ${weeks === id ? 'active' : ''}`} onClick={() => setWeeks(id)}>
              {label}
            </button>
          ))}
        </div>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          Ventana de datos: últimas {weeks} semanas
        </span>
      </div>

      {/* ── 2. Tabla de casuísticas ───────────────────────────────────────── */}
      <div className="card" style={{ padding: 20, marginBottom: 16, opacity: panicOff ? 0.55 : 1, transition: 'opacity .2s' }}>
        {dataLoading ? <Sp /> : dataError ? <ErrorBanner text={dataError} /> : displayRows.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">🤖</div>
            <div className="empty-state-title">Sin casuísticas configuradas</div>
            <div className="empty-state-sub">No hay filas en bot_autonomy todavía.</div>
          </div>
        ) : (
          <div style={{ overflow: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: 'var(--green)', color: 'white' }}>
                  <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, whiteSpace: 'nowrap' }}>Casuística</th>
                  <th style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 700, whiteSpace: 'nowrap' }}>Total</th>
                  <th style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 700, whiteSpace: 'nowrap' }}>Aprobado sin tocar</th>
                  <th style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 700, whiteSpace: 'nowrap' }}>Auto</th>
                  <th style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 700, whiteSpace: 'nowrap' }}>Modificado</th>
                  <th style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 700, whiteSpace: 'nowrap' }}>Rechazado</th>
                  <th style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 700, whiteSpace: 'nowrap' }}>% acierto</th>
                  <th style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 700, whiteSpace: 'nowrap' }}>Automático</th>
                  <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, whiteSpace: 'nowrap' }}>Nota</th>
                </tr>
              </thead>
              <tbody>
                {displayRows.map((row, i) => {
                  const minMuestra = row.min_muestra ?? 999999
                  const belowMin = row.total < minMuestra
                  const saving = autoSavingKey === row.casuistica
                  const selected = selectedCasuistica === row.casuistica
                  return (
                    <tr key={row.casuistica} style={{ background: selected ? 'var(--green-subtle, #eaf1ec)' : (i % 2 ? 'white' : 'var(--cream)') }}>
                      <td
                        style={{ padding: '8px 12px', fontWeight: 600, cursor: 'pointer' }}
                        onClick={() => setSelectedCasuistica(row.casuistica)}
                        title="Ver evolución semanal"
                      >
                        {casuisticaLabel(row.casuistica)}
                        {casuisticaMuta(row.casuistica) && (
                          <span style={{ marginLeft: 8, display: 'inline-block', fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: '#fef3c7', border: '1px solid #fcd34d', color: '#92400e', verticalAlign: 'middle' }}>
                            toca la agenda
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '8px 12px', textAlign: 'center' }}>{row.total}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'center' }}>{row.sent}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'center' }}>{row.auto}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'center' }}>{row.modified}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'center' }}>{row.rejected}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'center' }}>{pctChip(row.pct)}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                          <Toggle on={!!row.auto} disabled={belowMin} saving={saving} onChange={v => handleToggle(row, v)} />
                          {belowMin ? (
                            <span style={{ fontSize: 10, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                              faltan {minMuestra - row.total}
                            </span>
                          ) : (
                            <span style={{ fontSize: 10, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                              mín. {row.min_muestra ?? '—'}
                            </span>
                          )}
                        </div>
                      </td>
                      <td style={{ padding: '8px 12px' }}>
                        <input
                          className="field-input"
                          style={{ fontSize: 12, padding: '6px 8px', minHeight: 'auto', width: 180 }}
                          value={notaDrafts[row.casuistica] ?? ''}
                          onChange={e => setNotaDrafts(d => ({ ...d, [row.casuistica]: e.target.value }))}
                          onBlur={e => {
                            const v = e.target.value
                            if (v !== (row.nota || '')) saveNota(row.casuistica, v)
                          }}
                          placeholder="Nota…"
                        />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── 3. Evolución por semanas ─────────────────────────────────────── */}
      <div className="card" style={{ padding: 20 }}>
        <div style={{ fontWeight: 700, color: 'var(--ink,var(--body))', marginBottom: 12 }}>
          Evolución semanal{selectedCasuistica ? `: ${casuisticaLabel(selectedCasuistica)}` : ''}
        </div>
        {!selectedCasuistica ? (
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            Pulsa una casuística de la tabla de arriba para ver su evolución por semanas.
          </div>
        ) : reviewsLoading ? <Sp /> : reviewsError ? <ErrorBanner text={reviewsError} /> : weeklyForSelected.length === 0 ? (
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Sin casos en la ventana seleccionada.</div>
        ) : (
          <div style={{ overflow: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: 'var(--green)', color: 'white' }}>
                  <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, whiteSpace: 'nowrap' }}>Semana</th>
                  <th style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 700, whiteSpace: 'nowrap' }}>Total</th>
                  <th style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 700, whiteSpace: 'nowrap' }}>Sent</th>
                  <th style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 700, whiteSpace: 'nowrap' }}>Modified</th>
                  <th style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 700, whiteSpace: 'nowrap' }}>Rejected</th>
                  <th style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 700, whiteSpace: 'nowrap' }}>% acierto</th>
                </tr>
              </thead>
              <tbody>
                {weeklyForSelected.map((w, i) => (
                  <tr key={w.week} style={{ background: i % 2 ? 'white' : 'var(--cream)' }}>
                    <td style={{ padding: '8px 12px', fontWeight: 600, whiteSpace: 'nowrap' }}>{fmtWeek(w.week)}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'center' }}>{w.total}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'center' }}>{w.sent}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'center' }}>{w.modified}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'center' }}>{w.rejected}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'center' }}>{pctChip(w.pct)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {confirmRow && (
        <ConfirmMutaModal
          row={confirmRow}
          saving={confirmSaving}
          onCancel={() => !confirmSaving && setConfirmRow(null)}
          onConfirm={confirmActivate}
        />
      )}
    </>
  )
}
