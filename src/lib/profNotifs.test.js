import { describe, it, expect } from 'vitest'
import { mergeProfNotifs } from './profNotifs.js'

describe('mergeProfNotifs — fusiona en la lista los datos de notificaciones recién guardados', () => {
  const base = () => [
    { id: 1, name: 'Marcos', whatsapp_phone: '34600000000', daily_agenda_time: '08:00' },
    { id: 2, name: 'Lorena', whatsapp_phone: null, daily_agenda_time: null },
  ]

  it('actualiza solo la fila del profesional indicado', () => {
    const out = mergeProfNotifs(base(), 1, { whatsapp_phone: '34611111111', daily_agenda_time: '09:30' })
    expect(out.find(p => p.id === 1)).toEqual({ id: 1, name: 'Marcos', whatsapp_phone: '34611111111', daily_agenda_time: '09:30' })
    expect(out.find(p => p.id === 2)).toEqual(base()[1])
  })

  it('no muta el array original', () => {
    const profs = base()
    mergeProfNotifs(profs, 1, { whatsapp_phone: '34699999999' })
    expect(profs[0].whatsapp_phone).toBe('34600000000')
  })

  it('id inexistente → devuelve copia sin cambios', () => {
    const out = mergeProfNotifs(base(), 999, { whatsapp_phone: 'x' })
    expect(out).toEqual(base())
  })
})
