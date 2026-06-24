import React, { useState } from 'react'

function squadLabel(squads, index) {
  const isScoring = squads[index]?.label === 'scoring'
  if (isScoring) return 'Scoring'
  const supportNum = squads.slice(0, index).filter(s => s.label === 'support').length + 1
  return `Support ${supportNum}`
}

/**
 * Admin-only squad display with drag-and-drop rearrangement.
 * Players can be dragged between squads directly on the event card.
 * Squads can temporarily exceed 3 players (shown as warning).
 * Removals must be done via Edit Squads modal.
 *
 * Props:
 *   squads: array of { label, memberIds[] }
 *   playersById: { [id]: player }
 *   onSquadsChange: (newSquads) => void — called on every drop, parent saves to Firestore
 */
export default function DraggableSquadDisplay({ squads, playersById, onSquadsChange }) {
  const [dragState, setDragState] = useState(null) // { playerId, fromSquadIndex }
  const [overSquadIndex, setOverSquadIndex] = useState(null)

  if (!squads || squads.length === 0) return null

  function handleDragStart(e, playerId, fromSquadIndex) {
    setDragState({ playerId, fromSquadIndex })
    e.dataTransfer.effectAllowed = 'move'
    // Needed for Firefox
    e.dataTransfer.setData('text/plain', playerId)
  }

  function handleDragEnd() {
    setDragState(null)
    setOverSquadIndex(null)
  }

  function handleDragOver(e, toSquadIndex) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setOverSquadIndex(toSquadIndex)
  }

  function handleDragLeave() {
    setOverSquadIndex(null)
  }

  function handleDrop(e, toSquadIndex) {
    e.preventDefault()
    setOverSquadIndex(null)

    if (!dragState) return
    const { playerId, fromSquadIndex } = dragState

    if (fromSquadIndex === toSquadIndex) return // dropped on same squad

    const newSquads = squads.map((squad, i) => {
      if (i === fromSquadIndex) {
        return { ...squad, memberIds: squad.memberIds.filter(id => id !== playerId) }
      }
      if (i === toSquadIndex) {
        return { ...squad, memberIds: [...squad.memberIds, playerId] }
      }
      return squad
    })

    onSquadsChange(newSquads)
    setDragState(null)
  }

  return (
    <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      {squads.map((squad, i) => {
        const isScoring = squad.label === 'scoring'
        const isOver = overSquadIndex === i
        const isOverCapacity = squad.memberIds.length > 3
        const isDraggingFrom = dragState?.fromSquadIndex === i

        return (
          <div
            key={i}
            onDragOver={(e) => handleDragOver(e, i)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, i)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              flexWrap: 'wrap',
              padding: '0.3rem 0.5rem',
              borderRadius: 'var(--radius-sm)',
              border: isOver
                ? `2px dashed ${isScoring ? 'var(--accent)' : 'var(--muted)'}`
                : '2px solid transparent',
              background: isOver ? 'rgba(57,208,216,0.05)' : 'transparent',
              transition: 'border-color 0.1s, background 0.1s',
              minHeight: 32,
            }}
          >
            {/* Squad label */}
            <span style={{
              fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 600,
              color: isScoring ? 'var(--accent)' : 'var(--muted)',
              textTransform: 'uppercase', letterSpacing: '0.05em',
              minWidth: 56, flexShrink: 0,
              userSelect: 'none',
            }}>
              {squadLabel(squads, i)}
            </span>

            {/* Over capacity warning */}
            {isOverCapacity && (
              <span style={{ fontSize: 10, color: 'var(--warning)', fontFamily: 'var(--font-mono)' }}>
                {squad.memberIds.length}/3 ⚠
              </span>
            )}

            {/* Player pills */}
            {squad.memberIds.length === 0 && !isOver && (
              <span style={{ fontSize: 12, color: 'var(--muted)', fontStyle: 'italic' }}>
                {dragState ? 'Drop here' : '—'}
              </span>
            )}

            {squad.memberIds.map((id) => {
              const name = playersById[id]?.name || '?'
              const isDragging = dragState?.playerId === id

              return (
                <span
                  key={id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, id, i)}
                  onDragEnd={handleDragEnd}
                  style={{
                    display: 'inline-block',
                    fontSize: 12,
                    fontWeight: 500,
                    padding: '0.2rem 0.65rem',
                    borderRadius: 20,
                    background: isDragging
                      ? 'var(--surface2)'
                      : isScoring
                        ? 'rgba(57,208,216,0.15)'
                        : 'rgba(30,30,30,0.6)',
                    border: `1px solid ${isDragging ? 'var(--border)' : isScoring ? 'rgba(57,208,216,0.4)' : 'rgba(80,80,80,0.6)'}`,
                    color: isDragging ? 'var(--muted)' : 'var(--text)',
                    cursor: 'grab',
                    opacity: isDragging ? 0.5 : 1,
                    userSelect: 'none',
                    transition: 'opacity 0.1s',
                  }}
                  title="Drag to move to another squad"
                >
                  {name}
                </span>
              )
            })}

            {/* Drop hint when dragging over empty squad */}
            {isOver && squad.memberIds.length === 0 && (
              <span style={{ fontSize: 12, color: 'var(--accent)', fontStyle: 'italic' }}>
                Drop here
              </span>
            )}
          </div>
        )
      })}

      {dragState && (
        <p style={{ fontSize: 11, color: 'var(--muted)', margin: 0 }}>
          Drag to another squad to move. Changes save automatically on drop.
        </p>
      )}
    </div>
  )
}
