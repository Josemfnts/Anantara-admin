// Ausencias (no-shows). Lógica pura: importe facturable, plantilla del mensaje y
// ranking de pacientes. Sin Supabase, para poder testearla entera.
//
// Encargo de Josema (2026-08-14):
//  · Si el paciente falta, se factura un % de la cita (ej. 50%) y se le avisa en
//    el mensaje. NO es un cargo aparte: es cuánto de esa cita se cobra.
//  · A veces lo perdona → 0%.
//  · El ranking se mide en NÚMERO de citas falladas, no en porcentaje.

/** ¿Esta cita está marcada como ausencia? */
export function esAusencia(appt) {
  return !!appt?.no_show_at
}

/**
 * Importe realmente facturable de una cita.
 * - Cita normal        → precio del servicio.
 * - Ausencia cobrada   → precio × porcentaje.
 * - Ausencia perdonada → 0.
 *
 * Úsala en TODA suma de facturación, en vez de `services.price` a pelo.
 */
export function importeCita(appt) {
  const precio = appt?.services?.price ?? appt?.price ?? 0
  if (!esAusencia(appt)) return precio
  const pct = appt?.no_show_charge_pct
  if (pct == null) return 0            // marcada sin decidir → no se cobra
  return Math.round(precio * (pct / 100) * 100) / 100
}

/**
 * Sustituye los marcadores de la plantilla que edita la secretaria.
 * Marcadores: {dia} {hora} {profesional} {porcentaje} {importe}
 * Un marcador sin dato se sustituye por cadena vacía, nunca por "undefined".
 */
export function buildNoShowMessage(plantilla, { dia, hora, profesional, porcentaje, importe } = {}) {
  if (!plantilla) return ''
  const valores = {
    dia: dia ?? '',
    hora: hora ?? '',
    profesional: profesional ?? '',
    porcentaje: porcentaje == null ? '' : String(porcentaje),
    importe: importe == null ? '' : `${importe}€`,
  }
  return plantilla.replace(/\{(dia|hora|profesional|porcentaje|importe)\}/g, (_, k) => valores[k])
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
}

/**
 * Ranking de pacientes por número de ausencias, de más a menos.
 * Entrada: filas de `appointments` con `no_show_at` y `patients`.
 *
 * @returns {Array<{patient_id, nombre, telefono, total, cobradas, perdonadas, importe, ultima}>}
 */
export function rankingAusencias(citas = []) {
  const porPaciente = new Map()
  for (const a of citas) {
    if (!esAusencia(a)) continue
    const id = a.patient_id || a.patients?.id
    if (!id) continue
    if (!porPaciente.has(id)) {
      porPaciente.set(id, {
        patient_id: id,
        nombre: a.patients?.full_name || '—',
        telefono: a.patients?.phone || null,
        total: 0, cobradas: 0, perdonadas: 0, importe: 0, ultima: null,
      })
    }
    const p = porPaciente.get(id)
    p.total++
    const pct = a.no_show_charge_pct
    if (pct != null && pct > 0) p.cobradas++
    else p.perdonadas++
    p.importe = Math.round((p.importe + importeCita(a)) * 100) / 100
    if (!p.ultima || a.starts_at > p.ultima) p.ultima = a.starts_at
  }
  // Más ausencias primero; a igualdad, la más reciente arriba.
  return [...porPaciente.values()].sort((x, y) =>
    y.total - x.total || String(y.ultima || '').localeCompare(String(x.ultima || '')))
}
