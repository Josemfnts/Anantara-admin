import { describe, it, expect } from 'vitest'
import { esAdelantamientoHumano, clasificarVerdict, calcularAcierto } from './autonomiaStats.js'

describe('esAdelantamientoHumano', () => {
  it('reconoce los cinco motivos que escribe el bot', () => {
    for (const m of [
      'reemplazada por mensaje nuevo',
      'secretaria respondió a mano vía panel',
      'secretaria respondió a mano vía WhatsApp',
      'secretaria tomó el control (cooldown manual)',
      'secretaria tomó el control (Yo me ocupo)',
    ]) {
      expect(esAdelantamientoHumano(m), m).toBe(true)
    }
  })

  it('un rechazo de verdad NO es adelantamiento', () => {
    // Marcar de más es la dirección peligrosa: infla el acierto y podría graduar
    // a automático una casuística que falla.
    for (const m of ['', null, undefined, 'Rechazada desde Bot móvil', 'texto incorrecto']) {
      expect(esAdelantamientoHumano(m), String(m)).toBe(false)
    }
  })
})

describe('clasificarVerdict', () => {
  it('el veredicto nuevo se respeta tal cual', () => {
    expect(clasificarVerdict({ verdict: 'superseded' })).toBe('superseded')
  })

  it('reclasifica el histórico por su motivo', () => {
    // Las filas anteriores a sql/0018 están guardadas como 'rejected'. El panel
    // las reinterpreta al vuelo para que la métrica mejore también hacia atrás,
    // sin reescribir datos pasados.
    expect(clasificarVerdict({
      verdict: 'rejected', rejection_reason: 'secretaria respondió a mano vía WhatsApp',
    })).toBe('superseded')
  })

  it('un rechazo real sigue siendo rechazo', () => {
    expect(clasificarVerdict({ verdict: 'rejected', rejection_reason: null })).toBe('rejected')
    expect(clasificarVerdict({
      verdict: 'rejected', rejection_reason: 'Rechazada desde Bot móvil',
    })).toBe('rejected')
  })

  it('el resto pasa sin tocar', () => {
    expect(clasificarVerdict({ verdict: 'sent' })).toBe('sent')
    expect(clasificarVerdict({ verdict: 'modified' })).toBe('modified')
    expect(clasificarVerdict({ verdict: 'auto_sent' })).toBe('auto_sent')
    expect(clasificarVerdict({ verdict: 'pending' })).toBe('pending')
  })
})

describe('calcularAcierto', () => {
  it('excluye los superseded del denominador', () => {
    // Caso REAL de confirmar_d1 (corpus 15→30 ago 2026): 45 turnos, 36 aprobados
    // sin tocar, 3 modificados, 6 rechazados — de los que 3 fueron adelantamiento
    // humano. La pantalla decía 80%; el acierto real es 86%.
    const r = calcularAcierto({ sent: 36, auto: 0, modified: 3, rejected: 3, superseded: 3 })
    expect(r.total).toBe(42)
    expect(r.pct).toBe(85.7)
    expect(r.noImputables).toBe(3)
  })

  it('los auto_sent cuentan como acierto', () => {
    expect(calcularAcierto({ sent: 5, auto: 5, modified: 0, rejected: 0 }).pct).toBe(100)
  })

  it('sin muestra devuelve null, no cero', () => {
    // Un 0% con cero casos haría creer que la casuística falla siempre.
    expect(calcularAcierto({ sent: 0, auto: 0, modified: 0, rejected: 0 }).pct).toBe(null)
  })

  it('tolera que no le pasen nada', () => {
    expect(calcularAcierto().total).toBe(0)
    expect(calcularAcierto().pct).toBe(null)
  })
})
