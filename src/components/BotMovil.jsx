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
//   - conversations: id, phone, patient_id, patients(id, full_name), last_message_at.
//     El id del paciente hace falta para crear acciones desde el chat.
//   - messages: id, direction, text, created_at, metadata — filtrado por
//     conversation_id para el hilo. Para el texto de previsualización de la
//     lista (que conversations no guarda) se leen los últimos mensajes de
//     TODAS las conversaciones y se queda con el más reciente de cada una;
//     si esa consulta falla, la lista sigue funcionando sin previsualización.
//   - bot_coach_reviews: id, conversation_id, proposed_text, category, con
//     verdict='pending' — la propuesta que el bot tiene lista para revisar.
//
// Acciones (botFetch, endpoints ya existentes en el bot):
//   - POST /send-validated  { review_id, verdict, final_text, final_action, action_approved, reviewed_by }
//   - POST /reject-proposal { review_id, reviewed_by, rejection_reason }
//   - POST /send-message    { chat_id, text, by:'secretaria' }
//
//   OJO: el endpoint de rechazo es /reject-proposal. NO existe /reject — usarlo
//   da 404 en silencio (pasó al crear esta pantalla).
//   final_action y action_approved van SIEMPRE juntos: sin final_action el bot
//   envía el texto pero NO ejecuta la acción, y la cita se queda sin tocar.
//
//   "Yo me ocupo" usa /reject-proposal con un motivo distinto, para que quede
//   registrado que la secretaria lo lleva a mano. No hace la limpieza extra de
//   procesos automáticos del takeover de Bot Coach (pending_searches, wait_queue…).

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { fClock } from '../lib/datetime.js'
import { describeProposedAction, isDestructiveAction, actionLookupId } from '../lib/proposedAction.js'
import { quickRepliesFor } from '../lib/quickReplies.js'
import { ActionEditorModal } from './ActionEditorModal.jsx'
import { conversationPayloadFor } from '../lib/newConversation.js'

