// Concordancia de género para los textos que el PANEL escribe al paciente.
//
// ⚠️ ESPEJO de `v5/src/agent/concordancia.js` del bot. Son dos repos distintos,
// igual que pasa con lib/companions.js. Si cambias una lista aquí, cámbiala allí.
// Las listas de abajo están COPIADAS del fichero del bot por un script, no
// transcritas a mano.
//
// POR QUÉ EXISTE: PREMISAS-BOT.md §1.2 obliga a que un texto canónico se cambie
// en `v5/src/` Y en `Anantara-admin/src/` — los dos hablan con el paciente. El
// panel pre-rellena el cuadro de "Cambiar acción" con "Perfecto, apuntado.
// Muchas gracias.", así que sin esto Marta seguiría corrigiendo el género a mano
// justo donde el bot ya no se equivoca.
//
// RIESGO ASIMÉTRICO: ante cualquier duda, masculino — que es el comportamiento
// anterior. Decir "apuntada" a un hombre sería un error NUEVO.

const NOMBRES_F = new Set([
  'amparo', 'angeles', 'araceli', 'ascension', 'asun', 'asuncion', 'ashley',
  'beatriz', 'bego', 'belen', 'berit', 'carmen', 'charo', 'chloe', 'chus',
  'coral', 'dolores', 'dori', 'eli', 'elizabeth', 'ely', 'espe', 'ester',
  'esther', 'fani', 'flor', 'gwendolyne', 'ines', 'irene', 'iris', 'isabel',
  'izarbe', 'izaskun', 'jaione', 'jaqueline', 'jenifer', 'jennifer', 'jenny',
  'jezabel', 'judith', 'juani', 'karen', 'kathe', 'katherine', 'leti', 'leyre',
  'loli', 'lourdes', 'maite', 'mamen', 'mapi', 'mar', 'mari', 'marian',
  'maribel', 'maricarmen', 'marigel', 'marimar', 'maripi', 'marisol', 'marivi',
  'marvi', 'mary', 'mayte', 'mercedes', 'merche', 'michelle', 'milagros',
  'miriam', 'montse', 'montserrat', 'nati', 'nelly', 'nicol', 'nieves', 'nines',
  'noemi', 'norah', 'paqui', 'paz', 'piedad', 'pilar', 'pilarin', 'pili',
  'raquel', 'remedios', 'reyes', 'rocio', 'rosi', 'ruth', 'sagrario', 'salome',
  'sol', 'soledad', 'susi', 'tere', 'vicky', 'yanet', 'zoe',
])

const NOMBRES_M = new Set([
  'borja', 'bautista', 'chema', 'cosme', 'elias', 'hamza', 'jona', 'josema',
  'luca', 'lucca', 'matias', 'mustafa', 'nicola', 'rafa', 'salva', 'tobias',
  'zacarias',
])

/** Género probable a partir del nombre completo. PURA. Ante duda: 'm'. */
export function generoDeNombre(nombreCompleto) {
  const pila = String(nombreCompleto || '').trim().split(/\s+/)[0] || ''
  const n = pila.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  if (!n) return 'm'
  if (NOMBRES_M.has(n)) return 'm'
  if (NOMBRES_F.has(n)) return 'f'
  return /a$/.test(n) ? 'f' : 'm'
}

/**
 * Concuerda el participio en función de adjetivo (tras coma o punto). PURA.
 * "Te he apuntado en la lista" es el VERBO y no se toca.
 */
export function aplicarConcordancia(texto, genero) {
  if (genero !== 'f') return texto || ''
  return (texto || '').replace(/([.,]\s*)apuntado(?=[.,!]|\s*$)/gi, (_m, pre) => `${pre}apuntada`)
}
