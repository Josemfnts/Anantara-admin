// Normalización para buscar pacientes sin tildes ("jose" encuentra "José").
//
// Espejo en SQL: la columna `patients.full_name_busqueda` =
// lower(unaccent(full_name)), mantenida por trigger (migración ya aplicada en
// producción, 0 nulos). Esta función hace en JS lo mismo que unaccent()+lower()
// hace en Postgres, para que el término de búsqueda que viaja en el `ilike`
// esté normalizado igual que la columna contra la que se compara.
//
// Ojo con la ñ: se descompone en n + combining tilde (U+0303), así que
// 'muñoz' → 'munoz' (confirmado que unaccent hace lo mismo).

/** Quita tildes/diacríticos y pasa a minúsculas. PURA. */
export function normBusqueda(texto) {
  return (texto || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}
