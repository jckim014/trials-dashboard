import React, { useEffect, useState } from 'react'
import { getPlayers, getTrialScoresForWeek, setTrialScore, getTrialNames, setTrialName } from '../../data/schema.js'
import { getWeekKey, formatWeekLabel } from '../../utils/weeks.js'
import WeekPicker from '../shared/WeekPicker.jsx'
import SearchInput from '../shared/SearchInput.jsx'

const TRIAL_NUMBERS = [1, 2, 3, 4, 5]

export default function TrialScoresPanel({ initialSearch = '' }) {
  const [players, setPlayers] = useState([])
  const [scores, setScores] = useState({})
  const [trialNames, setTrialNames] = useState({})
  const [weekKey, setWeekKey] = useState(getWeekKey())
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState(initialSearch)
  const [editingPlayerId, setEditingPlayerId] = useState(null)
  const [editingTrialNum, setEditingTrialNum] = useState(null)

  useEffect(() => { setSearch(initialSearch) }, [initialSearch])

  async function load() {
    setLoading(true)
    const [plyrs, rawScores, names] = await Promise.all([
      getPlayers(),
      getTrialScoresForWeek(weekKey),
      getTrialNames(weekKey),
    ])
    setPlayers(plyrs.sort((a, b) => a.name.localeCompare(b.name)))
    const scoreMap = {}
    for (const s of rawScores) {
      if (!scoreMap[s.playerId]) scoreMap[s.playerId] = {}
      scoreMap[s.playerId][s.trialNumber] = s.score
    }
    setScores(scoreMap)
    setTrialNames(names)
    setEditingPlayerId(null)
    setEditingTrialNum(null)
    setLoading(false)
  }

  useEffect(() => { load() }, [weekKey])

  async function handleSaveTrialName(trialNum, name) {
    const trimmed = name.trim() || `Trial ${trialNum}`
    await setTrialName(weekKey, trialNum, trimmed)
    setTrialNames((prev) => ({ ...prev, [trialNum]: trimmed }))
    setEditingTrialNum(null)
  }

  const displayedPlayers = search.trim()
    ? players.filter((p) => p.name.toLowerCase().includes(search.trim().toLowerCase()))
    : players

  if (loading) return <p>Loading trial scores...</p>

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <WeekPicker value={weekKey} onChange={setWeekKey} />
        <span style={{ color: 'var(--muted)', fontSize: 13 }}>{formatWeekLabel(weekKey)}</span>
        <div style={{ marginLeft: 'auto' }}>
          <span className="label">Search Player</span>
          <SearchInput value={search} onChange={setSearch} placeholder="Type a name..." />
        </div>
      </div>

      <p style={{ marginBottom: '1rem', fontSize: 13 }}>
        Click a trial name to rename it for this week. Click a row to edit that player's scores.
      </p>

      {displayedPlayers.length === 0 && (
        <div className="empty-state"><p>No players match "{search}".</p></div>
      )}

      {displayedPlayers.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>Player</th>
              {TRIAL_NUMBERS.map((n) => (
                <th key={n} style={{ minWidth: 110 }}>
                  {editingTrialNum === n ? (
                    <TrialNameEditor
                      initialValue={trialNames[n]}
                      onSave={(name) => handleSaveTrialName(n, name)}
                      onCancel={() => setEditingTrialNum(null)}
                    />
                  ) : (
                    <button
                      onClick={() => setEditingTrialNum(n)}
                      title="Click to rename"
                      className="trial-name-btn"
                      style={{
                        background: 'none', border: 'none',
                        padding: '0.2rem 0.4rem', margin: '-0.2rem -0.4rem',
                        borderRadius: 'var(--radius-sm)',
                        font: 'inherit', color: 'inherit', textTransform: 'none',
                        letterSpacing: 'inherit', cursor: 'pointer', textAlign: 'left',
                        display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
                      }}
                    >
                      {trialNames[n] || `Trial ${n}`}
                      <span style={{ fontSize: 10, opacity: 0.5 }}>✎</span>
                    </button>
                  )}
                </th>
              ))}
              <th style={{ width: 70 }}></th>
            </tr>
          </thead>
          <tbody>
            {displayedPlayers.map((player) =>
              editingPlayerId === player.id ? (
                <PlayerEditRow
                  key={player.id}
                  player={player}
                  weekKey={weekKey}
                  initialScores={scores[player.id] || {}}
                  onCancel={() => setEditingPlayerId(null)}
                  onSaved={load}
                />
              ) : (
                <tr
                  key={player.id}
                  onClick={() => setEditingPlayerId(player.id)}
                  style={{ cursor: 'pointer' }}
                >
                  <td style={{ fontWeight: 500 }}>{player.name}</td>
                  {TRIAL_NUMBERS.map((n) => (
                    <td key={n} style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}>
                      {scores[player.id]?.[n] ?? <span style={{ color: 'var(--muted)' }}>—</span>}
                    </td>
                  ))}
                  <td>
                    <button onClick={(e) => { e.stopPropagation(); setEditingPlayerId(player.id) }} style={{ fontSize: 12 }}>
                      Edit
                    </button>
                  </td>
                </tr>
              )
            )}
          </tbody>
        </table>
      )}
    </div>
  )
}

