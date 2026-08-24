// Horas preferidas de las listas (espera / adelantar) y del follow-up.
//
// Espejo de `v5/src/tools/helpers/pref-hours.js` en el bot. MISMO contrato, y
// tiene que seguir siéndolo: el bot decide con esto qué hueco ofrece y el panel
// pinta con esto qué horas admite el paciente. Si divergen, Marta ve una cosa y
// el bot hace otra.
//
//   preferred_hours: int[] de MINUTOS desde medianoche (480=08:00, 510=08:30…)
//   preferred_hour (antigua): entero de HORA (8=08:00) → se convierte a hora*60
//
// La columna antigua solo admitía UNA hora en punto, así que no se podía decir
// "me vale a las 8:30 o a las 13:00". Sigue leyéndose para las filas viejas.

// Minutos desde medianoche del inicio de un hueco, desde su ISO ('…T08:30:…').
export function slotStartMinutes(startsAtIso) {
  if (!startsAtIso) return null
  return parseInt(startsAtIso.slice(11, 13), 10) * 60 + parseInt(startsAtIso.slice(14, 16), 10)
}

// Preferencias normalizadas a minutos. null si la fila no tiene ninguna.
export function preferredMinutesOf(row) {
  if (row?.preferred_hours?.length) return row.preferred_hours
  if (row?.preferred_hour != null) return [row.preferred_hour * 60]
  return null
}

// ¿El hueco encaja con las horas preferidas de la fila? Sin preferencias → true.
export function huecoMatchesPreferred(startsAtIso, row) {
  const pref = preferredMinutesOf(row)
  if (!pref?.length) return true
  return pref.includes(slotStartMinutes(startsAtIso))
}

// 'HH:MM' desde minutos. Para pintar la columna y las etiquetas del selector.
export function minutesToLabel(min) {
  if (min == null) return ''
  return `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`
}

// Texto de la columna "Hora pref." de las listas. Con muchas horas se resume,
// porque la celda es estrecha y "08:00, 08:30, 09:00, 09:30, 10:00…" la revienta.
export function preferredHoursLabel(row, max = 3) {
  const pref = preferredMinutesOf(row)
  if (!pref?.length) return 'Cualquiera'
  const orden = [...pref].sort((a, b) => a - b)
  const vistos = orden.slice(0, max).map(minutesToLabel)
  return orden.length > max ? `${vistos.join(', ')} +${orden.length - max}` : vistos.join(', ')
}
