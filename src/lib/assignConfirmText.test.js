import { describe, it, expect } from 'vitest'
import { assignConfirmText } from './assignConfirmText.js'

// Encargo 1.2: antes de asignar un hueco vacante desde la lista de espera
// (Agenda o Espera) hay que preguntar, porque la acción dispara un WhatsApp
// real al paciente. Este es el texto de esa pregunta.

describe('assignConfirmText', () => {
  it('arma la pregunta con nombre, día y hora', () => {
    expect(assignConfirmText('María López', '2026-09-24T10:30:00'))
      .toBe('¿Asignar a María López el hueco del 24 sep a las 10:30 y enviarle WhatsApp?')
  })

  it('acepta timestamps con segundos u offset (se queda con los primeros 19 caracteres)', () => {
    expect(assignConfirmText('Juan', '2026-01-05T08:00:00.000Z'))
      .toBe('¿Asignar a Juan el hueco del 5 ene a las 08:00 y enviarle WhatsApp?')
  })

  it('sin nombre de paciente, usa un genérico pero no rompe', () => {
    expect(assignConfirmText('', '2026-09-24T10:30:00'))
      .toBe('¿Asignar a este paciente el hueco del 24 sep a las 10:30 y enviarle WhatsApp?')
  })

  it('sin fecha válida, pregunta sin día/hora en vez de mostrar basura', () => {
    expect(assignConfirmText('María López', null))
      .toBe('¿Asignar a María López este hueco y enviarle WhatsApp?')
    expect(assignConfirmText('María López', ''))
      .toBe('¿Asignar a María López este hueco y enviarle WhatsApp?')
  })
})
