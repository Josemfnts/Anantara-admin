import React from 'react'

const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
const DAYS = ['L','M','X','J','V','S','D']

function pad(n) { return String(n).padStart(2, '0') }

function monthKey(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`
}

function calendarDays(monthDate) {
  const year = monthDate.getFullYear()
  const month = monthDate.getMonth()
  const first = new Date(year, month, 1)
  const last = new Date(year, month + 1, 0)
  const startOffset = (first.getDay() + 6) % 7 // lunes=0
  const days = []
  for (let i = 0; i < startOffset; i++) {
    const d = new Date(year, month, 1 - (startOffset - i))
    days.push({ date: d, other: true })
  }
  for (let d = 1; d <= last.getDate(); d++) {
    days.push({ date: new Date(year, month, d), other: false })
  }
  const rem = 7 - (days.length % 7)
  if (rem < 7) {
    for (let i = 1; i <= rem; i++) {
      days.push({ date: new Date(year, month + 1, i), other: true })
    }
  }
  return days
}

function toDayKey(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function ProposalCalendar({ month, days, loading, onPrev, onNext, onSelectDay, onSelectHour, selectedDay }) {
  const grid = calendarDays(month)
  const selectedHours = selectedDay ? (days[selectedDay]?.hours || []) : []

  return (
    // Ancho FLUIDO. Antes era `width: 320` fijo: en un móvil de 360px, restando
    // el relleno del modal y el de la tarjeta, quedaban ~296px y el calendario
    // se salía por la derecha — las columnas del jueves al domingo quedaban
    // cortadas (reportado el 24-ago: "se ven muy muy mal").
    <div style={{ width: '100%', maxWidth: 360, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <button onClick={onPrev} style={navBtn} aria-label="Mes anterior">◀</button>
        <div style={{ fontWeight: 700, fontSize: 15 }}>{MONTHS[month.getMonth()]} {month.getFullYear()}</div>
        <button onClick={onNext} style={navBtn} aria-label="Mes siguiente">▶</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 4 }}>
        {DAYS.map(d => <div key={d} style={{ textAlign: 'center', fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>{d}</div>)}
      </div>

      {loading ? (
        <div style={{ padding: 20, textAlign: 'center', fontSize: 12, color: 'var(--text-muted)' }}>Cargando…</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
          {grid.map((cell, idx) => {
            const key = toDayKey(cell.date)
            const dayInfo = days[key]
            const isFree = dayInfo?.status === 'free'
            const isBusy = dayInfo?.status === 'busy'
            const isSelected = key === selectedDay
            const isOther = cell.other
            return (
              <button
                key={idx}
                disabled={!isFree || isOther}
                onClick={() => onSelectDay(key)}
                title={isFree ? 'Hay huecos' : isBusy ? 'Sin huecos' : ''}
                style={{
                  ...dayBtn,
                  opacity: isOther ? 0.35 : 1,
                  background: isSelected ? 'var(--green)' : isFree ? '#dcfce7' : isBusy ? '#fee2e2' : '#f3f4f6',
                  color: isSelected ? '#fff' : isFree ? '#166534' : isBusy ? '#991b1b' : '#9ca3af',
                  cursor: isFree && !isOther ? 'pointer' : 'default',
                }}
              >
                {cell.date.getDate()}
              </button>
            )
          })}
        </div>
      )}

      {selectedDay && (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6, color: 'var(--body)' }}>
            Horas disponibles el {selectedDay.slice(8)}:
          </div>
          {/* maxHeight 120 dejaba ver dos filas escasas de horas y el scroll
              interno competía con el del modal en el móvil. 200 + WebkitOverflowScrolling
              hace que se desplace con el dedo sin pelearse con la página. */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, maxHeight: 200, overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
            {selectedHours.length === 0 ? (
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Sin horas</span>
            ) : (
              selectedHours.map((h, i) => {
                const hour = typeof h === 'string' ? h : h.hour
                const slotId = typeof h === 'string' ? null : h.slot_id
                return (
                  <button
                    key={i}
                    onClick={() => onSelectHour(selectedDay, hour, slotId)}
                    style={hourBtn}
                  >
                    {hour}
                  </button>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// Medidas pensadas para el DEDO, no para el ratón: en el móvil de Marta las
// celdas de 28-32px eran casi imposibles de acertar. 40px es el mínimo cómodo.
const navBtn = {
  border: '1px solid var(--stone)',
  background: '#fff',
  borderRadius: 8,
  width: 40,
  height: 40,
  cursor: 'pointer',
  fontSize: 14,
  flexShrink: 0,
}

const dayBtn = {
  border: 'none',
  borderRadius: 8,
  // aspectRatio mantiene las celdas cuadradas al ser el ancho fluido; minHeight
  // garantiza que nunca bajen del tamaño mínimo de toque aunque la pantalla sea
  // muy estrecha.
  aspectRatio: '1 / 1',
  minHeight: 40,
  width: '100%',
  fontSize: 14,
  fontWeight: 600,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 0,
}

const hourBtn = {
  border: '1px solid var(--green)',
  background: 'var(--sage-mist)',
  color: 'var(--green)',
  borderRadius: 999,
  padding: '8px 14px',
  minHeight: 40,
  fontSize: 14,
  fontWeight: 600,
  cursor: 'pointer',
}
