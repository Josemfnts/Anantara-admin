// Lógica pura de las propuestas `type:'varias'` (fase 6 del bot, ver
// docs/CONTRATO-BOTCOACH-API.md §"final_action/proposed_action de tipo varias").
//
// Desde la fase 6.1 el bot puede proponer en una sola review VARIAS acciones a
// la vez (p.ej. "confirmar la de mañana Y descartar la propuesta vieja"). El
// panel las manda todas marcadas por defecto; Marta puede desmarcar o cambiar
// cada una por separado. Este módulo es PURO (sin red, sin estado de React)
// para poder testear las reglas de "qué se manda" sin montar componentes.
//
// Regla de oro heredada de proposedAction.js: la identidad de una cita nunca
// se inventa. Aquí eso se traduce en "nunca se anida varias dentro de varias"
// y en no duplicar una anulación sobre la misma propuesta.

import { actionLookupId, isDestructiveAction } from './proposedAction.js'

// ¿Es una acción compuesta? (type:'varias' con su array de sub-acciones)
export function esVarias(action) {
  return !!action && action.type === 'varias' && Array.isArray(action.acciones)
}

// Sub-acciones de una acción cualquiera: la suelta como array de 1, la varias
// tal cual (copia, nunca la referencia original), null/undefined como [].
export function accionesDe(action) {
  if (!action) return []
  if (esVarias(action)) return [...action.acciones]
  return [action]
}

// Qué mandar a /send-validated según lo que Marta deja marcado, respetando el
// orden original (el orden de ejecución interno lo decide el bot, no el panel).
//   0 marcadas → sin acción (solo el texto, si lo hay).
//   1 marcada  → esa acción SUELTA (la entiende cualquier bot, no solo el 6.1).
//   ≥2 marcadas → { type:'varias', acciones:[...] }.
export function finalActionDe(acciones = [], marcadas = []) {
  const marcadasAcciones = acciones.filter((_, i) => !!marcadas[i])
  if (marcadasAcciones.length === 0) return { final_action: null, action_approved: false }
  if (marcadasAcciones.length === 1) return { final_action: marcadasAcciones[0], action_approved: true }
  return { final_action: { type: 'varias', acciones: marcadasAcciones }, action_approved: true }
}

// Sustituye la sub-acción en `idx` por `nueva` (lo que devuelve el editor).
// Si `nueva` es a su vez una `varias` (Marta añadió "anular también" a una
// proponer_cita), se APLANA en esa posición — una varias nunca anida otra,
// se rechazaría en el bot (commitAction) y aquí tampoco tiene sentido.
// Además deduplica `descartar_propuesta` repetidos sobre la misma propuesta
// (mismo `old_proposal_id`): no tiene sentido anularla dos veces, y conservar
// ambas confundiría a Marta en la tarjeta. Se queda la ÚLTIMA aparición: es
// el cambio más reciente, el que manda.
export function reemplazarAccion(acciones = [], idx, nueva) {
  const insertar = esVarias(nueva) ? accionesDe(nueva) : [nueva]
  const combinado = [...acciones.slice(0, idx), ...insertar, ...acciones.slice(idx + 1)]

  const vistos = new Set()
  const invertido = []
  for (let i = combinado.length - 1; i >= 0; i--) {
    const a = combinado[i]
    if (a?.type === 'descartar_propuesta' && a.old_proposal_id) {
      if (vistos.has(a.old_proposal_id)) continue
      vistos.add(a.old_proposal_id)
    }
    invertido.push(a)
  }
  return invertido.reverse()
}

// ¿Alguna de las acciones MARCADAS es destructiva? Para decidir si hace falta
// el window.confirm de "vas a hacer algo que no se puede deshacer".
export function hayDestructivaMarcada(acciones = [], marcadas = []) {
  return acciones.some((a, i) => !!marcadas[i] && isDestructiveAction(a))
}

// De las citas de un paciente, las que son "propuestas vivas": pending, sin
// hold de cancelación (cancellation_hold_id nulo — con hold ya está en curso
// otra cosa, no se toca desde aquí) y futuras. Las amarillas de la UI
// (proposed_until ya pasado) cuentan igual: siguen siendo pending sin hold,
// solo que el bot ya no las persigue.
// `ahora` es inyectable para tests deterministas (mismo patrón que ctx.now en
// generateActionText.js).
export function propuestasAnulables(citasPaciente = [], { excluirIds = [], ahora = new Date() } = {}) {
  const excluir = new Set(excluirIds)
  const ahoraMs = ahora.getTime()
  return citasPaciente.filter(c =>
    !!c &&
    c.status === 'pending' &&
    !c.cancellation_hold_id &&
    !excluir.has(c.id) &&
    !!c.starts_at &&
    new Date(c.starts_at).getTime() > ahoraMs
  )
}

// Compone la acción final del editor cuando Marta marca "anular también" al
// proponer una cita nueva: sin ids que anular, la acción tal cual (sigue
// siendo una proponer_cita normal, la entiende cualquier bot); con ids, una
// varias con la propuesta + un descartar_propuesta por cada anulación.
export function conAnulaciones(accionProponer, idsAAnular = [], patientId) {
  const ids = idsAAnular.filter(Boolean)
  if (!ids.length) return accionProponer
  return {
    type: 'varias',
    acciones: [
      accionProponer,
      ...ids.map(id => ({ type: 'descartar_propuesta', patient_id: patientId, old_proposal_id: id })),
    ],
  }
}

// Ids de `appointments` que YA usan otras sub-acciones de la varias (por
// appointment_id u old_proposal_id, vía el mismo mapa que proposedAction.js).
// Sirve para no ofrecer en "anular también" una cita que otra fila de la
// misma tarjeta ya está anulando o confirmando. `idxExcluir` es la fila que
// se está editando (no cuenta contra sí misma).
export function idsYaUsados(acciones = [], idxExcluir = -1) {
  const ids = new Set()
  acciones.forEach((a, i) => {
    if (i === idxExcluir) return
    const id = actionLookupId(a)
    if (id) ids.add(id)
  })
  return [...ids]
}
