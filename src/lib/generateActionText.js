// Texto por defecto para el paciente en función de la acción elegida por Marta
// en el modal de "Cambiar acción" del Bot Coach. Puro: mismos datos → mismo texto.
//
// Reproducimos las plantillas del bot (system-prompt.js) para que el mensaje
// suene igual venga de donde venga. Marta puede editarlo después en el textarea.
//
// El día/hora se formatean respetando la zona horaria del sistema; usamos
// mediodía como ancla para evitar desfases de día (mismo patrón que el bot).

import { saludoSegunHora } from './followupMessage.js'

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

function fechaLegible(isoDate) {
  if (!isoDate || isoDate.length < 10) return null
  const y = +isoDate.slice(0, 4)
  const m = +isoDate.slice(5, 7)
  const d = +isoDate.slice(8, 10)
  if (!y || !m || !d) return null
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay()
  return `${DIAS[dow]} ${d} de ${MESES[m - 1]}`
}

function primerNombre(fullName) {
  return (fullName || '').trim().split(/\s+/)[0] || ''
}

// action: descriptor con type + campos.
// ctx.appt: fila resuelta (day/time/prof) si la acción va por lookup.
// ctx.now: inyectable para tests (decide "Buenos días" / "Buenas tardes").
//
// OJO — regla transversal de PREMISAS-BOT.md §1.2 (2026-08-14, orden de Josema):
// el bot NUNCA llama al paciente por su nombre de pila. Aquí se hacía ("Hola María,")
// y contradecía al propio system prompt del bot. Ahora abre con el saludo por hora,
// igual que el bot (v5/src/tools/helpers/proposal-text.js). Auditoría A4.
// `ctx.patientName` se sigue aceptando por compatibilidad, pero NO se usa.
export function generateActionText(action, ctx = {}) {
  if (!action || !action.type) return ''
  const saludo = `${saludoSegunHora(ctx.now ?? new Date())}, `

  switch (action.type) {
    case 'cancelar_cita':
      return 'Hecho, cancelada. Si quieres otra fecha, dime.'
    case 'descartar_propuesta':
      return 'Vale, si quieres cita otro día me dices.'
    case 'confirmar_propuesta':
    case 'confirmar_followup_oferta':
      return 'Perfecto, apuntado. Muchas gracias.'
    case 'aceptar_oferta_cancelacion': {
      const dia = ctx.appt?.day || null
      const hora = ctx.appt?.time || null
      if (dia && hora) return `Hecho, te muevo al ${dia} a las ${hora}.`
      return 'Hecho, te muevo. Ya tienes el nuevo hueco.'
    }
    case 'rechazar_oferta_cancelacion':
      return 'Sin problema, te dejo la cita que ya tenías.'
    case 'proponer_cita': {
      const dia = fechaLegible(action.starts_at?.slice(0, 10))
      const hora = action.starts_at?.slice(11, 16)
      const prof = ctx.profName || action.prof || 'el equipo'
      if (dia && hora) return `${saludo}te propongo cita con ${prof} el ${dia} a las ${hora}. ¿Te viene bien?`
      return `${saludo}tengo un hueco con ${prof}. ¿Te viene bien?`
    }
    case 'rechazar_propuesta': {
      const dia = fechaLegible(action.next?.starts_at?.slice(0, 10))
      const hora = action.next?.starts_at?.slice(11, 16)
      if (dia && hora) return `Sin problema. Te propongo el ${dia} a las ${hora}, ¿te viene bien?`
      return 'Sin problema, te miro otro hueco.'
    }
    case 'reservar_clase': {
      const dia = fechaLegible(action.starts_at?.slice(0, 10))
      const hora = action.starts_at?.slice(11, 16)
      const svc = ctx.serviceName || 'la clase'
      if (dia && hora) return `${saludo}te apunto a ${svc} el ${dia} a las ${hora}.`
      return `${saludo}te apunto a ${svc}.`
    }
    case 'apuntar_lista_espera': {
      const svc = ctx.serviceName || action.service_name || 'el servicio'
      return `${saludo}te he apuntado para ${svc}. Te aviso cuando tenga hueco.`
    }
    case 'apuntar_lista_adelantar':
      return `${saludo}te apunto en la lista de adelantar y te aviso si surge algo antes.`
    case 'oferta_proactiva': {
      const dia = fechaLegible(ctx.appt?.starts_at?.slice(0, 10))
      const hora = ctx.appt?.starts_at?.slice(11, 16)
      const prof = ctx.profName || ctx.appt?.professionals?.name || 'el equipo'
      if (dia && hora) return `${saludo}te he apuntado para el ${dia} a las ${hora} con ${prof}. ¿Te viene bien?`
      return `${saludo}tenemos un hueco disponible, ¿te viene bien?`
    }
    case 'reprogramar': {
      // Compuesta: cancelar vieja + proponer nueva. El texto habla de la NUEVA cita.
      const dia = fechaLegible(action.propose?.starts_at?.slice(0, 10))
      const hora = action.propose?.starts_at?.slice(11, 16)
      const prof = ctx.profName || action.propose?.prof || 'el equipo'
      if (dia && hora) return `${saludo}te muevo la cita al ${dia} a las ${hora} con ${prof}. ¿Te viene bien?`
      return `${saludo}te muevo la cita. Te confirmo el nuevo hueco.`
    }
    default:
      return ''
  }
}
