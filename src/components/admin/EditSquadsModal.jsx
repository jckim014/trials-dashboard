import React, { useState } from 'react'
import AlphaPlayerGrid from '../shared/AlphaPlayerGrid.jsx'

function supportLabel(squads, squadIndex) {
  const supportNum = squads.slice(0, squadIndex).filter(s => s.label === 'support').length + 1
  return `Support ${supportNum}`
}

/**
 * Modal for editing squad assignments. Two-column layout:
 * left = player pool (alpha grid), right = squad slots.
 * Opens when admin clicks "Edit Squads" on an event card.
 */
export default function EditSquadsModal({ event, players, playersById, onSave, onCancel, saving }) {
  const [squads, setSquads] = useState(event.squads || [])
  const [activeSquadIndex, setActiveSquadIndex] = useState(0)

  const allAssigned = new Set(squads.flatMap((s) => s.memberIds))
  const activeSquad = squads[activeSquadIndex]
  const assignedInActive = new Set(activeSquad?.memberIds || [])

  function togglePlayer(player) {
    setSquads((prev) => prev.map((s, i) => {
      if (i !== activeSquadIndex) return s
      const already = s.memberIds.includes(player.id)
      if (already) return { ...s, memberIds: s.memberIds.filter((id) => id !== player.id) }
      if (s.memberIds.length >= 3) return s
      return { ...s, memberIds: [...s.memberIds, player.id] }
    }))
  }

  function addSupportSquad() {
    const newSquads = [...squads, { label: 'support', memberIds: [] }]
    setSquads(newSquads)
    setActiveSquadIndex(newSquads.length - 1)
  }

  function removeSupportSquad(squadIndex) {
    if (squads[squadIndex]?.label === 'scoring') return
    const newSquads = squads.filter((_, i) => i !== squadIndex)
    setSquads(newSquads)
    if (activeSquadIndex >= newSquads.length) setActiveSquadIndex(newSquads.length - 1)
  }

  return (
    <div
      onClick={onCancel}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000, padding: '1.5rem',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          width: '100%',
          maxWidth: 860,
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Modal header */}
        <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: 14 }}>{event.title}</div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: '0.15rem' }}>Edit Squads</div>
          </div>
          <button onClick={onCancel} style={{ fontSize: 18, background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', padding: '0 0.25rem' }}>✕</button>
        </div>

        {/* Modal body — two columns */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', flex: 1, overflow: 'hidden' }}>

          {/* Left: player pool */}
          <div style={{ padding: '1rem', overflowY: 'auto', borderRight: '1px solid var(--border2)' }}>
            <div style={{ marginBottom: '0.75rem' }}>
              <span className="label">Player Pool</span>
              <p style={{ fontSize: 12, color: 'var(--muted)', margin: '0.25rem 0 0' }}>
                Click a player to add/remove from the selected squad.
              </p>
            </div>
            <AlphaPlayerGrid
              players={players}
              isSelected={(p) => assignedInActive.has(p.id)}
              isDisabled={(p) => !assignedInActive.has(p.id) && allAssigned.has(p.id)}
              onToggle={togglePlayer}
              renderSubtitle={(p) => {
                if (assignedInActive.has(p.id)) return null
                if (allAssigned.has(p.id)) {
                  const inSquad = squads.find((s) => s.memberIds.includes(p.id))
                  if (!inSquad) return null
                  const idx = squads.indexOf(inSquad)
                  return inSquad.label === 'scoring' ? 'in scoring' : `in ${supportLabel(squads, idx).toLowerCase()}`
                }
                return null
              }}
              maxSelected={3}
              selectedIds={activeSquad?.memberIds || []}
            />
          </div>

          {/* Right: squad slots */}
          <div style={{ padding: '1rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <span className="label">Squads</span>
            {squads.map((squad, i) => {
              const isScoring = squad.label === 'scoring'
              const isActive = i === activeSquadIndex
              const label = isScoring ? 'Scoring' : supportLabel(squads, i)
              return (
                <div
                  key={i}
                  onClick={() => setActiveSquadIndex(i)}
                  style={{
                    padding: '0.6rem 0.75rem',
                    borderRadius: 'var(--radius-sm)',
                    border: isActive
                      ? `2px solid ${isScoring ? 'var(--scoring)' : 'var(--accent)'}`
                      : '1px solid var(--border)',
                    background: isActive ? (isScoring ? 'rgba(227,179,65,0.08)' : 'rgba(57,208,216,0.08)') : 'var(--surface2)',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
                    <span style={{
                      fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600,
                      color: isScoring ? 'var(--scoring)' : isActive ? 'var(--accent)' : 'var(--muted)',
                      textTransform: 'uppercase', letterSpacing: '0.04em',
                    }}>
                      {label}
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--muted)' }}>{squad.memberIds.length}/3</span>
                  </div>
                  <div style={{ fontSize: 12, color: squad.memberIds.length === 0 ? 'var(--muted)' : 'var(--text)', minHeight: 18 }}>
                    {squad.memberIds.length === 0
                      ? 'Empty'
                      : squad.memberIds.map((id) => playersById[id]?.name || '?').join(', ')}
                  </div>
                  {!isScoring && isActive && (
                    <button
                      onClick={(e) => { e.stopPropagation(); removeSupportSquad(i) }}
                      className="btn-danger-outline"
                      style={{ fontSize: 10, padding: '0.1rem 0.4rem', marginTop: '0.4rem' }}
                    >
                      Remove squad
                    </button>
                  )}
                </div>
              )
            })}

            <button onClick={addSupportSquad} style={{ fontSize: 12, width: '100%', marginTop: '0.25rem' }}>
              + Add Support Squad
            </button>
          </div>
        </div>

        {/* Modal footer */}
        <div style={{ padding: '0.75rem 1.25rem', borderTop: '1px solid var(--border2)', display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
          <button onClick={onCancel}>Cancel</button>
          <button className="btn-primary" onClick={() => onSave(squads)} disabled={saving}>
            {saving ? 'Saving...' : 'Save Squads'}
          </button>
        </div>
      </div>
    </div>
  )
}
