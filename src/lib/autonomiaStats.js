// Cálculo del acierto por casuística para la pantalla de Autonomía.
//
// POR QUÉ EXISTE: el porcentaje que enseñaba esta pantalla mezclaba dos cosas
// que no tienen nada que ver:
//   · el bot se equivocó                     → es un fallo y debe contar.
//   · un humano se adelantó al bot           → el texto del bot era correcto.
//
// Medido sobre el corpus completo del 15 al 30 de agosto de 2026: de 37 rechazos,
// 16 eran del segundo tipo. Con ellos dentro, `confirmar_d1` salía al 80% cuando
// en realidad va al 86%.
//
// Y eso no es cosmético: esta misma pantalla usa el porcentaje para decidir si
// una casuística puede graduarse a automático. La métrica rota estaba bloqueando
// la automatización de la casuística más segura que tiene el bot.
//
// ⚠️ MANTENER EN SINCRONÍA con `v5/src/coach/verdicts.js` del bot. Son dos repos
// distintos, igual que pasa con lib/companions.js. Si cambias la lista de motivos
// aquí, cámbiala allí.

// Los motivos los escribe el CÓDIGO del bot en cinco puntos concretos, no son
// texto libre, así que la lista es cerrada y estable.
const MOTIVOS_ADELANTAMIENTO = [
  'reemplazada por mensaje nuevo',
  'secretaria respondió a mano vía panel',
  'secretaria respondió a mano vía WhatsApp',
  'secretaria tomó el control (cooldown manual)',
  'secretaria tomó el control (Yo me ocupo)',
]

/**
 * ¿Este rechazo fue en realidad un adelantamiento humano? PURA.
 *
 * Deliberadamente NO incluye "Rechazada desde Bot móvil": ahí Marta emite un
 * JUICIO sobre el texto, no se adelanta. Marcar de más es la dirección peligrosa.
 */
export function esAdelantamientoHumano(motivo) {
  const m = (motivo || '').trim()
  if (!m) return false
  return MOTIVOS_ADELANTAMIENTO.includes(m)
}

/**
 * Veredicto efectivo de una review. PURA.
 *
 * Las filas anteriores a `sql/0018` están guardadas como 'rejected' con su
 * motivo; se reinterpretan al vuelo para que la métrica mejore también hacia
 * atrás, sin reescribir ni una fila del histórico.
 */
export function clasificarVerdict({ verdict, rejection_reason } = {}) {
  if (verdict === 'rejected' && esAdelantamientoHumano(rejection_reason)) return 'superseded'
  return verdict
}

/**
 * Acierto de una casuística. Los `superseded` NO cuentan como fallo ni entran
 * en el denominador: el bot había acertado, simplemente no llegó a enviarse. PURA.
 *
 * @returns {{total:number, pct:number|null, noImputables:number}}
 *          `pct` es null sin muestra — un 0% con cero casos haría creer que la
 *          casuística falla siempre.
 */
export function calcularAcierto({ sent = 0, auto = 0, modified = 0, rejected = 0, superseded = 0 } = {}) {
  const total = sent + auto + modified + rejected
  const aciertos = sent + auto
  return {
    total,
    noImputables: superseded,
    pct: total > 0 ? Math.round((aciertos / total) * 1000) / 10 : null,
  }
}
