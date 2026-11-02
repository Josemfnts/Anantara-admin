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
