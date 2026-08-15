// BotMovil — pantalla nueva, independiente del Bot Coach del panel, pensada
// para que la secretaria trabaje el bot de WhatsApp DESDE EL MÓVIL, a pantalla
// completa, "añadida a inicio" como PWA (ver public/manifest.webmanifest).
//
// Replica la app de WhatsApp: lista de chats → chat con burbujas → zona de
// trabajo abajo (propuesta pendiente del bot editable + envío libre). No
// reutiliza ni modifica BotCoach (src/App.jsx): es una pantalla nueva sobre
// las MISMAS tablas de Supabase.
//
// Props:
//   - sb: cliente Supabase ya inicializado, inyectado por el padre.
//   - botFetch(path, init): fetch al bot ya autenticado, inyectado por el padre.
//
// Datos (mismas tablas que Bot Coach):
//   - conversations: id, phone, patients(full_name), last_message_at.
//   - messages: id, direction, text, created_at, metadata — filtrado por
//     conversation_id para el hilo. Para el texto de previsualización de la
//     lista (que conversations no guarda) se leen los últimos mensajes de
//     TODAS las conversaciones y se queda con el más reciente de cada una;
//     si esa consulta falla, la lista sigue funcionando sin previsualización.
//   - bot_coach_reviews: id, conversation_id, proposed_text, category, con
//     verdict='pending' — la propuesta que el bot tiene lista para revisar.
//
// Acciones (botFetch, endpoints ya existentes en el bot):
//   - POST /send-validated  { review_id, verdict:'sent'|'modified', final_text, action_approved:true }
//   - POST /reject          { review_id, rejection_reason }
//   - POST /send-message    { chat_id, text, by:'secretaria' }
//   "Yo me ocupo" usa el mismo /reject (no hay endpoint propio en el contrato
//   de esta pantalla): descarta la propuesta con un motivo distinto, para que
//   quede registrado que la secretaria decidió llevarlo ella a mano. No hace
//   la limpieza extra de procesos automáticos que sí hace el takeover del
//   Bot Coach (pending_searches, wait_queue…) — eso no está en este contrato.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { fClock } from '../lib/datetime.js'

// ─── Paleta WhatsApp adaptada al verde del centro ─────────────────────────
const HEADER_BG = '#1d5c2e'
const THREAD_BG = '#efe7dd'
const BUBBLE_OUT = '#d9fdd3'
const BUBBLE_IN = '#ffffff'

// ─── Helpers ───────────────────────────────────────────────────────────────

// Construye el chat_id de whatsapp-web.js a partir de un teléfono guardado en
// BD (con o sin prefijo de país). No duplica el 34 si ya lo trae.
function toChatId(phone) {
  if (!phone) return null
  const digits = String(phone).replace(/\D/g, '')
  if (!digits) return null
  const withPrefix = digits.startsWith('34') ? digits : `34${digits}`
  return `${withPrefix}@c.us`
}

function initials(name) {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  const a = parts[0]?.[0] || ''
  const b = parts.length > 1 ? parts[1][0] : ''
  return (a + b).toUpperCase() || '?'
}

function truncate(text, max) {
  if (!text) return ''
  const oneLine = text.replace(/\s+/g, ' ').trim()
  return oneLine.length > max ? oneLine.slice(0, max - 1) + '…' : oneLine
}

// ─── Piezas pequeñas de UI ──────────────────────────────────────────────────

function Spinner() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 32 }}>
      <div style={{ width: 28, height: 28, border: '3px solid #cbd5c0', borderTopColor: HEADER_BG, borderRadius: '50%', animation: 'botMovilSpin .7s linear infinite' }} />
      <style>{'@keyframes botMovilSpin{to{transform:rotate(360deg)}}'}</style>
    </div>
  )
}

