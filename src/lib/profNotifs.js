// Fusiona en `profs` los campos guardados de notificaciones (WhatsApp / hora de
// agenda) del profesional `id`, sin mutar el array. Se usa tras guardar en BD
// para que la lista en memoria no siga enseñando el valor viejo al cambiar de
// profesional y volver — antes `saveProfNotifs` solo mostraba el toast y nunca
// tocaba `profs`/`selProf`.
export function mergeProfNotifs(profs, id, updates) {
  return profs.map(p => p.id === id ? { ...p, ...updates } : p)
}
