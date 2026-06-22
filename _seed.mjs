import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'

const env = readFileSync(new URL('../anantara-whatsapp/.env', import.meta.url), 'utf8')
const get = k => (env.match(new RegExp(`^${k}=(.*)$`, 'm'))?.[1] || '').trim()
const sb = createClient(get('SUPABASE_URL'), get('SUPABASE_SERVICE_KEY'), { auth: { persistSession: false } })

const pad = n => String(n).padStart(2, '0')
const localDT = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
const minsAgo = m => localDT(new Date(Date.now() - m*60000))

// ── Limpieza: borra lo marcado (_seed) + el residuo antiguo (34600111222) ──
if (process.argv.includes('clean')) {
  const { data: marked } = await sb.from('conversations').select('id').eq('fsm_data->>_seed', 'true')
  const { data: legacy } = await sb.from('conversations').select('id').eq('phone', '34600111222')
  const ids = [...(marked||[]), ...(legacy||[])].map(c => c.id)
  if (ids.length) {
    await sb.from('bot_coach_reviews').delete().in('conversation_id', ids)
    await sb.from('conversations').delete().in('id', ids) // messages caen por CASCADE
  }
  console.log('🧹 Limpiado. Conversaciones de prueba borradas:', ids.length)
} else {
await seed()
}

async function seed() {
// ── Semilla: una conversación por paciente (hasta 6) ──
const { data: patients } = await sb.from('patients').select('id,full_name,phone').limit(6)
if (!patients?.length) { console.log('❌ No hay pacientes para enganchar. Aborto.'); return }

const guiones = [
  { intent:'confirmar_cita', state:'esperando_confirmacion', pending:true,
    msgs:[['in','Hola, querría cita de osteopatía esta semana'],['out','¡Hola! 😊 Te ofrezco el viernes a las 10:00 con Marcos. ¿Te viene bien?'],['in','Sí, el viernes a las 10 me va genial']],
    propose:'Perfecto, te confirmo el viernes a las 10:00 con Marcos. ¡Te esperamos! 🌿', cat:'confirmacion' },
  { intent:'cancelar_cita', state:'gestionando_cancelacion', pending:true,
    msgs:[['in','Buenas, no voy a poder ir mañana'],['out','Vaya 🙁 ¿Quieres que la cancele o la movemos a otro día?'],['in','Cancélala mejor, ya pediré yo']],
    propose:'Hecho, te he cancelado la cita de mañana. Cuando quieras reservamos otra. 🌿', cat:'cancelacion' },
  { intent:'pedir_info', state:'idle', pending:false,
    msgs:[['in','¿Cuánto cuesta una sesión de osteopatía?'],['out','La consulta de osteopatía son 40€ la sesión 😊']] },
  { intent:'reservar_cita', state:'eligiendo_hueco', pending:true,
    msgs:[['in','Quiero pedir cita para yoga'],['out','¡Genial! Tenemos clases lunes y miércoles a las 19:00. ¿Cuál prefieres?'],['in','El miércoles']],
    propose:'Te apunto a la clase de yoga del miércoles a las 19:00. ¡Nos vemos! 🧘', cat:'otra' },
  { intent:'saludo', state:'idle', pending:false,
    msgs:[['in','Hola buenas'],['out','¡Hola! 😊 ¿En qué te puedo ayudar?'],['in','Nada, gracias']] },
  { intent:'pedir_info', state:'idle', pending:false,
    msgs:[['in','¿Hacéis depilación láser?'],['out','Sí 😊 ¿Quieres que te pase precios y huecos?']] },
]

let nConv = 0, nRev = 0
for (let i = 0; i < patients.length; i++) {
  const p = patients[i]
  const g = guiones[i % guiones.length]
  const convId = randomUUID()
  const base = 5 + i*7 // escalonar la actividad
  const c = await sb.from('conversations').insert({
    id: convId, phone: p.phone, patient_id: p.id,
    fsm_state: g.state, fsm_data: { _seed: true },
    last_message_at: minsAgo(base), last_intent: g.intent,
    created_at: minsAgo(base+30), updated_at: minsAgo(base),
  }).select('id')
  if (c.error) { console.log(`❌ conversación ${p.full_name}:`, c.error.message); continue }
  nConv++

  const rows = g.msgs.map(([dir, text], k) => ({
    id: randomUUID(), conversation_id: convId, phone: p.phone, direction: dir, text,
    whatsapp_message_id: `TEST-${i}-${k}`, metadata: dir==='out' ? { sent_by:'bot' } : {},
    created_at: minsAgo(base + (g.msgs.length-k)*2),
  }))
  await sb.from('messages').insert(rows)

  if (g.pending) {
    const r = await sb.from('bot_coach_reviews').insert({
      conversation_id: convId, patient_phone: p.phone,
      patient_message: g.msgs[g.msgs.length-1][1],
      proposed_text: g.propose, proposed_action: null,
      category: g.cat, intent_detected: g.intent, nlu_source: 'llm',
      verdict: 'pending', flagged: false, reviewed_by: '_seed',
      context_snapshot: { last_messages: g.msgs.map(([role,text]) => ({ role: role==='in'?'user':'assistant', text })) },
      created_at: minsAgo(base-1),
    })
    if (!r.error) nRev++
  }
}

console.log(`✅ Sembrado: ${nConv} conversaciones, ${nRev} propuestas pendientes.`)
console.log('   Recarga Bot Coach y prueba el toggle ▦ Monitor.  Para borrar: node _seed.mjs clean')
}
