// Estado con el que nace una cita del alta del panel. Una cita en el pasado se está
// registrando a posteriori: nunca queda pendiente, porque pendiente = WhatsApp al
// paciente ofreciéndole un hueco que ya pasó (salió solo el 13/10). `inicio` y `ahora`
// son Date; el formulario construye `inicio` en hora local del navegador, como el resto.
export function citaEnPasado(inicio, ahora = new Date()) {
  return inicio.getTime() < ahora.getTime()
}
export function estadoAlta({ dejarPendiente, inicio, ahora = new Date() }) {
  return dejarPendiente && !citaEnPasado(inicio, ahora) ? 'pending' : 'confirmed'
}

// Hora de la siguiente cita encadenada (dos personas seguidas): la del final de la
// anterior, redondeada hacia arriba a la media hora, que es lo que ofrece el selector.
// Pasa de las 21:30 (última del selector) → '' y Marta la elige a mano.
export function horaSiguiente(fin) {
  const min = fin.getHours() * 60 + fin.getMinutes()
  const redondeado = Math.ceil(min / 30) * 30
  if (redondeado > 21 * 60 + 30) return ''
  return String(Math.floor(redondeado / 60)).padStart(2, '0') + ':' + String(redondeado % 60).padStart(2, '0')
}
