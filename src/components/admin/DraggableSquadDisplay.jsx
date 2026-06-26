import React, { useState, useEffect } from 'react'
import RolePicker, { RolePill } from '../shared/RolePicker.jsx'
import { getRolePool, addRoleToPool, deleteRoleFromPool } from '../../data/schema.js'

function squadLabel(squads, index) {
  const s = squads[index]
  if (s?.label === 'scoring') return 'Scoring'
  const supportNum = squads.slice(0, index).filter(x => x.label === 'support').length + 1
  return `Support ${supportNum}`
}

export default function DraggableSquadDisplay({ squads, playersById, onSquadsChange, trialNumber }) {
  const [dragState, setDragState] = useState(null)
  const [overSquadIndex, setOverSquadIndex] = useState(null)
  const [editingRoleIndex, setEditingRoleIndex] = useState(null)
  const [roleValue, setRoleValue] = useState('')
  const [rolePool, setRolePool] = useState([]) // { role, color }[]

  useEffect(() => {
    if (!trialNumber) return
    getRolePool(trialNumber).then(setRolePool)
  }, [trialNumber])

  if (!squads || squads.length === 0) return null

  function handleDragStart(e, playerId, fromSquadIndex) {
    setDragState({ playerId, fromSquadIndex })
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', playerId)
  }

  function handleDragEnd() { setDragState(null); setOverSquadIndex(null) }

  function handleDragOver(e, toSquadIndex) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setOverSquadIndex(toSquadIndex)
  }

  function handleDragLeave() { setOverSquadIndex(null) }

  function handleDrop(e, toSquadIndex) {
    e.preventDefault()
    setOverSquadIndex(null)
    if (!dragState) return
    const { playerId, fromSquadIndex } = dragState
    if (fromSquadIndex === toSquadIndex) return
    const newSquads = squads.map((squad, i) => {
      if (i === fromSquadIndex) return { ...squad, memberIds: squad.memberIds.filter(id => id !== playerId) }
      if (i === toSquadIndex) return { ...squad, memberIds: [...squad.memberIds, playerId] }
      return squad
    })
    onSquadsChange(newSquads)
    setDragState(null)
  }

  function startEditRole(i) {
    setEditingRoleIndex(i)
    setRoleValue(squads[i]?.role || '')
  }

  async function saveRole(i, overrideValue) {
    const trimmed = (overrideValue ?? roleValue).trim()
    const newSquads = squads.map((s, idx) => idx === i ? { ...s, role: trimmed || null } : s)
    onSquadsChange(newSquads)
    if (trimmed && trialNumber) {
      await addRoleToPool(trialNumber, trimmed)
      getRolePool(trialNumber).then(setRolePool)
    }
    setEditingRoleIndex(null)
  }

  function cancelEditRole() {
    setEditingRoleIndex(null)
  }

  async function handleDeleteRole(role) {
    await deleteRoleFromPool(trialNumber, role)
    getRolePool(trialNumber).then(setRolePool)
    // If any visible squad has this role, clear it locally too
    const newSquads = squads.map(s => s.role === role ? { ...s, role: null } : s)
    if (newSquads.some((s, i) => s.role !== squads[i].role)) onSquadsChange(newSquads)
  }

  return (
    <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      {squads.map((squad, i) => {
        const isScoring = squad.label === 'scoring'
        const isOver = overSquadIndex === i
        const isOverCapacity = squad.memberIds.length > 3
        const isEditingRole = editingRoleIndex === i
        // Find the pool entry for this squad's current role (for color)
        const roleEntry = squad.role ? rolePool.find(e => e.role === squad.role) ?? { role: squad.role, color: 0 } : null

        return (
          <div
            key={i}
            onDragOver={(e) => handleDragOver(e, i)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, i)}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap',
              padding: '0.3rem 0.5rem', borderRadius: 'var(--radius-sm)',
              border: isOver ? `2px dashed ${isScoring ? 'var(--accent)' : 'var(--muted)'}` : '2px solid transparent',
              background: isOver ? 'rgba(57,208,216,0.05)' : 'transparent',
              transition: 'border-color 0.1s, background 0.1s', minHeight: 32,
            }}
          >
            <span style={{
              fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 600,
              color: isScoring ? 'var(--accent)' : 'var(--muted)',
              textTransform: 'uppercase', letterSpacing: '0.05em',
              minWidth: 56, flexShrink: 0, userSelect: 'none',
            }}>
              {squadLabel(squads, i)}
            </span>

            {isEditingRole ? (
              <div
                style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                onBlur={(e) => {
                  // Use timeout so mousedown-based dropdown selections complete first
                  const currentTarget = e.currentTarget
                  setTimeout(() => {
                    if (!currentTarget.contains(document.activeElement)) cancelEditRole()
                  }, 150)
                }}
                onKeyDown={(e) => { if (e.key === 'Enter') saveRole(i); if (e.key === 'Escape') cancelEditRole() }}
              >
                <div style={{ width: 160 }}>
                  <RolePicker
                    value={roleValue}
                    onChange={setRoleValue}
                    onSelect={(label) => saveRole(i, label)}
                    onDelete={handleDeleteRole}
                    pool={rolePool}
                    autoFocus
                  />
                </div>
                <button onClick={() => saveRole(i)} style={{ fontSize: 10, padding: '0.1rem 0.4rem' }} title="Save">✓</button>
                <button onClick={cancelEditRole} style={{ fontSize: 10, padding: '0.1rem 0.4rem' }} title="Cancel">✕</button>
              </div>
            ) : (
              <RolePill entry={roleEntry} onClick={() => startEditRole(i)} />
            )}

            {isOverCapacity && (
              <span style={{ fontSize: 10, color: 'var(--warning)', fontFamily: 'var(--font-mono)' }}>
                {squad.memberIds.length}/3 ⚠
              </span>
            )}

            {squad.memberIds.length === 0 && !isOver && !isEditingRole && (
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
                    display: 'inline-block', fontSize: 12, fontWeight: 500,
                    padding: '0.2rem 0.65rem', borderRadius: 20,
                    background: isDragging ? 'var(--surface2)' : isScoring ? 'rgba(57,208,216,0.15)' : 'rgba(30,30,30,0.6)',
                    border: `1px solid ${isDragging ? 'var(--border)' : isScoring ? 'rgba(57,208,216,0.4)' : 'rgba(80,80,80,0.6)'}`,
                    color: isDragging ? 'var(--muted)' : 'var(--text)',
                    cursor: 'grab', opacity: isDragging ? 0.5 : 1,
                    userSelect: 'none', transition: 'opacity 0.1s',
                  }}
                  title="Drag to move to another squad"
                >
                  {name}
                </span>
              )
            })}

            {isOver && squad.memberIds.length === 0 && (
              <span style={{ fontSize: 12, color: 'var(--accent)', fontStyle: 'italic' }}>Drop here</span>
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
