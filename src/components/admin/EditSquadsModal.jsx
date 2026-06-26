import React, { useState, useEffect } from 'react'
import AlphaPlayerGrid from '../shared/AlphaPlayerGrid.jsx'
import RolePicker, { RolePill } from '../shared/RolePicker.jsx'
import { getRolePool, addRoleToPool, deleteRoleFromPool } from '../../data/schema.js'

function getSquadLabel(squads, index) {
  if (squads[index]?.label === 'scoring') return 'Scoring'
  const supportNum = squads.slice(0, index).filter(s => s.label === 'support').length + 1
  return `Support ${supportNum}`
}

export default function EditSquadsModal({ event, players, playersById, onSave, onCancel, saving }) {
  const [squads, setSquads] = useState(event.squads || [])
  const [activeSquadIndex, setActiveSquadIndex] = useState(0)
  const [rolePool, setRolePool] = useState([]) // { role, color }[]

  useEffect(() => {
    if (!event.trialNumber) return
    getRolePool(event.trialNumber).then(setRolePool)
  }, [event.trialNumber])

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
    const newSquads = [...squads, { label: 'support', memberIds: [], role: null }]
    setSquads(newSquads)
    setActiveSquadIndex(newSquads.length - 1)
  }

  function removeSupportSquad(squadIndex) {
    if (squads[squadIndex]?.label === 'scoring') return
    const newSquads = squads.filter((_, i) => i !== squadIndex)
    setSquads(newSquads)
    if (activeSquadIndex >= newSquads.length) setActiveSquadIndex(newSquads.length - 1)
  }

  function updateRole(squadIndex, role) {
    setSquads((prev) => prev.map((s, i) => i === squadIndex ? { ...s, role: role || null } : s))
  }

  async function handleDeleteRole(role) {
    await deleteRoleFromPool(event.trialNumber, role)
    getRolePool(event.trialNumber).then(setRolePool)
    // Clear from any squad in this modal that has the role
    setSquads(prev => prev.map(s => s.role === role ? { ...s, role: null } : s))
  }

  async function handleSave() {
    if (event.trialNumber) {
      await Promise.all(
        squads.map((s) => s.role?.trim()).filter(Boolean).map((role) => addRoleToPool(event.trialNumber, role))
      )
      // Refresh pool after saving so colors are up to date if caller re-opens modal
      getRolePool(event.trialNumber).then(setRolePool)
    }
    onSave(squads)
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
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius)', width: '100%', maxWidth: 900,
          maxHeight: '85vh', display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}
      >
        <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: 14 }}>{event.title}</div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: '0.15rem' }}>Edit Squads</div>
          </div>
          <button onClick={onCancel} style={{ fontSize: 18, background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer' }}>✕</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', flex: 1, overflow: 'hidden' }}>
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
                  return getSquadLabel(squads, squads.indexOf(inSquad)).toLowerCase()
                }
                return null
              }}
              maxSelected={3}
              selectedIds={activeSquad?.memberIds || []}
            />
          </div>

          <div style={{ padding: '1rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <span className="label">Squads</span>
            {squads.map((squad, i) => {
              const isScoring = squad.label === 'scoring'
              const isActive = i === activeSquadIndex
              const label = getSquadLabel(squads, i)
              const roleEntry = squad.role
                ? rolePool.find(e => e.role === squad.role) ?? { role: squad.role, color: 0 }
                : null

              return (
                <div
                  key={i}
                  onClick={() => setActiveSquadIndex(i)}
                  style={{
                    padding: '0.6rem 0.75rem', borderRadius: 'var(--radius-sm)',
                    border: isActive
                      ? `2px solid ${isScoring ? 'var(--scoring)' : 'var(--accent)'}`
                      : '1px solid var(--border)',
                    background: isActive
                      ? (isScoring ? 'rgba(227,179,65,0.08)' : 'rgba(57,208,216,0.08)')
                      : 'var(--surface2)',
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

                  <div style={{ fontSize: 12, color: squad.memberIds.length === 0 ? 'var(--muted)' : 'var(--text)', minHeight: 18, marginBottom: '0.4rem' }}>
                    {squad.memberIds.length === 0 ? 'Empty' : squad.memberIds.map((id) => playersById[id]?.name || '?').join(', ')}
                  </div>

                  {isActive ? (
                    <div onClick={(e) => e.stopPropagation()}>
                      <RolePicker
                        value={squad.role || ''}
                        onChange={(val) => updateRole(i, val)}
                        onDelete={handleDeleteRole}
                        onClear={() => updateRole(i, '')}
                        pool={rolePool}
                      />
                    </div>
                  ) : (
                    <div onClick={(e) => e.stopPropagation()}>
                      <RolePill entry={roleEntry} onClick={() => setActiveSquadIndex(i)} />
                    </div>
                  )}

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

        <div style={{ padding: '0.75rem 1.25rem', borderTop: '1px solid var(--border2)', display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
          <button onClick={onCancel}>Cancel</button>
          <button className="btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save Squads'}
          </button>
        </div>
      </div>
    </div>
  )
}
