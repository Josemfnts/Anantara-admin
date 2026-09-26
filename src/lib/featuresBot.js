// Flags de funciones del bot que el panel puede mostrar, leídas de
// app_config.key='features_bot' (mismo patrón que d1_info_primera_cita, ver
// App.jsx). value es TEXT con un array JSON de strings, p.ej. '["cita_personalizada"]'.
//
// Encargo 4.4: la "cita personalizada" del editor necesita que el bot en el
// OptiPlex ya la entienda (proponer_cita con service_id null). Hasta que
// Josema migre, la fila no existe — y fila ausente, vacía o con JSON inválido
// tiene que dar CERO funciones activas (fail-closed): más vale que la opción
// no aparezca a que aparezca por un typo y Marta la use contra el bot viejo.

export function featuresBot(valueText) {
  if (!valueText) return new Set()
  let parsed
  try {
    parsed = JSON.parse(valueText)
  } catch {
    return new Set()
  }
  if (!Array.isArray(parsed)) return new Set()
  return new Set(
    parsed.filter(x => typeof x === 'string' && x.trim()).map(x => x.trim())
  )
}
