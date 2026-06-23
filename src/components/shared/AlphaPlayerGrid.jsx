import React from 'react'

/**
 * Displays a player pool in 3 alphabetical columns for easy scanning
 * at large roster sizes (50+ players).
 *
 * Props:
 *   players: array of player objects
 *   isSelected: (player) => boolean
 *   isDisabled: (player) => boolean
 *   onToggle: (player) => void
 *   renderSubtitle: (player) => string | null
 *   maxSelected: number
 *   selectedIds: string[]
 */
export default function AlphaPlayerGrid({
  players,
  isSelected,
  isDisabled,
  onToggle,
  renderSubtitle,
  maxSelected,
  selectedIds = [],
}) {
  const sorted = [...players].sort((a, b) => a.name.localeCompare(b.name))
  const perCol = Math.ceil(sorted.length / 3)
  const columns = [0, 1, 2].map((i) => sorted.slice(i * perCol, (i + 1) * perCol))
  const atLimit = maxSelected != null && selectedIds.length >= maxSelected

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
      {columns.map((col, colIdx) => (
        <div key={colIdx} style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          {col.map((player) => {
            const selected = isSelected(player)
            const disabled = isDisabled?.(player) || (!selected && atLimit)
            const subtitle = renderSubtitle?.(player)
            return (
              <button
                key={player.id}
                onClick={() => !disabled && onToggle(player)}
                disabled={disabled}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
                  padding: '0.35rem 0.6rem', borderRadius: 'var(--radius-sm)', textAlign: 'left',
                  border: selected ? '2px solid var(--accent)' : '1px solid var(--border)',
                  background: selected ? 'rgba(57,208,216,0.1)' : 'var(--surface)',
                  color: disabled && !selected ? 'var(--muted)' : 'var(--text)',
                  cursor: disabled ? 'not-allowed' : 'pointer',
                  opacity: disabled && !selected ? 0.45 : 1,
                  fontSize: 13, fontWeight: selected ? 600 : 400,
                  transition: 'border-color 0.1s, background 0.1s',
                }}
              >
                <span>{player.name}</span>
                {subtitle && (
                  <span style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--font-mono)', marginTop: '0.1rem' }}>
                    {subtitle}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      ))}
    </div>
  )
}
