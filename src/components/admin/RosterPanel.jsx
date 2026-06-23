import React, { useEffect, useState } from 'react'
import {
  getPlayers, addPlayer, updatePlayer, deletePlayer,
  getWeeklyStats, setWeeklyStatValue, cleanOrphanedSquadReferences,
} from '../../data/schema.js'
import { getWeekKey, formatWeekLabel } from '../../utils/weeks.js'
import SearchInput from '../shared/SearchInput.jsx'

export default function RosterPanel({ onViewScores }) {
  const [players, setPlayers] = useState([])
  const [weeklyStats, setWeeklyStats] = useState([])
  const [loading, setLoading] = useState(true)
  const [newName, setNewName] = useState('')
  const [saving, setSaving] = useState(false)
  const [cleaning, setCleaning] = useState(false)
  const [search, setSearch] = useState('')

  // Edit mode state (name + stats together)
  const [editingId, setEditingId] = useState(null)
  const [editName, setEditName] = useState('')
  const [editContribution, setEditContribution] = useState('')
  const [editScoringTurns, setEditScoringTurns] = useState('')

  const weekKey = getWeekKey()

  async function load() {
    const [data, stats] = await Promise.all([getPlayers(), getWeeklyStats(weekKey)])
    setPlayers(data.sort((a, b) => a.name.localeCompare(b.name)))
    setWeeklyStats(stats)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function handleAdd() {
    if (!newName.trim()) return
    setSaving(true)
    await addPlayer({ name: newName.trim() })
    setNewName('')
    await load()
    setSaving(false)
  }

  function startEdit(player, stats) {
    setEditingId(player.id)
    setEditName(player.name)
    setEditContribution(String(stats.contributionPoints))
    setEditScoringTurns(String(stats.scoreAchieved))
  }

  async function handleSaveEdit(id) {
    if (!editName.trim()) return
    setSaving(true)

    const ops = [updatePlayer(id, { name: editName.trim() })]

    const contribParsed = Number(editContribution)
    if (editContribution !== '' && !isNaN(contribParsed)) {
      ops.push(setWeeklyStatValue(weekKey, id, 'contributionPoints', contribParsed))
    }

    const turnsParsed = Number(editScoringTurns)
    if (editScoringTurns !== '' && !isNaN(turnsParsed)) {
      ops.push(setWeeklyStatValue(weekKey, id, 'scoreAchieved', turnsParsed))
    }

    await Promise.all(ops)
    setEditingId(null)
    await load()
    setSaving(false)
  }

  async function handleDelete(id, name) {
    if (!window.confirm(`Remove ${name} from the roster? Their stats are preserved.`)) return
    const affectedEvents = await deletePlayer(id)
    await load()

    if (affectedEvents.length > 0) {
      const STATUS_LABELS = { active: 'Upcoming', success: 'Complete', failed: 'Incomplete', cancelled: 'Cancelled' }
      const list = affectedEvents
        .map((e) => `• ${e.title} (${STATUS_LABELS[e.status] || e.status})`)
        .join('\n')
      window.alert(`${name} was removed from the following event squad(s):\n\n${list}`)
    }
  }

  async function handleCleanup() {
    if (!window.confirm('Scan all events for broken squad references (from players deleted before this fix existed) and remove them?')) return
    setCleaning(true)
    const affected = await cleanOrphanedSquadReferences()
    setCleaning(false)

    if (affected.length === 0) {
      window.alert('No broken squad references found. Everything looks clean.')
    } else {
      const list = affected.map((e) => `• ${e.title} (${e.removedIds.length} removed)`).join('\n')
      window.alert(`Cleaned up ${affected.length} event(s):\n\n${list}`)
    }
  }

  if (loading) return <p>Loading roster...</p>

  const statsByPlayer = Object.fromEntries(weeklyStats.map((s) => [s.playerId, s]))
  const displayedPlayers = (search.trim()
    ? players.filter((p) => p.name.toLowerCase().includes(search.trim().toLowerCase()))
    : players
  ).sort((a, b) => {
    const aStats = statsByPlayer[a.id] || { contributionPoints: 0, scoreAchieved: 0 }
    const bStats = statsByPlayer[b.id] || { contributionPoints: 0, scoreAchieved: 0 }
    if (bStats.contributionPoints !== aStats.contributionPoints)
      return bStats.contributionPoints - aStats.contributionPoints
    return aStats.scoreAchieved - bStats.scoreAchieved // fewer scoring turns = higher priority
  })

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>
        Roster <span style={{ color: 'var(--muted)', fontWeight: 400, fontSize: 13 }}>({players.length} players)</span>
      </h2>
      <p style={{ marginBottom: '1rem', fontSize: 13 }}>
        Contribution and scoring turns shown below are for {formatWeekLabel(weekKey).toLowerCase()}.
        These update automatically when you finalize events. Click Edit to correct them manually.
      </p>

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div>
          <span className="label">Name</span>
          <input
            placeholder="Player name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            style={{ width: 220 }}
          />
        </div>
        <div>
          <button className="btn-primary" onClick={handleAdd} disabled={saving || !newName.trim()}>
            Add Player
          </button>
        </div>
        <div style={{ marginLeft: 'auto' }}>
          <span className="label">Search</span>
          <SearchInput value={search} onChange={setSearch} placeholder="Find a player..." />
        </div>
      </div>

      {players.length === 0 && (
        <div className="empty-state"><p>No players yet. Add some above.</p></div>
      )}

      {players.length > 0 && displayedPlayers.length === 0 && (
        <div className="empty-state"><p>No players match "{search}".</p></div>
      )}

      {displayedPlayers.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Contribution</th>
              <th>Scoring Turns</th>
              <th>Scores</th>
              <th style={{ width: 150 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {displayedPlayers.map((p) => {
              const stats = statsByPlayer[p.id] || { contributionPoints: 0, scoreAchieved: 0 }
              const isEditing = editingId === p.id

              return (
                <tr key={p.id}>
                  {isEditing ? (
                    <>
                      <td><input value={editName} onChange={(e) => setEditName(e.target.value)} style={{ width: '100%' }} /></td>
                      <td>
                        <input
                          type="number"
                          min="0"
                          value={editContribution}
                          onChange={(e) => setEditContribution(e.target.value)}
                          style={{ width: 60, fontFamily: 'var(--font-mono)' }}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          min="0"
                          value={editScoringTurns}
                          onChange={(e) => setEditScoringTurns(e.target.value)}
                          style={{ width: 60, fontFamily: 'var(--font-mono)' }}
                        />
                      </td>
                      <td style={{ color: 'var(--muted)', fontSize: 12 }}>—</td>
                      <td style={{ display: 'flex', gap: '0.4rem' }}>
                        <button className="btn-success" onClick={() => handleSaveEdit(p.id)} disabled={saving}>Save</button>
                        <button onClick={() => setEditingId(null)}>Cancel</button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td style={{ fontWeight: 500 }}>{p.name}</td>
                      <td><span className="stat-num">{stats.contributionPoints}</span></td>
                      <td><span className="stat-num" style={{ color: 'var(--scoring)' }}>{stats.scoreAchieved}</span></td>
                      <td>
                        <button onClick={() => onViewScores?.(p.name)} style={{ fontSize: 12 }}>View Scores</button>
                      </td>
                      <td style={{ display: 'flex', gap: '0.4rem' }}>
                        <button onClick={() => startEdit(p, stats)} style={{ fontSize: 12 }}>Edit</button>
                        <button className="btn-danger-outline" onClick={() => handleDelete(p.id, p.name)} style={{ fontSize: 12 }}>Remove</button>
                      </td>
                    </>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </div>
  )
}
