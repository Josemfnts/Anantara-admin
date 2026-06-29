import { describe, it, expect } from 'vitest'
import { conversationPayloadFor } from './newConversation.js'

describe('conversationPayloadFor', () => {
  it('paciente con teléfono → payload con phone de 9 dígitos, patient_id y last_message_at', () => {
    const p = conversationPayloadFor({ id: 'pid', full_name: 'Ana', phone: '+34 651 65 26 89' }, new Date('2026-06-29T10:00:00Z'))
    expect(p.phone).toBe('651652689')
    expect(p.patient_id).toBe('pid')
    expect(typeof p.last_message_at).toBe('string')
    expect(p.updated_at).toBe(p.last_message_at)
  })
  it('teléfono ya de 9 dígitos se respeta', () => {
    expect(conversationPayloadFor({ id: 'x', phone: '651652689' }).phone).toBe('651652689')
  })
  it('sin teléfono → null (no se puede arrancar)', () => {
    expect(conversationPayloadFor({ id: 'x', phone: '' })).toBe(null)
    expect(conversationPayloadFor({ id: 'x' })).toBe(null)
  })
  it('teléfono con menos de 9 dígitos → null', () => {
    expect(conversationPayloadFor({ id: 'x', phone: '12345' })).toBe(null)
  })
  it('paciente nulo → null', () => {
    expect(conversationPayloadFor(null)).toBe(null)
  })
})
