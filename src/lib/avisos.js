// Plantillas de aviso guardadas en app_config y envío por el bot (/send-beauty).
import { useState, useEffect, useCallback } from 'react'
import { PLANTILLAS } from './jornadas.js'

export function usePlantilla(sb, clave) {
  const [texto, setTexto] = useState(PLANTILLAS[clave])
  useEffect(() => {
    let vivo = true
    sb.from('app_config').select('value').eq('key', clave).maybeSingle()
      .then(({ data }) => { if (vivo && data?.value) setTexto(data.value) }, () => {})
    return () => { vivo = false }
  }, [sb, clave])
  const guardar = useCallback(async valor => {
    setTexto(valor)
    await sb.from('app_config').upsert({ key: clave, value: valor }, { onConflict: 'key' })
  }, [sb, clave])
  return [texto, guardar]
}

/** Devuelve [{ phone, ok, error }] o lanza si el bot no responde. */
export async function enviarWhatsApp(botFetch, mensajes) {
  const validos = mensajes.filter(m => m.phone && m.text)
  if (!validos.length) return []
  const res = await botFetch('/send-beauty', { method: 'POST', body: JSON.stringify({ messages: validos }) })
  if (res.status === 503) throw new Error('el bot está en pausa o sin WhatsApp ahora mismo')
  if (!res.ok) throw new Error(await res.text())
  const { results } = await res.json()
  return results || []
}