function TrialNameEditor({ initialValue, onSave, onCancel }) {
  const [value, setValue] = useState(initialValue || '')

  function handleKeyDown(e) {
    if (e.key === 'Enter') onSave(value)
    if (e.key === 'Escape') onCancel()
  }

  return (
    <input
      autoFocus
      className="trial-name-input"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={handleKeyDown}
      onBlur={() => onSave(value)}
      onClick={(e) => e.stopPropagation()}
      style={{
        width: '100%', fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 500,
        padding: '0.3rem 0.5rem', textTransform: 'none',
      }}
    />
  )
}

function PlayerEditRow({ player, weekKey, initialScores, onCancel, onSaved }) {
  const [values, setValues] = useState(() => {
    const v = {}
    for (const n of TRIAL_NUMBERS) v[n] = initialScores[n] !== undefined ? String(initialScores[n]) : ''
    return v
  })
  const [saving, setSaving] = useState(false)

  function handleChange(trialNum, value) {
    setValues((prev) => ({ ...prev, [trialNum]: value }))
  }

  async function handleSave() {
    setSaving(true)
    const ops = []
    for (const n of TRIAL_NUMBERS) {
      const value = values[n]
      const original = initialScores[n] !== undefined ? String(initialScores[n]) : ''
      if (value === original) continue
      const parsed = Number(value)
      if (value === '' || isNaN(parsed)) continue
      ops.push(setTrialScore(weekKey, player.id, n, parsed))
    }
    await Promise.all(ops)
    setSaving(false)
    onSaved?.()
  }

  return (
    <tr style={{ background: 'var(--surface2)' }}>
      <td style={{ fontWeight: 500 }}>{player.name}</td>
      {TRIAL_NUMBERS.map((n) => (
        <td key={n}>
          <input
            type="number"
            min="0"
            value={values[n]}
            onChange={(e) => handleChange(n, e.target.value)}
            placeholder="—"
            style={{ width: '100%', boxSizing: 'border-box', fontFamily: 'var(--font-mono)', fontSize: 14, padding: '0.4rem 0.5rem' }}
            autoFocus={n === 1}
          />
        </td>
      ))}
      <td style={{ display: 'flex', gap: '0.3rem' }}>
        <button className="btn-success" onClick={handleSave} disabled={saving} style={{ fontSize: 11, padding: '0.2rem 0.5rem' }}>
          {saving ? '...' : 'Save'}
        </button>
        <button onClick={onCancel} style={{ fontSize: 11, padding: '0.2rem 0.5rem' }}>
          Cancel
        </button>
      </td>
    </tr>
  )
}