function ErrorBanner({ text, onRetry }) {
  return (
    <div style={{ margin: 12, fontSize: 15, color: '#7f1d1d', background: '#fecdd3', border: '1px solid #f87171', borderRadius: 8, padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
      <span>⚠️ {text}</span>
      {onRetry && (
        <button
          onClick={onRetry}
          style={{ minHeight: 36, padding: '4px 12px', border: '1px solid #f87171', borderRadius: 6, background: '#fff', color: '#7f1d1d', fontSize: 14, fontWeight: 600 }}
        >
          Reintentar
        </button>
      )}
    </div>
  )
}

export function BotMovil({ sb, botFetch }) {
  // ─── Lista de chats ────────────────────────────────────────────────────
  const [conversations, setConversations] = useState([])
  const [loadingList, setLoadingList] = useState(true)
  const [listError, setListError] = useState(null)
  const [previews, setPreviews] = useState({})       // conversation_id -> { text, direction }
  const [pendingReviews, setPendingReviews] = useState([])  // filas pending completas
  const [pendingByConv, setPendingByConv] = useState({})    // conversation_id -> nº pendientes
  const [search, setSearch] = useState('')

  // ─── Navegación lista / chat ───────────────────────────────────────────
  const [view, setView] = useState('list')            // 'list' | 'chat'
  const [selectedConv, setSelectedConv] = useState(null)

  // ─── Hilo del chat abierto ─────────────────────────────────────────────
  const [messages, setMessages] = useState([])
  const [loadingThread, setLoadingThread] = useState(false)
  const [threadError, setThreadError] = useState(null)

  // ─── Zona de trabajo (propuesta + texto libre) ────────────────────────
  const [proposalDraft, setProposalDraft] = useState('')
  const [acting, setActing] = useState(false)
  const [actionError, setActionError] = useState(null)
  const [freeText, setFreeText] = useState('')
  const [sendingFree, setSendingFree] = useState(false)

  const selectedConvIdRef = useRef(null)
  useEffect(() => { selectedConvIdRef.current = selectedConv?.id || null }, [selectedConv])

  // ─── Carga: conversaciones ─────────────────────────────────────────────
  const loadConversations = useCallback(async () => {
    setLoadingList(true); setListError(null)
    try {
      const { data, error } = await sb.from('conversations')
        .select('id, phone, patients(full_name), last_message_at')
        .order('last_message_at', { ascending: false })
        .limit(60)
      if (error) throw error
      setConversations(data || [])
    } catch (e) {
      setListError(e?.message || 'No se pudieron cargar las conversaciones')
    } finally {
      setLoadingList(false)
    }
  }, [sb])

  // Previsualización del último mensaje por conversación. conversations no
  // guarda el texto, así que se deduce de los últimos mensajes globales. Si
  // falla, la lista sigue mostrando nombre + hora sin más.
  const loadPreviews = useCallback(async () => {
    try {
      const { data, error } = await sb.from('messages')
        .select('conversation_id, text, direction, created_at')
        .order('created_at', { ascending: false })
        .limit(300)
      if (error) throw error
      const map = {}
      for (const m of (data || [])) {
        if (!map[m.conversation_id]) map[m.conversation_id] = m
      }
      setPreviews(map)
    } catch {
      // No crítico: sin previsualización, la lista sigue siendo usable.
    }
  }, [sb])

  const loadPendingReviews = useCallback(async () => {
    try {
      const { data, error } = await sb.from('bot_coach_reviews')
        // `proposed_action` es imprescindible: el bot solo ejecuta la acción si
        // recibe final_action Y action_approved. Sin ella se enviaría el texto
        // pero la cita no se confirmaría/cancelaría nunca.
        .select('id, conversation_id, proposed_text, proposed_action, category')
        .eq('verdict', 'pending')
      if (error) throw error
      setPendingReviews(data || [])
      const counts = {}
      for (const r of (data || [])) counts[r.conversation_id] = (counts[r.conversation_id] || 0) + 1
      setPendingByConv(counts)
    } catch {
      // No crítico: sin esto solo se pierden las burbujas de "pendiente".
    }
  }, [sb])

  const loadThread = useCallback(async (convId) => {
    if (!convId) { setMessages([]); return }
    setLoadingThread(true); setThreadError(null)
    try {
      const { data, error } = await sb.from('messages')
        .select('id, direction, text, created_at, metadata')
        .eq('conversation_id', convId)
        .order('created_at', { ascending: true })
        .limit(100)
      if (error) throw error
      setMessages(data || [])
    } catch (e) {
      setThreadError(e?.message || 'No se pudo cargar la conversación')
    } finally {
      setLoadingThread(false)
    }
  }, [sb])

  useEffect(() => {
    loadConversations()
    loadPreviews()
    loadPendingReviews()
  }, [loadConversations, loadPreviews, loadPendingReviews])

  // Realtime: como en Bot Coach, para que la secretaria vea mensajes y
  // propuestas nuevas sin tener que tirar de "pull to refresh".
  useEffect(() => {
    const channel = sb.channel('bot-movil-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations' }, () => {
        loadConversations()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, (payload) => {
        loadPreviews()
        const cid = payload?.new?.conversation_id || payload?.old?.conversation_id
        if (cid && cid === selectedConvIdRef.current) loadThread(cid)
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bot_coach_reviews' }, () => {
        loadPendingReviews()
      })
      .subscribe()
    return () => { sb.removeChannel(channel) }
  }, [sb, loadConversations, loadPreviews, loadPendingReviews, loadThread])

  // ─── Navegación ────────────────────────────────────────────────────────
  const openConversation = (conv) => {
    setSelectedConv(conv)
    setView('chat')
    setActionError(null)
    setFreeText('')
    loadThread(conv.id)
  }

  const goBack = () => {
    setView('list')
    setSelectedConv(null)
    setMessages([])
    setActionError(null)
  }

  // Abre siempre abajo del todo, como WhatsApp: al abrir el chat y al llegar
  // mensajes nuevos. requestAnimationFrame para esperar a que React ya haya
  // pintado las burbujas (si no, scrollHeight es el de antes).
  const threadBoxRef = useRef(null)
  useEffect(() => {
    const box = threadBoxRef.current
    if (!box) return
    const id = requestAnimationFrame(() => { box.scrollTop = box.scrollHeight })
    return () => cancelAnimationFrame(id)
  }, [selectedConv, messages.length])

  const pendingForSelected = useMemo(() => {
    if (!selectedConv) return null
    return pendingReviews.find(r => r.conversation_id === selectedConv.id) || null
  }, [pendingReviews, selectedConv])

  useEffect(() => {
    setProposalDraft(pendingForSelected?.proposed_text || '')
  }, [pendingForSelected])

  // ─── Acciones ──────────────────────────────────────────────────────────
  const sendProposal = async () => {
    if (!pendingForSelected) return
    setActing(true); setActionError(null)
    try {
      const finalText = proposalDraft.trim()
      const verdict = finalText === (pendingForSelected.proposed_text || '').trim() ? 'sent' : 'modified'
      // final_action + action_approved van SIEMPRE juntos: el bot ejecuta la
      // acción solo si recibe las dos. Si la propuesta no traía acción, se aprueba
      // solo el texto (action_approved=false), que es lo correcto.
      const accion = pendingForSelected.proposed_action || null
      const r = await botFetch('/send-validated', {
        method: 'POST',
        body: JSON.stringify({
          review_id: pendingForSelected.id,
          verdict,
          final_text: finalText,
          final_action: accion,
          action_approved: !!accion,
          reviewed_by: 'secretaria',
        }),
      })
      if (!r.ok) throw new Error(await r.text().catch(() => 'fallo al enviar'))
      // El bot responde 200 con { ok:false } si la review ya fue procesada.
      const out = await r.json().catch(() => ({ ok: true }))
      if (out && out.ok === false) throw new Error(out.error || 'no se pudo enviar')
      await loadPendingReviews()
      await loadThread(selectedConv.id)
    } catch (e) {
      setActionError(e?.message || 'No se pudo enviar la propuesta')
    } finally {
      setActing(false)
    }
  }

  const rejectPendingWithReason = async (reason) => {
    if (!pendingForSelected) return
    setActing(true); setActionError(null)
    try {
      // El endpoint real del bot es /reject-proposal (no /reject) y espera
      // { review_id, reviewed_by }. Verificado contra src/http/server.js y contra
      // cómo rechaza el Bot Coach de escritorio.
      const r = await botFetch('/reject-proposal', {
        method: 'POST',
        body: JSON.stringify({ review_id: pendingForSelected.id, reviewed_by: 'secretaria', rejection_reason: reason }),
      })
      if (!r.ok) throw new Error(await r.text().catch(() => 'fallo al rechazar'))
      // El bot responde 200 con { ok:false, error } cuando la review ya no está
      // pending: sin esto diríamos "rechazada" sin haber rechazado nada.
      const out = await r.json().catch(() => ({ ok: true }))
      if (out && out.ok === false) throw new Error(out.error || 'no se pudo rechazar')
      await loadPendingReviews()
    } catch (e) {
      setActionError(e?.message || 'No se pudo rechazar la propuesta')
    } finally {
      setActing(false)
    }
  }

  const rejectProposal = () => rejectPendingWithReason('Rechazada desde Bot móvil')
  const takeover = () => rejectPendingWithReason('Yo me ocupo (secretaria, desde Bot móvil)')

  const sendFreeText = async () => {
    const text = freeText.trim()
    if (!text || !selectedConv) return
    const chatId = toChatId(selectedConv.phone)
    if (!chatId) { setActionError('Este chat no tiene un teléfono válido'); return }
    setSendingFree(true); setActionError(null)
    try {
      const r = await botFetch('/send-message', {
        method: 'POST',
        body: JSON.stringify({ chat_id: chatId, text, by: 'secretaria' }),
      })
      if (!r.ok) throw new Error(await r.text().catch(() => 'fallo al enviar'))
      setFreeText('')
      await loadThread(selectedConv.id)
    } catch (e) {
      setActionError(e?.message || 'No se pudo enviar el mensaje')
    } finally {
      setSendingFree(false)
    }
  }

  const filteredConversations = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return conversations
    return conversations.filter(c => {
      const name = (c.patients?.full_name || '').toLowerCase()
      const phone = String(c.phone || '')
      return name.includes(q) || phone.includes(q)
    })
  }, [conversations, search])

  // ─── Estilos base (inline: esta pantalla no toca App.css) ─────────────
  const screenStyle = {
    position: 'fixed', inset: 0, height: '100dvh', width: '100%',
    display: 'flex', flexDirection: 'column', overflow: 'hidden',
    background: THREAD_BG, fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  }
  const headerStyle = {
    background: HEADER_BG, color: '#fff', flexShrink: 0,
    paddingTop: 'calc(env(safe-area-inset-top) + 12px)',
    paddingLeft: 'calc(env(safe-area-inset-left) + 14px)',
    paddingRight: 'calc(env(safe-area-inset-right) + 14px)',
    paddingBottom: 12,
  }

  // ─── Vista: lista de chats ──────────────────────────────────────────────
  if (view === 'list') {
    return (
      <div style={screenStyle}>
        <div style={headerStyle}>
          <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 10 }}>Anantara</div>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar paciente o teléfono"
            style={{
              width: '100%', boxSizing: 'border-box', fontSize: 16, minHeight: 44,
              border: 'none', borderRadius: 10, padding: '0 14px',
              background: 'rgba(255,255,255,0.16)', color: '#fff', outline: 'none',
            }}
          />
        </div>

        <div style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
          {loadingList ? <Spinner /> : listError ? (
            <ErrorBanner text={listError} onRetry={loadConversations} />
          ) : filteredConversations.length === 0 ? (
            <div style={{ padding: 32, textAlign: 'center', color: '#6b7d6f', fontSize: 15 }}>
              {search ? 'Ninguna conversación coincide con la búsqueda.' : 'No hay conversaciones todavía.'}
            </div>
          ) : (
            filteredConversations.map(c => {
              const name = c.patients?.full_name || c.phone || 'Sin nombre'
              const prev = previews[c.id]
              const pendingCount = pendingByConv[c.id] || 0
              return (
                <button
                  key={c.id}
                  onClick={() => openConversation(c)}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                    padding: '12px 14px', minHeight: 64, background: '#fff',
                    border: 'none', borderBottom: '1px solid #eee', textAlign: 'left', cursor: 'pointer',
                  }}
                >
                  <div style={{
                    width: 46, height: 46, borderRadius: '50%', flexShrink: 0,
                    background: HEADER_BG, color: '#fff', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', fontSize: 16, fontWeight: 700,
                  }}>
                    {initials(name)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                      <span style={{ fontSize: 16, fontWeight: 600, color: '#111b21', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {name}
                      </span>
                      <span style={{ fontSize: 12, color: '#6b7d6f', flexShrink: 0 }}>
                        {c.last_message_at ? fClock(c.last_message_at) : ''}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginTop: 3 }}>
                      <span style={{ fontSize: 15, color: '#667781', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {prev ? `${prev.direction === 'out' ? 'Tú: ' : ''}${truncate(prev.text, 42)}` : ' '}
                      </span>
                      {pendingCount > 0 && (
                        <span style={{
                          flexShrink: 0, minWidth: 22, height: 22, borderRadius: 11, background: '#25d366',
                          color: '#fff', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center',
                          justifyContent: 'center', padding: '0 6px',
                        }}>
                          {pendingCount}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              )
            })
          )}
        </div>
      </div>
    )
  }

  // ─── Vista: chat ─────────────────────────────────────────────────────────
  const name = selectedConv?.patients?.full_name || selectedConv?.phone || 'Sin nombre'

  return (
    <div style={screenStyle}>
      <div style={{ ...headerStyle, display: 'flex', alignItems: 'center', gap: 10, paddingBottom: 12 }}>
        <button
          onClick={goBack}
          aria-label="Volver a la lista de chats"
          style={{ width: 44, height: 44, flexShrink: 0, background: 'transparent', border: 'none', color: '#fff', fontSize: 24, cursor: 'pointer' }}
        >
          ←
        </button>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 17, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)' }}>{selectedConv?.phone || ''}</div>
        </div>
      </div>

      <div ref={threadBoxRef} style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch', padding: '10px 0' }}>
        {loadingThread ? <Spinner /> : threadError ? (
          <ErrorBanner text={threadError} onRetry={() => loadThread(selectedConv.id)} />
        ) : messages.length === 0 ? (
          <div style={{ padding: 32, textAlign: 'center', color: '#6b7d6f', fontSize: 15 }}>Sin mensajes todavía.</div>
        ) : (
          messages.map(m => {
            const mine = m.direction === 'out'
            return (
              <div key={m.id} style={{ display: 'flex', justifyContent: mine ? 'flex-end' : 'flex-start', padding: '2px 10px' }}>
                <div style={{
                  maxWidth: '80%', background: mine ? BUBBLE_OUT : BUBBLE_IN, borderRadius: 10,
                  padding: '8px 10px', boxShadow: '0 1px 1px rgba(0,0,0,0.1)',
                }}>
                  <div style={{ fontSize: 15, lineHeight: 1.35, color: '#111b21', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                    {m.text}
                  </div>
                  <div style={{ fontSize: 11, color: '#667781', textAlign: 'right', marginTop: 4 }}>
                    {fClock(m.created_at)}
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Zona de trabajo de la secretaria */}
      <div style={{
        flexShrink: 0, background: '#f0f0f0', borderTop: '1px solid #ddd',
        paddingLeft: 'calc(env(safe-area-inset-left) + 10px)',
        paddingRight: 'calc(env(safe-area-inset-right) + 10px)',
        paddingBottom: 'calc(env(safe-area-inset-bottom) + 10px)',
        paddingTop: 10,
      }}>
        {actionError && <ErrorBanner text={actionError} />}

        {pendingForSelected && (
          <div style={{ background: '#fff', border: '1px solid #d6d6d6', borderRadius: 10, padding: 10, marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: HEADER_BG, textTransform: 'uppercase', letterSpacing: 0.3 }}>
                Propuesta del bot
              </span>
              {pendingForSelected.category && (
                <span style={{ fontSize: 11, color: '#6b7d6f', background: '#eef3ec', borderRadius: 999, padding: '2px 8px' }}>
                  {pendingForSelected.category}
                </span>
              )}
            </div>
            <textarea
              value={proposalDraft}
              onChange={e => setProposalDraft(e.target.value)}
              rows={3}
              style={{
                width: '100%', boxSizing: 'border-box', fontSize: 16, fontFamily: 'inherit',
                border: '1px solid #ddd', borderRadius: 8, padding: 10, resize: 'vertical',
              }}
            />
            <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
              <button
                onClick={sendProposal}
                disabled={acting || !proposalDraft.trim()}
                style={{ minHeight: 44, flex: '1 1 auto', background: HEADER_BG, color: '#fff', border: 'none', borderRadius: 8, fontSize: 15, fontWeight: 700, padding: '0 14px', opacity: acting ? 0.6 : 1 }}
              >
                Enviar
              </button>
              <button
                onClick={rejectProposal}
                disabled={acting}
                style={{ minHeight: 44, flex: '1 1 auto', background: '#fff', color: '#b91c1c', border: '1px solid #f87171', borderRadius: 8, fontSize: 15, fontWeight: 700, padding: '0 14px', opacity: acting ? 0.6 : 1 }}
              >
                Rechazar
              </button>
              <button
                onClick={takeover}
                disabled={acting}
                style={{ minHeight: 44, flex: '1 1 auto', background: '#fff', color: '#374151', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 15, fontWeight: 700, padding: '0 14px', opacity: acting ? 0.6 : 1 }}
              >
                Yo me ocupo
              </button>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            type="text"
            value={freeText}
            onChange={e => setFreeText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !sendingFree) sendFreeText() }}
            placeholder="Escribe un mensaje"
            style={{
              flex: 1, minHeight: 44, fontSize: 16, border: '1px solid #ddd', borderRadius: 22,
              padding: '0 16px', boxSizing: 'border-box',
            }}
          />
          <button
            onClick={sendFreeText}
            disabled={sendingFree || !freeText.trim()}
            aria-label="Enviar mensaje"
            style={{
              width: 44, height: 44, flexShrink: 0, borderRadius: '50%', border: 'none',
              background: HEADER_BG, color: '#fff', fontSize: 18, opacity: (sendingFree || !freeText.trim()) ? 0.6 : 1,
            }}
          >
            ➤
          </button>
        </div>
      </div>
    </div>
  )
}
