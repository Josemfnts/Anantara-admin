// Reordenado puro para las listas (espera / adelantar).
// Devuelve una COPIA de `arr` con el elemento en `from` reinsertado en `to`.
// No muta el original; fuera de rango o from===to devuelve copia sin cambios.
export function moveItem(arr, from, to) {
  const copy = arr.slice()
  if (from === to || from < 0 || to < 0 || from >= arr.length || to >= arr.length) return copy
  const [it] = copy.splice(from, 1)
  copy.splice(to, 0, it)
  return copy
}