// ─── Paleta WhatsApp adaptada al verde del centro ─────────────────────────
// Súbelo a mano en cada cambio visible de esta pantalla. Se muestra junto al
// título para saber qué build tiene el móvil sin adivinar.
const BUILD = 'v11'

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

  // ─── Nueva conversación (capa "nuevo chat" estilo WhatsApp) ────────────
  const [newChatOpen, setNewChatOpen] = useState(false)
  const [newChatQuery, setNewChatQuery] = useState('')
  const [newChatResults, setNewChatResults] = useState([])
  const [newChatSearching, setNewChatSearching] = useState(false)
  const [newChatError, setNewChatError] = useState(null)
  const [creatingPatientId, setCreatingPatientId] = useState(null)

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
  const [actionDesc, setActionDesc] = useState(null)          // tarjeta de la acción propuesta (ver proposedAction.js)
  // Acción corregida o creada por la secretaria. Si está puesta, manda sobre la
  // que propuso el bot (o la crea desde cero si el bot no propuso ninguna).
  const [overrideAction, setOverrideAction] = useState(null)
  const [actionEditorOpen, setActionEditorOpen] = useState(false)
  const [services, setServices] = useState([])
  const [professionals, setProfessionals] = useState([])
  const [manualMode, setManualMode] = useState(false)          // true: fuerza la caja de texto libre aunque haya propuesta pendiente
  const [confirmDelete, setConfirmDelete] = useState(false)    // confirmación propia de borrado (nunca window.confirm)
  const [deletingConv, setDeletingConv] = useState(false)

  const selectedConvIdRef = useRef(null)
  useEffect(() => { selectedConvIdRef.current = selectedConv?.id || null }, [selectedConv])

  // CADENA DE ALTURAS. `html`, `body` y `#root` no tenían altura en el CSS del
  // panel, así que esta pantalla tenía que anclarse con posición fija y medir
  // contra el viewport — que en el móvil, y sobre todo instalada como PWA, no
  // coincide con lo que se ve. De ahí las franjas muertas al final.
  //
  // Con la cadena `height:100%` desde html hasta #root, la pantalla ocupa la
  // caja real del documento y no hay nada que pueda asomar por debajo. Es el
  // patrón fiable para pantalla completa; el posicionamiento fijo no lo es.
  // Se revierte al salir para no dejar tocado el panel normal.
  useEffect(() => {
    const style = document.createElement('style')
    style.setAttribute('data-bot-movil', '')
    style.textContent = `
      html, body, #root { height: 100%; height: 100dvh; margin: 0; overflow: hidden; }
      body { background: #fff; overscroll-behavior: none; }
    `
    document.head.appendChild(style)

    return () => {
      style.remove()
    }
  }, [])

  // ─── Carga: conversaciones ─────────────────────────────────────────────
  const loadConversations = useCallback(async () => {
    setLoadingList(true); setListError(null)
    try {
      const { data, error } = await sb.from('conversations')
        .select('id, phone, patient_id, patients(id, full_name), last_message_at')
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
    setConfirmDelete(false)
    setManualMode(false)
    loadThread(conv.id)
  }

  const goBack = () => {
    setView('list')
    setSelectedConv(null)
    setMessages([])
    setActionError(null)
    setConfirmDelete(false)
    setManualMode(false)
  }

  // Salida al panel normal (problema 2): el arquitecto lee `?page=bot-movil` al
  // arrancar, así que navegar a la raíz vuelve al panel de Marta.
  const exitToPanel = () => {
    window.location.href = '/'
  }

  // ─── Nueva conversación ────────────────────────────────────────────────
  const openNewChat = () => {
    setNewChatOpen(true)
    setNewChatQuery('')
    setNewChatResults([])
    setNewChatError(null)
  }

  const closeNewChat = () => {
    setNewChatOpen(false)
    setNewChatQuery('')
    setNewChatResults([])
    setNewChatError(null)
    setCreatingPatientId(null)
  }

  // Busca pacientes según se escribe (mínimo 2 caracteres, ~300ms de retardo
  // para no lanzar una consulta por tecla) — mismo patrón que Bot Coach
  // (App.jsx, buscador de "Nueva conversación").
  useEffect(() => {
    const q = newChatQuery.trim()
    if (q.length < 2) { setNewChatResults([]); setNewChatSearching(false); return }
    setNewChatSearching(true)
    const t = setTimeout(async () => {
      try {
        const { data, error } = await sb.from('patients')
          .select('id, full_name, phone')
          .or(`full_name.ilike.%${q}%,phone.ilike.%${q}%`)
          .limit(6)
        if (error) throw error
        setNewChatResults(data || [])
      } catch {
        setNewChatResults([])
      } finally {
        setNewChatSearching(false)
      }
    }, 300)
    return () => clearTimeout(t)
  }, [newChatQuery, sb])

  // Crea (o recupera, si ya existía) la conversación del paciente y la abre
  // directamente. OJO: la crea el BOT vía /ensure-conversation — el panel no
  // puede insertar en `conversations` por permisos (RLS). Mismo flujo que
  // `startConversation` en App.jsx.
  const startNewConversation = async (patient) => {
    const payload = conversationPayloadFor(patient)
    if (!payload) { setNewChatError('Ese paciente no tiene teléfono válido'); return }
    setCreatingPatientId(patient.id); setNewChatError(null)
    try {
      const r = await botFetch('/ensure-conversation', {
        method: 'POST',
        body: JSON.stringify({ phone: payload.phone, patient_id: payload.patient_id }),
      })
      if (!r.ok) throw new Error(await r.text().catch(() => 'fallo al crear la conversación'))
      const { conversation_id } = await r.json()
      if (!conversation_id) throw new Error('El bot no devolvió la conversación')
      const { data, error } = await sb.from('conversations')
        .select('id, phone, patient_id, patients(id, full_name), last_message_at')
        .eq('id', conversation_id)
        .maybeSingle()
      if (error) throw error
      closeNewChat()
      await loadConversations()
      openConversation(data || { id: conversation_id, phone: payload.phone, patients: { full_name: patient.full_name } })
    } catch (e) {
      setNewChatError(e?.message || 'No se pudo crear la conversación')
    } finally {
      setCreatingPatientId(null)
    }
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
    setManualMode(false)
  }, [pendingForSelected])

  // Resuelve la tarjeta de la acción propuesta (icono, etiqueta, día/hora/profesional),
  // igual que Bot Coach (ver src/lib/proposedAction.js): si el tipo depende de un id
  // (cancelar_cita, confirmar_propuesta…) se busca la cita en `appointments`; si no
  // se encuentra, se marca `unresolved` y NUNCA se inventa la identidad de la cita.
  useEffect(() => {
    const act = pendingForSelected?.proposed_action
    if (!act) { setActionDesc(null); return }
    const patientName = selectedConv?.patients?.full_name || act.patient_name || null
    let cancelled = false
    ;(async () => {
      const apptId = actionLookupId(act)
      let appt = null
      if (apptId) {
        const { data } = await sb.from('appointments')
          .select('id, starts_at, status, professionals(name), services(name, duration_minutes)')
          .eq('id', apptId).maybeSingle()
        appt = data || null
      }
      if (cancelled) return
      setActionDesc(describeProposedAction(act, { patientName, appt }))
    })()
    return () => { cancelled = true }
  }, [pendingForSelected?.id, pendingForSelected?.proposed_action, selectedConv, sb])

  // Solo UNA caja de texto activa a la vez (problema 3): si hay propuesta pendiente
  // y la secretaria no ha pedido explícitamente escribir otro mensaje, se ve el
  // borrador; si no, la caja libre.
  const showProposalBox = !!pendingForSelected && !manualMode

  // Catálogo para el editor de acciones. Una vez, al montar.
  useEffect(() => {
    let vivo = true
    ;(async () => {
      try {
        const [sv, pr] = await Promise.all([
          sb.from('services').select('id, name, section, duration_minutes').order('name'),
          sb.from('professionals').select('id, name').order('name'),
        ])
        if (!vivo) return
        setServices(sv.data || [])
        setProfessionals(pr.data || [])
      } catch { /* el editor avisará si faltan datos */ }
    })()
    return () => { vivo = false }
  }, [sb])

  // La corrección es de ESTA propuesta: al cambiar de chat o de propuesta, fuera.
  useEffect(() => { setOverrideAction(null); setActionEditorOpen(false) }, [selectedConv?.id, pendingForSelected?.id])

  // Paciente para el editor. Sin id no se puede construir ninguna acción.
  const pacienteActual = useMemo(() => ({
    id: selectedConv?.patients?.id || selectedConv?.patient_id || null,
    full_name: selectedConv?.patients?.full_name || null,
    phone: selectedConv?.phone || null,
  }), [selectedConv])

  // Acción creada por la secretaria SIN que el bot propusiera nada. No hay review
  // que aprobar, así que /send-validated no sirve: el bot crea una review
  // sintética y la pasa por el mismo camino gateado.
  const sendSecretaryAction = async () => {
    if (!selectedConv || !overrideAction) return
    setActing(true); setActionError(null)
    try {
      // El último mensaje del PACIENTE es la mitad izquierda del par de
      // entrenamiento: "esto escribió → esta era la acción correcta".
      const ultimoEntrante = [...messages].reverse().find(m => m.direction === 'in')
      const r = await botFetch('/secretary-action', {
        method: 'POST',
        body: JSON.stringify({
          phone: selectedConv.phone,
          text: proposalDraft.trim() || freeText.trim() || null,
          action: overrideAction,
          patient_message: ultimoEntrante?.text || null,
          reviewed_by: 'secretaria',
        }),
      })
      if (!r.ok) throw new Error(await r.text().catch(() => 'fallo al ejecutar'))
      const out = await r.json().catch(() => ({ ok: true }))
      if (out && out.ok === false) throw new Error(out.error || 'no se pudo ejecutar')
      setOverrideAction(null); setProposalDraft(''); setFreeText('')
      await loadPendingReviews()
      await loadThread(selectedConv.id)
    } catch (e) {
      setActionError(e?.message || 'No se pudo ejecutar la acción')
    } finally {
      setActing(false)
    }
  }

  // ─── Acciones ──────────────────────────────────────────────────────────
  const sendProposal = async () => {
    if (!pendingForSelected) return
    setActing(true); setActionError(null)
    try {
      const finalText = proposalDraft.trim()
      // Si Marta corrigió la acción, el veredicto es 'modified' aunque el texto
      // no haya cambiado: lo que cambió es lo que se va a EJECUTAR.
      const textoIgual = finalText === (pendingForSelected.proposed_text || '').trim()
      const verdict = (textoIgual && !overrideAction) ? 'sent' : 'modified'
      // final_action + action_approved van SIEMPRE juntos: el bot ejecuta la
      // acción solo si recibe las dos. Si la propuesta no traía acción, se aprueba
      // solo el texto (action_approved=false), que es lo correcto.
      const accion = overrideAction || pendingForSelected.proposed_action || null
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

  // Borra la conversación y su historial (problema 5): primero las reviews de esa
  // conversación, luego la conversación (los mensajes caen por CASCADE) — mismo
  // orden que usa Bot Coach. La confirmación es el overlay propio de la cabecera
  // del chat, nunca window.confirm.
  const deleteConversation = async () => {
    if (!selectedConv) return
    setDeletingConv(true); setActionError(null)
    try {
      await sb.from('bot_coach_reviews').delete().eq('conversation_id', selectedConv.id)
      const { error } = await sb.from('conversations').delete().eq('id', selectedConv.id)
      if (error) throw error
      setConfirmDelete(false)
      goBack()
      loadConversations()
      loadPendingReviews()
    } catch (e) {
      setConfirmDelete(false)
      setActionError(e?.message || 'No se pudo borrar la conversación')
    } finally {
      setDeletingConv(false)
    }
  }

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
  // `inset:0` ya fija top/right/bottom/left a 0, así que el contenedor ocupa
  // SIEMPRE el viewport real, incluso cuando la barra de direcciones del móvil
  // aparece o desaparece. Fijar ADEMÁS `height:100dvh` sobre-restringe el cálculo
  // CSS (top + height + bottom, los tres fijados a la vez): el navegador ignora
  // `bottom:0` para respetar `height`, y si 100dvh no coincide exactamente con el
  // viewport visible en ese momento, queda un hueco muerto abajo (problema 4).
  // Sin `height` explícita, `bottom:0` manda y el hueco desaparece.
  // Flujo normal con altura del 100% del padre (ver la cadena de alturas de
  // arriba). Nada de posición fija: era lo que dejaba las franjas al final,
  // porque medía contra un viewport que en PWA no es el que se ve.
  // Fondo BLANCO, no beige. El beige lo pinta el hilo por su cuenta.
  // Motivo: cualquier franja que quede al final —por safe-area, por el viewport
  // del PWA o por lo que sea— sale del contenedor o del documento. Si ambos son
  // blancos como la barra de trabajo, esa franja es invisible. Perseguir el
  // origen exacto costó cuatro intentos; garantizar el color, uno.
  const screenStyle = {
    height: '100%', width: '100%',
    display: 'flex', flexDirection: 'column', overflow: 'hidden',
    background: '#fff', fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
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
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 10 }}>
            {/* Marca de versión. El PWA cachea con ganas y hemos perdido varias
                rondas discutiendo sobre builds distintos: con esto se ve de un
                vistazo si el móvil tiene la última o una vieja. */}
            <div style={{ fontSize: 20, fontWeight: 700, display: 'flex', alignItems: 'baseline', gap: 8 }}>
              Anantara
              <span style={{ fontSize: 11, fontWeight: 400, color: 'rgba(255,255,255,0.65)' }}>{BUILD}</span>
            </div>
            <button
              onClick={exitToPanel}
              style={{
                minHeight: 36, background: 'rgba(255,255,255,0.16)', color: '#fff', border: 'none',
                borderRadius: 8, fontSize: 13, fontWeight: 600, padding: '0 12px', cursor: 'pointer',
              }}
            >
              ← Salir al panel
            </button>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar paciente o teléfono"
              style={{
                flex: 1, minWidth: 0, boxSizing: 'border-box', fontSize: 16, minHeight: 44,
                border: 'none', borderRadius: 10, padding: '0 14px',
                background: 'rgba(255,255,255,0.16)', color: '#fff', outline: 'none',
              }}
            />
            <button
              onClick={openNewChat}
              aria-label="Nueva conversación"
              title="Nueva conversación"
              style={{
                width: 44, height: 44, flexShrink: 0, borderRadius: '50%', border: 'none',
                background: 'rgba(255,255,255,0.16)', color: '#fff', fontSize: 22, fontWeight: 700,
                lineHeight: 1, cursor: 'pointer',
              }}
            >
              +
            </button>
          </div>
        </div>

        {newChatOpen && (
          <div style={{
            position: 'fixed', inset: 0, zIndex: 30, display: 'flex', flexDirection: 'column',
            background: THREAD_BG,
          }}>
            <div style={headerStyle}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <button
                  onClick={closeNewChat}
                  aria-label="Cerrar nueva conversación"
                  style={{ width: 44, height: 44, flexShrink: 0, marginLeft: -10, background: 'transparent', border: 'none', color: '#fff', fontSize: 24, cursor: 'pointer' }}
                >
                  ←
                </button>
                <div style={{ fontSize: 18, fontWeight: 700 }}>Nueva conversación</div>
              </div>
              <input
                type="text"
                autoFocus
                value={newChatQuery}
                onChange={e => setNewChatQuery(e.target.value)}
                placeholder="Buscar paciente o teléfono"
                style={{
                  width: '100%', boxSizing: 'border-box', fontSize: 16, minHeight: 44,
                  border: 'none', borderRadius: 10, padding: '0 14px',
                  background: 'rgba(255,255,255,0.16)', color: '#fff', outline: 'none',
                }}
              />
            </div>

            <div style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
              {newChatError && <ErrorBanner text={newChatError} />}
              {newChatQuery.trim().length < 2 ? (
                <div style={{ padding: 32, textAlign: 'center', color: '#6b7d6f', fontSize: 15 }}>
                  Escribe al menos 2 letras para buscar.
                </div>
              ) : newChatSearching ? (
                <Spinner />
              ) : newChatResults.length === 0 ? (
                <div style={{ padding: 32, textAlign: 'center', color: '#6b7d6f', fontSize: 15 }}>
                  Ningún paciente coincide.
                </div>
              ) : (
                newChatResults.map(p => {
                  const creating = creatingPatientId === p.id
                  return (
                    <button
                      key={p.id}
                      onClick={() => startNewConversation(p)}
                      disabled={creating}
                      style={{
                        width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                        padding: '12px 14px', minHeight: 64, background: '#fff',
                        border: 'none', borderBottom: '1px solid #eee', textAlign: 'left', cursor: 'pointer',
                        opacity: creating ? 0.6 : 1,
                      }}
                    >
                      <div style={{
                        width: 46, height: 46, borderRadius: '50%', flexShrink: 0,
                        background: HEADER_BG, color: '#fff', display: 'flex', alignItems: 'center',
                        justifyContent: 'center', fontSize: 16, fontWeight: 700,
                      }}>
                        {initials(p.full_name)}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 16, fontWeight: 600, color: '#111b21', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {p.full_name || 'Sin nombre'}
                        </div>
                        <div style={{ fontSize: 14, color: creating ? HEADER_BG : '#667781' }}>
                          {creating ? 'Creando conversación…' : (p.phone || 'Sin teléfono')}
                        </div>
                      </div>
                    </button>
                  )
                })
              )}
            </div>
          </div>
        )}

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
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 17, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)' }}>{selectedConv?.phone || ''}</div>
        </div>
        <button
          onClick={() => setConfirmDelete(true)}
          aria-label="Borrar conversación"
          title="Borrar conversación"
          style={{ width: 40, height: 40, flexShrink: 0, background: 'rgba(255,255,255,0.14)', border: 'none', borderRadius: 8, color: '#fff', fontSize: 17, cursor: 'pointer' }}
        >
          🗑
        </button>
      </div>

      {confirmDelete && (
        <div style={{
          position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 20,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
        }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 18, maxWidth: 320, width: '100%' }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#111b21', marginBottom: 8 }}>¿Borrar esta conversación?</div>
            <div style={{ fontSize: 14, color: '#4b5563', marginBottom: 16 }}>
              Se borra todo su historial y las propuestas pendientes de esta conversación. No se puede deshacer.
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => setConfirmDelete(false)}
                disabled={deletingConv}
                style={{ flex: 1, minHeight: 44, background: '#fff', color: '#374151', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 15, fontWeight: 600 }}
              >
                Cancelar
              </button>
              <button
                onClick={deleteConversation}
                disabled={deletingConv}
                style={{ flex: 1, minHeight: 44, background: '#dc2626', color: '#fff', border: 'none', borderRadius: 8, fontSize: 15, fontWeight: 700, opacity: deletingConv ? 0.6 : 1 }}
              >
                {deletingConv ? 'Borrando…' : 'Borrar'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div ref={threadBoxRef} style={{ flex: 1, minHeight: 0, overflowY: 'auto', WebkitOverflowScrolling: 'touch', padding: '10px 0', background: THREAD_BG }}>
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

      {/* Zona de trabajo de la secretaria.
          UNA sola superficie blanca: antes había franja gris + tarjeta blanca
          encima del hilo beige, y se veían tres fondos apilados con huecos
          muertos entre ellos. WhatsApp tiene una sola barra bajo el hilo. */}
      <div style={{
        flexShrink: 0, background: '#fff', borderTop: '1px solid #e2e2e2',
        paddingLeft: 'calc(env(safe-area-inset-left) + 10px)',
        paddingRight: 'calc(env(safe-area-inset-right) + 10px)',
        // 8px y punto. Antes llevaba `env(safe-area-inset-bottom)`, que en el
        // iPhone son ~34px de relleno VACÍO bajo los botones: ese era el hueco.
        // Josema lo quiere pegado abajo, no reservado para el indicador de inicio.
        paddingBottom: 8,
        paddingTop: 10,
      }}>
        {actionError && <ErrorBanner text={actionError} />}

        {/* Chips de respuesta rápida (src/lib/quickReplies.js), según la categoría de
            la propuesta pendiente (genéricas si no hay). Sustituyen el texto de la
            caja que esté activa en ese momento: borrador o mensaje libre. */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
          {quickRepliesFor(pendingForSelected ? pendingForSelected.category : null).map((qr, i) => (
            <button
              key={i}
              onClick={() => (showProposalBox ? setProposalDraft(qr) : setFreeText(qr))}
              style={{ padding: '5px 10px', borderRadius: 999, fontSize: 12, border: '1px solid #cbd5c0', background: '#fff', color: '#33403a', cursor: 'pointer' }}
            >
              {qr}
            </button>
          ))}
        </div>

        {/* Solo UNA caja de texto a la vez (problema 3): el borrador de la propuesta
            O el mensaje libre, nunca los dos juntos. */}
        {showProposalBox ? (
          // Sin fondo ni borde propios: la zona de trabajo YA es blanca, y una
          // tarjeta blanca sobre blanco solo añadía un recuadro sin función.
          // marginBottom 0: es el último elemento, y ese margen sumaba con el
          // relleno de la barra = 16px de blanco muerto bajo los botones.
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: HEADER_BG, textTransform: 'uppercase', letterSpacing: 0.3 }}>
                Propuesta del bot
              </span>
              {pendingForSelected.category && (
                <span style={{ fontSize: 11, color: '#6b7d6f', background: '#eef3ec', borderRadius: 999, padding: '2px 8px' }}>
                  {pendingForSelected.category}
                </span>
              )}
              <button
                onClick={() => setManualMode(true)}
                style={{ marginLeft: 'auto', fontSize: 12, color: HEADER_BG, background: 'none', border: 'none', textDecoration: 'underline', cursor: 'pointer', padding: 0 }}
              >
                escribir otro mensaje
              </button>
            </div>

            {/* Tarjeta de la acción propuesta (problema 1): qué cita toca, para que la
                secretaria no apruebe a ciegas. Mismo criterio que Bot Coach — ver
                src/lib/proposedAction.js. isDestructiveAction se calcula aparte de
                actionDesc para pintar en rojo desde el primer render, sin esperar al
                lookup async de la cita. */}
            {pendingForSelected.proposed_action ? (
              (() => {
                const destructive = isDestructiveAction(pendingForSelected.proposed_action)
                const unresolved = !!actionDesc?.unresolved
                const alert = destructive || unresolved
                const bg = alert ? '#fef2f2' : '#f0fdf4'
                const bd = alert ? '#fecaca' : '#bbf7d0'
                const ac = alert ? '#dc2626' : HEADER_BG
                return (
                  <div style={{ border: `1px solid ${bd}`, background: bg, borderRadius: 8, padding: '8px 10px', marginBottom: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 14 }}>{actionDesc?.icon || '⚙️'}</span>
                      <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: 0.3, textTransform: 'uppercase', color: ac }}>
                        {actionDesc?.label || pendingForSelected.proposed_action.type}
                      </span>
                      {destructive && (
                        <span style={{ fontSize: 10, fontWeight: 700, color: '#fff', background: ac, borderRadius: 999, padding: '1px 7px' }}>
                          acción real
                        </span>
                      )}
                    </div>
                    {unresolved
                      ? <div style={{ fontSize: 13, fontWeight: 600, color: '#dc2626' }}>⚠️ No se pudo resolver la cita. No apruebes sin verificar.</div>
                      : <div style={{ fontSize: 14, color: '#111b21' }}>{actionDesc?.line || '…'}</div>}
                    {actionDesc?.note && <div style={{ fontSize: 12, color: '#b45309', marginTop: 2 }}>⚠ {actionDesc.note}</div>}
                  </div>
                )
              })()
            ) : null}

            {/* Añadir / cambiar la acción. Sale SIEMPRE que haya chat abierto, no
                solo con propuesta pendiente: el caso en que más falta hace es justo
                cuando el bot no propuso nada (derivó o se calló). */}
            {overrideAction ? (
              <div style={{ border: '1px dashed #d97706', background: '#fef3c7', borderRadius: 8, padding: '8px 10px', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 13, color: '#92400e', fontWeight: 600 }}>✏️ Acción corregida a <strong>{overrideAction.type}</strong></span>
                <button onClick={() => { setOverrideAction(null); setProposalDraft(pendingForSelected?.proposed_text || '') }}
                  style={{ marginLeft: 'auto', minHeight: 36, padding: '4px 12px', fontSize: 13, border: '1px solid #92400e', background: '#fff', color: '#92400e', borderRadius: 8 }}>
                  Descartar
                </button>
              </div>
            ) : (
              // Una sola línea, sin wrap: con flexWrap el botón se iba solo a otra
              // fila y dejaba un hueco enorme a su izquierda. El texto se recorta
              // si no cabe; el botón nunca se encoge.
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span style={{ fontSize: 13, color: '#6b7d6f', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {pendingForSelected?.proposed_action ? '¿No es la acción correcta?' : 'Sin acción en la agenda'}
                </span>
                <button onClick={() => setActionEditorOpen(true)} disabled={!pacienteActual.id}
                  title={pacienteActual.id ? '' : 'Esta conversación no tiene paciente enlazado'}
                  style={{ marginLeft: 'auto', flexShrink: 0, height: 34, padding: '0 12px', fontSize: 13, fontWeight: 600, borderRadius: 17, border: `1px solid ${pacienteActual.id ? HEADER_BG : '#cbd5c0'}`, background: '#fff', color: pacienteActual.id ? HEADER_BG : '#9aa79c', whiteSpace: 'nowrap' }}>
                  {pendingForSelected?.proposed_action ? '✏️ Cambiar' : '✏️ Añadir acción'}
                </button>
              </div>
            )}

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
        ) : (
          <>
            {/* Sin propuesta del bot también se puede crear una acción: es justo
                donde más falta hace (el bot derivó o se calló y la agenda hay que
                tocarla igual). Se envía por /secretary-action. */}
            {overrideAction ? (
              <div style={{ border: '1px dashed #d97706', background: '#fef3c7', borderRadius: 8, padding: '8px 10px', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 13, color: '#92400e', fontWeight: 600 }}>✏️ Acción a ejecutar: <strong>{overrideAction.type}</strong></span>
                <button onClick={() => setOverrideAction(null)}
                  style={{ minHeight: 36, padding: '4px 12px', fontSize: 13, border: '1px solid #92400e', background: '#fff', color: '#92400e', borderRadius: 8 }}>
                  Quitar
                </button>
                <button onClick={sendSecretaryAction} disabled={acting}
                  style={{ marginLeft: 'auto', minHeight: 40, padding: '6px 14px', fontSize: 14, fontWeight: 700, border: 'none', background: HEADER_BG, color: '#fff', borderRadius: 8, opacity: acting ? 0.6 : 1 }}>
                  {acting ? 'Enviando…' : '✅ Enviar y ejecutar'}
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span style={{ fontSize: 13, color: '#6b7d6f', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  El bot no propuso nada
                </span>
                <button onClick={() => setActionEditorOpen(true)} disabled={!pacienteActual.id}
                  title={pacienteActual.id ? '' : 'Esta conversación no tiene paciente enlazado'}
                  style={{ marginLeft: 'auto', flexShrink: 0, height: 34, padding: '0 12px', fontSize: 13, fontWeight: 600, borderRadius: 17, border: `1px solid ${pacienteActual.id ? HEADER_BG : '#cbd5c0'}`, background: '#fff', color: pacienteActual.id ? HEADER_BG : '#9aa79c', whiteSpace: 'nowrap' }}>
                  ✏️ Añadir acción
                </button>
              </div>
            )}
            {actionError && <div style={{ fontSize: 13, color: '#7f1d1d', marginBottom: 8 }}>⚠️ {actionError}</div>}
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              type="text"
              value={freeText}
              onChange={e => setFreeText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !sendingFree) sendFreeText() }}
              placeholder={overrideAction ? 'Mensaje que acompaña a la acción' : 'Escribe un mensaje'}
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
          </>
        )}

        {pendingForSelected && !showProposalBox && (
          <button
            onClick={() => setManualMode(false)}
            style={{ marginTop: 8, fontSize: 12, color: HEADER_BG, background: 'none', border: 'none', textDecoration: 'underline', cursor: 'pointer', padding: 0 }}
          >
            ↩ volver a la propuesta del bot
          </button>
        )}
      </div>

      {/* Editor de acción — el MISMO componente que el panel de escritorio, para
          que no se separen los comportamientos. Se envuelve para que quepa en una
          pantalla estrecha y pueda hacer scroll dentro, sin tocar su fichero. */}
      {actionEditorOpen && pacienteActual.id && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 60, overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <div className="bot-movil-editor" style={{ minHeight: '100%' }}>
            <style>{`
              .bot-movil-editor .modal { max-width: 100% !important; width: 100% !important;
                border-radius: 0 !important; max-height: none !important; }
              .bot-movil-editor .modal-overlay { align-items: flex-start !important; padding: 0 !important; }
              .bot-movil-editor input, .bot-movil-editor select, .bot-movil-editor textarea { font-size: 16px !important; }
              @media (max-width: 480px) {
                .bot-movil-editor .modal [style*="grid-template-columns"] { grid-template-columns: 1fr !important; }
              }
            `}</style>
            <ActionEditorModal
              patient={pacienteActual}
              currentAction={overrideAction || pendingForSelected?.proposed_action || null}
              currentText={proposalDraft || freeText}
              services={services}
              professionals={professionals}
              sb={sb}
              botFetch={botFetch}
              onCancel={() => setActionEditorOpen(false)}
              onConfirm={(nuevaAccion, nuevoTexto) => {
                setOverrideAction(nuevaAccion)
                if (pendingForSelected) setProposalDraft(nuevoTexto)
                else setFreeText(nuevoTexto)
                setActionEditorOpen(false)
              }}
            />
          </div>
        </div>
      )}
    </div>
  )
}
