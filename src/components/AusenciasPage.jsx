// AusenciasPage — pantalla de consulta y configuración de ausencias (no-shows).
//
// Marcar/deshacer una ausencia se hace desde la Agenda; esta pantalla es solo
// de consulta (ranking de pacientes) y configuración (plantilla del mensaje +
// % por defecto que se factura). NO marca ni desmarca ausencias.
//
// El SQL de la migración 0014_ausencias.sql puede no estar aplicado todavía en
// Supabase: cualquier consulta contra las columnas nuevas puede fallar. Todas
// las cargas van en try/catch y muestran un aviso claro en vez de romperse.
//
// Props:
//   - sb: cliente Supabase ya inicializado, inyectado por el padre.
//   - onToast({msg, type}): type 'ok' | 'error'. Puede no venir.

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { buildNoShowMessage, rankingAusencias } from '../lib/noShow.js'

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

function pad(n) { return String(n).padStart(2, '0') }

// Fecha de corte 'YYYY-MM-DDTHH:MM:SS' para filtrar los últimos N meses, sin
// pasar por toISOString (la BD guarda hora local de pared).
function cutoffIso(months) {
  const now = new Date()
  const d = new Date(now.getFullYear(), now.getMonth() - months, now.getDate())
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T00:00:00`
}

// 'YYYY-MM-DDTHH:MM(:SS)' → '14 ago 2026 · 10:00'. Sin Date() con TZ: se lee
// tal cual del string, como fmtAppt en ActionEditorModal.
function fmtUltima(iso) {
  if (!iso) return '—'
  const y = iso.slice(0, 4), m = +iso.slice(5, 7), d = +iso.slice(8, 10)
  const hora = iso.slice(11, 16)
  return `${d} ${MESES[m - 1]} ${y} · ${hora}`
}

// Mensajes de Supabase para columna/tabla inexistente varían, pero todos
// mencionan la columna o "schema cache". Si no reconocemos el patrón, se
// muestra igualmente el error real para no dejar la pantalla muda.
function friendlyError(e) {
  const msg = e?.message || String(e || 'Error desconocido')
  if (/column|does not exist|schema cache|no_show/i.test(msg)) {
    return 'Falta aplicar la migración 0014_ausencias.sql en Supabase. (' + msg + ')'
  }
  return `No se pudo cargar: ${msg}`
}

function Sp() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 32 }}>
      <div style={{ width: 28, height: 28, border: '3px solid var(--border)', borderTopColor: 'var(--green)', borderRadius: '50%', animation: 'ausSpin .7s linear infinite' }} />
      <style>{'@keyframes ausSpin{to{transform:rotate(360deg)}}'}</style>
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

const labelStyle = { fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.3 }

export function AusenciasPage({ sb, onToast }) {
  // ─── Plantilla del mensaje + % por defecto ────────────────────────────────
  const [tpl, setTpl] = useState('')
  const [pct, setPct] = useState(50)
  const [cfgLoading, setCfgLoading] = useState(true)
  const [cfgError, setCfgError] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let alive = true
    ;(async () => {
      setCfgLoading(true); setCfgError(null)
      try {
        const { data, error } = await sb.from('bot_config')
          .select('no_show_message,no_show_default_pct')
          .limit(1).maybeSingle()
        if (error) throw error
        if (!alive) return
        setTpl(data?.no_show_message || '')
        setPct(data?.no_show_default_pct ?? 50)
      } catch (e) {
        if (alive) setCfgError(friendlyError(e))
      } finally {
        if (alive) setCfgLoading(false)
      }
    })()
    return () => { alive = false }
  }, [sb])

  const handleSaveConfig = async () => {
    setSaving(true)
    try {
      const pctVal = Math.max(0, Math.min(100, Math.round(Number(pct) || 0)))
      // `bot_config` es una fila única (id=1). Pedimos el id de vuelta para
      // detectar el caso en que el UPDATE no afecte a ninguna fila: si no, el
      // botón diría "guardado" sin haber guardado nada y nadie se enteraría.
      const { data: updated, error } = await sb.from('bot_config').update({
        no_show_message: tpl,
        no_show_default_pct: pctVal,
        updated_at: new Date().toISOString(),
      }).eq('id', 1).select('id')
      if (error) throw error
      if (!updated?.length) throw new Error('no se encontró la configuración del bot (bot_config id=1)')
      setPct(pctVal)
      onToast?.({ msg: 'Plantilla de ausencias guardada', type: 'ok' })
    } catch (e) {
      onToast?.({ msg: friendlyError(e), type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const preview = useMemo(() => buildNoShowMessage(tpl, {
    dia: 'jueves 14 de agosto', hora: '10:00', profesional: 'Marcos', porcentaje: pct, importe: 20,
  }), [tpl, pct])

  // ─── Ranking de ausencias ──────────────────────────────────────────────────
  const [period, setPeriod] = useState('6') // '3' | '6' | '12' | 'all'
  const [rows, setRows] = useState([])
  const [tableLoading, setTableLoading] = useState(true)
  const [tableError, setTableError] = useState(null)

  const loadTable = useCallback(async () => {
    setTableLoading(true); setTableError(null)
    try {
      let q = sb.from('appointments')
        .select('id, starts_at, no_show_at, no_show_charge_pct, patient_id, patients(id, full_name, phone), services(price)')
        .not('no_show_at', 'is', null)
        .order('starts_at', { ascending: false })
        .limit(1000)
      if (period !== 'all') q = q.gte('starts_at', cutoffIso(Number(period)))
      const { data, error } = await q
      if (error) throw error
      setRows(data || [])
    } catch (e) {
      setTableError(friendlyError(e))
      setRows([])
    } finally {
      setTableLoading(false)
    }
  }, [sb, period])
  useEffect(() => { loadTable() }, [loadTable])

  const ranking = useMemo(() => rankingAusencias(rows), [rows])
  const totalAusencias = ranking.reduce((s, p) => s + p.total, 0)
  const totalCobradas = ranking.reduce((s, p) => s + p.cobradas, 0)
  const totalImporte = Math.round(ranking.reduce((s, p) => s + p.importe, 0) * 100) / 100

  const PERIODS = [['3', '3 meses'], ['6', '6 meses'], ['12', '12 meses'], ['all', 'Todo']]

  return (
    <>
      <div className="section-header">
        <span className="section-title">Ausencias</span>
      </div>

      {/* ── 1. Plantilla del mensaje ─────────────────────────────────────── */}
      <div className="card" style={{ padding: 20, marginBottom: 16 }}>
        <div style={{ fontWeight: 700, color: 'var(--ink,var(--body))', marginBottom: 12 }}>Mensaje de ausencia</div>

        {cfgLoading ? <Sp /> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {cfgError && <ErrorBanner text={cfgError} />}

            <label style={{ display: 'block' }}>
              <div style={labelStyle}>Plantilla</div>
              <textarea
                value={tpl}
                onChange={e => setTpl(e.target.value)}
                rows={4}
                className="notes-area"
                placeholder="Ej: Hola, vimos que no pudiste venir a tu cita del {dia} a las {hora} con {profesional}. Se factura el {porcentaje}% ({importe}) según nuestra política de ausencias."
              />
            </label>

            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              Marcadores admitidos: <code>{'{dia}'}</code> <code>{'{hora}'}</code> <code>{'{profesional}'}</code> <code>{'{porcentaje}'}</code> <code>{'{importe}'}</code>
            </div>

            <div>
              <div style={labelStyle}>Vista previa</div>
              <div style={{ fontSize: 13, color: 'var(--body)', background: 'var(--cream)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px', whiteSpace: 'pre-wrap' }}>
                {preview || <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Escribe una plantilla para ver el mensaje resultante.</span>}
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap' }}>
              <label style={{ display: 'block' }}>
                <div style={labelStyle}>% por defecto</div>
                <input
                  type="number" min={0} max={100} value={pct}
                  onChange={e => setPct(e.target.value)}
                  className="field-input" style={{ width: 100 }}
                />
              </label>
              <button
                className="btn btn-primary"
                onClick={handleSaveConfig}
                disabled={saving}
              >
                {saving ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── 2. Resumen ────────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 16 }}>
        <div className="card stat-card" style={{ borderTopColor: '#f87171' }}>
          <div className="stat-label">Ausencias del período</div>
          <div className="stat-value">{tableLoading ? '—' : totalAusencias}</div>
          <div className="stat-sub">citas no asistidas</div>
        </div>
        <div className="card stat-card" style={{ borderTopColor: 'var(--gold,#B8943A)' }}>
          <div className="stat-label">Cobradas</div>
          <div className="stat-value">{tableLoading ? '—' : totalCobradas}</div>
          <div className="stat-sub">de {tableLoading ? '—' : totalAusencias} ausencias</div>
        </div>
        <div className="card stat-card" style={{ borderTopColor: 'var(--green)' }}>
          <div className="stat-label">Importe facturado</div>
          <div className="stat-value">{tableLoading ? '—' : `${totalImporte.toFixed(2)}€`}</div>
          <div className="stat-sub">por ausencias en el período</div>
        </div>
      </div>

      {/* ── 3. Ranking ────────────────────────────────────────────────────── */}
      <div className="card" style={{ padding: 20 }}>
        <div className="tab-pills">
          {PERIODS.map(([id, label]) => (
            <button key={id} className={`tab-pill ${period === id ? 'active' : ''}`} onClick={() => setPeriod(id)}>
              {label}
            </button>
          ))}
        </div>

        {tableLoading ? <Sp /> : tableError ? <ErrorBanner text={tableError} /> : ranking.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">🗓️</div>
            <div className="empty-state-title">Ninguna ausencia registrada</div>
            <div className="empty-state-sub">No hay citas marcadas como ausencia en este período.</div>
          </div>
        ) : (
          <div style={{ overflow: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: 'var(--green)', color: 'white' }}>
                  <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, whiteSpace: 'nowrap' }}>Paciente</th>
                  <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, whiteSpace: 'nowrap' }}>Teléfono</th>
                  <th style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 700, whiteSpace: 'nowrap' }}>Ausencias</th>
                  <th style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 700, whiteSpace: 'nowrap' }}>Cobradas</th>
                  <th style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 700, whiteSpace: 'nowrap' }}>Perdonadas</th>
                  <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, whiteSpace: 'nowrap' }}>Importe (€)</th>
                  <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, whiteSpace: 'nowrap' }}>Última ausencia</th>
                </tr>
              </thead>
              <tbody>
                {ranking.map((p, i) => (
                  <tr key={p.patient_id} style={{ background: i % 2 ? 'white' : 'var(--cream)' }}>
                    <td style={{ padding: '8px 12px', fontWeight: 600 }}>{p.nombre}</td>
                    <td style={{ padding: '8px 12px', color: p.telefono ? 'var(--body)' : 'var(--text-muted)', fontStyle: p.telefono ? 'normal' : 'italic' }}>
                      {p.telefono || '—'}
                    </td>
                    <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                      <span style={{ display: 'inline-block', minWidth: 22, padding: '2px 8px', borderRadius: 999, fontSize: 12, fontWeight: 700, background: '#fecdd3', border: '1px solid #f87171', color: '#7f1d1d' }}>
                        {p.total}
                      </span>
                    </td>
                    <td style={{ padding: '8px 12px', textAlign: 'center' }}>{p.cobradas}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'center' }}>{p.perdonadas}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: 'var(--green)', whiteSpace: 'nowrap' }}>
                      {p.importe.toFixed(2)}€
                    </td>
                    <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>{fmtUltima(p.ultima)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  )
}
