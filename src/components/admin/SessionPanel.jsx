import React, { useEffect, useState } from 'react'
import {
  getPlayers, getTrialNames,
  getActiveSession, getSessionsForWeek, createSession, updateSession,
  completeWave, cancelWave,
} from '../../data/schema.js'
import { getWeekKey, formatWeekLabel } from '../../utils/weeks.js'
import AlphaPlayerGrid from '../shared/AlphaPlayerGrid.jsx'

const TRIAL_NUMBERS = [1, 2, 3, 4, 5]

function genId() {
  return Math.random().toString(36).slice(2, 10)
}

export default function SessionPanel() {
  const [players, setPlayers] = useState([])
  const [trialNames, setTrialNames] = useState({})
  const [session, setSession] = useState(null)
  const [pastSessions, setPastSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [newTrial, setNewTrial] = useState('')

  const weekKey = getWeekKey()

  async function load() {
    const [plyrs, names, active, allSessions] = await Promise.all([
      getPlayers(),
      getTrialNames(weekKey),
      getActiveSession(),
      getSessionsForWeek(weekKey),
    ])
    setPlayers(plyrs)
    setTrialNames(names)
    setSession(active)
    setPastSessions(allSessions.filter((s) => s.status === 'closed'))
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const playersById = Object.fromEntries(players.map((p) => [p.id, p]))

  async function handleCreateSession() {
    if (!newTrial) return
    await createSession({ weekKey, trialNumber: Number(newTrial) })
    setNewTrial('')
    await load()
  }

  async function handleAddRun() {
    const runs = [...(session.runs || []), { id: genId(), playerIds: [], status: 'pending' }]
    if (runs.length === 1) runs[0].status = 'active'
    await updateSession(session.id, { runs })
    await load()
  }

  async function handleUpdateRunPlayers(runIndex, playerIds) {
    const runs = session.runs.map((r, i) => i === runIndex ? { ...r, playerIds } : r)
    await updateSession(session.id, { runs })
    await load()
  }

  async function handleMoveRun(runIndex, direction) {
    const runs = [...session.runs]
    const target = runIndex + direction
    if (target < 0 || target >= runs.length) return
    ;[runs[runIndex], runs[target]] = [runs[target], runs[runIndex]]
    await updateSession(session.id, { runs })
    await load()
  }

  async function handleDeleteRun(runIndex) {
    const runs = session.runs.filter((_, i) => i !== runIndex)
    await updateSession(session.id, { runs })
    await load()
  }

  async function handleCompleteRun(runIndex) {
    await completeWave(session, runIndex)
    await load()
  }

  async function handleCancelRun(runIndex) {
    if (!window.confirm('Cancel this run?')) return
    await cancelWave(session, runIndex)
    await load()
  }

  async function handleCloseSession() {
    if (!window.confirm('Close this session? It will be archived and a new one can be started.')) return
    await updateSession(session.id, { status: 'closed' })
    await load()
  }

  if (loading) return <p>Loading session...</p>

  return (
    <div>
      {!session ? (
        <div style={{ maxWidth: 400 }}>
          <h2 style={{ marginTop: 0 }}>Start a Session</h2>
          <p style={{ fontSize: 13, marginBottom: '1.5rem' }}>
            A session is a planning scratchpad for tracking scoring rotation.
            No points are awarded here — use events for official credit.
            Current week: {formatWeekLabel(weekKey)}.
          </p>
          <div style={{ marginBottom: '1rem' }}>
            <span className="label">Trial</span>
            <select value={newTrial} onChange={(e) => setNewTrial(e.target.value)} style={{ minWidth: 180 }}>
              <option value="">— Select trial —</option>
              {TRIAL_NUMBERS.map((n) => (
                <option key={n} value={n}>{trialNames[n] || `Trial ${n}`}</option>
              ))}
            </select>
          </div>
          <button className="btn-primary" onClick={handleCreateSession} disabled={!newTrial} style={{ padding: '0.5rem 1.5rem' }}>
            Start Session
          </button>
        </div>
      ) : (
        <ActiveSession
          session={session}
          players={players}
          playersById={playersById}
          trialNames={trialNames}
          onAddRun={handleAddRun}
          onUpdateRunPlayers={handleUpdateRunPlayers}
          onMoveRun={handleMoveRun}
          onDeleteRun={handleDeleteRun}
          onCompleteRun={handleCompleteRun}
          onCancelRun={handleCancelRun}
          onCloseSession={handleCloseSession}
        />
      )}

      {pastSessions.length > 0 && (
        <PastSessions sessions={pastSessions} playersById={playersById} trialNames={trialNames} />
      )}
    </div>
  )
}

// ── Active Session ───────────────────────────────────────────────────────────

function ActiveSession({ session, players, playersById, trialNames, onAddRun, onUpdateRunPlayers, onMoveRun, onDeleteRun, onCompleteRun, onCancelRun, onCloseSession }) {
  const [editingRunIndex, setEditingRunIndex] = useState(null)

  const trialName = trialNames[session.trialNumber] || `Trial ${session.trialNumber}`
  const activeRunIndex = session.runs.findIndex((r) => r.status === 'active')
  const completedCount = session.runs.filter((r) => r.status === 'complete').length
  const pendingCount = session.runs.filter((r) => r.status === 'pending').length

  const scoredInSession = new Set(
    session.runs.filter((r) => r.status === 'complete').flatMap((r) => r.playerIds || [])
  )

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div>
          <h2 style={{ marginTop: 0, marginBottom: '0.25rem' }}>Session: {trialName}</h2>
          <p style={{ fontSize: 13, margin: 0 }}>
            {completedCount} run{completedCount !== 1 ? 's' : ''} complete · {pendingCount} upcoming
            <span style={{ marginLeft: '0.75rem', color: 'var(--muted)', fontSize: 12 }}>Planning only — no points awarded</span>
          </p>
        </div>
        <button className="btn-neutral" onClick={onCloseSession} style={{ fontSize: 12 }}>Close Session</button>
      </div>

      {/* Player pool overview */}
      <div style={{ marginBottom: '1.5rem', padding: '0.75rem', background: 'var(--surface)', border: '1px solid var(--border2)', borderRadius: 'var(--radius)' }}>
        <span className="label" style={{ marginBottom: '0.4rem' }}>Player Pool</span>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
          {[...players].sort((a, b) => a.name.localeCompare(b.name)).map((p) => {
            const scored = scoredInSession.has(p.id)
            return (
              <div key={p.id} style={{
                padding: '0.2rem 0.6rem', fontSize: 12, borderRadius: 16,
                border: `1px solid ${scored ? 'var(--success)' : 'var(--border)'}`,
                background: scored ? 'rgba(63,185,80,0.1)' : 'var(--surface2)',
                color: scored ? 'var(--success)' : 'var(--text)',
              }}>
                {p.name}{scored ? ' ✓' : ''}
              </div>
            )
          })}
        </div>
      </div>

      {/* Runs */}
      <span className="label">Runs</span>
      {session.runs.length === 0 && (
        <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: '0.5rem' }}>No runs yet — add one below.</p>
      )}
      {session.runs.map((run, index) => (
        <RunCard
          key={run.id}
          run={run}
          runNumber={index + 1}
          playersById={playersById}
          players={players}
          scoredInSession={scoredInSession}
          isActive={index === activeRunIndex}
          isPending={run.status === 'pending'}
          isEditing={editingRunIndex === index}
          onEdit={() => setEditingRunIndex(index)}
          onCancelEdit={() => setEditingRunIndex(null)}
          onSavePlayers={(playerIds) => { onUpdateRunPlayers(index, playerIds); setEditingRunIndex(null) }}
          onComplete={() => onCompleteRun(index)}
          onCancel={() => onCancelRun(index)}
          onMoveUp={() => onMoveRun(index, -1)}
          onMoveDown={() => onMoveRun(index, 1)}
          onDelete={() => onDeleteRun(index)}
        />
      ))}

      <button onClick={onAddRun} style={{ marginTop: '0.5rem', fontSize: 12, width: '100%' }}>
        + Add Run
      </button>
    </div>
  )
}

// ── Run Card ─────────────────────────────────────────────────────────────────

function RunCard({ run, runNumber, playersById, players, scoredInSession, isActive, isPending, isEditing, onEdit, onCancelEdit, onSavePlayers, onComplete, onCancel, onMoveUp, onMoveDown, onDelete }) {
  const [selectedIds, setSelectedIds] = useState(run.playerIds || [])

  useEffect(() => { setSelectedIds(run.playerIds || []) }, [run.playerIds])

  const borderColor = { complete: 'var(--success)', cancelled: 'var(--muted)', active: 'var(--accent)', pending: 'var(--border2)' }[run.status]
  const statusLabel = { complete: 'Complete', cancelled: 'Cancelled', active: 'Active', pending: 'Upcoming' }[run.status]
  const badgeClass = { complete: 'success', cancelled: 'cancelled', active: 'active', pending: '' }[run.status]
  const playerNames = (run.playerIds || []).map((id) => playersById[id]?.name || '?')

  return (
    <div className="card" style={{ marginBottom: '0.5rem', borderLeft: `3px solid ${borderColor}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase' }}>
              Run {runNumber}
            </span>
            {badgeClass
              ? <span className={`badge ${badgeClass}`} style={{ fontSize: 10 }}>{statusLabel}</span>
              : <span style={{ fontSize: 11, color: 'var(--muted)' }}>{statusLabel}</span>
            }
          </div>
          {!isEditing && (
            <div style={{ fontSize: 13 }}>
              {playerNames.length === 0
                ? <span style={{ color: 'var(--muted)' }}>No players assigned</span>
                : playerNames.join(', ')}
            </div>
          )}
        </div>

        {!isEditing && (
          <div style={{ display: 'flex', gap: '0.3rem', flexShrink: 0, marginLeft: '0.5rem' }}>
            {(isActive || isPending) && (
              <button onClick={onEdit} style={{ fontSize: 11, padding: '0.2rem 0.5rem' }}>Edit</button>
            )}
            {isPending && (
              <>
                <button onClick={onMoveUp} style={{ fontSize: 11, padding: '0.2rem 0.4rem' }} title="Move up">↑</button>
                <button onClick={onMoveDown} style={{ fontSize: 11, padding: '0.2rem 0.4rem' }} title="Move down">↓</button>
                <button onClick={onDelete} className="btn-danger-outline" style={{ fontSize: 11, padding: '0.2rem 0.5rem' }}>✕</button>
              </>
            )}
            {isActive && (
              <>
                <button className="btn-success" onClick={onComplete} style={{ fontSize: 11, padding: '0.2rem 0.6rem' }}>Complete</button>
                <button className="btn-neutral" onClick={onCancel} style={{ fontSize: 11, padding: '0.2rem 0.5rem' }}>Cancel</button>
              </>
            )}
          </div>
        )}
      </div>

      {isEditing && (
        <div style={{ marginTop: '0.75rem' }}>
          <p style={{ fontSize: 12, marginBottom: '0.75rem' }}>
            Select up to 3 players. ✓ = already completed a run this session.
          </p>
          <AlphaPlayerGrid
            players={players}
            isSelected={(p) => selectedIds.includes(p.id)}
            isDisabled={() => false}
            onToggle={(p) => setSelectedIds((prev) =>
              prev.includes(p.id)
                ? prev.filter((id) => id !== p.id)
                : prev.length < 3 ? [...prev, p.id] : prev
            )}
            renderSubtitle={(p) =>
              scoredInSession.has(p.id) && !run.playerIds.includes(p.id) ? '✓ ran this session' : null
            }
            maxSelected={3}
            selectedIds={selectedIds}
          />
          <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.75rem' }}>
            <button className="btn-primary" onClick={() => onSavePlayers(selectedIds)} style={{ fontSize: 12 }}>Save</button>
            <button onClick={onCancelEdit} style={{ fontSize: 12 }}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Past Sessions ────────────────────────────────────────────────────────────

function PastSessions({ sessions, playersById, trialNames }) {
  const [expanded, setExpanded] = useState(false)
  const [expandedSession, setExpandedSession] = useState(null)

  return (
    <div style={{ marginTop: '2rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border2)' }}>
      <button
        onClick={() => setExpanded((v) => !v)}
        style={{
          display: 'flex', alignItems: 'center', gap: '0.4rem',
          background: 'none', border: 'none', padding: 0,
          color: 'var(--muted)', fontSize: 13, fontWeight: 600,
          fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.04em',
          cursor: 'pointer',
        }}
      >
        <span style={{ display: 'inline-block', transition: 'transform 0.15s', transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)' }}>▸</span>
        Past Sessions ({sessions.length})
      </button>

      {expanded && (
        <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {sessions.map((s) => {
            const trialName = trialNames[s.trialNumber] || `Trial ${s.trialNumber}`
            const completedRuns = (s.runs || []).filter((r) => r.status === 'complete')
            const isExpanded = expandedSession === s.id
            return (
              <div key={s.id} className="card">
                <div
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
                  onClick={() => setExpandedSession(isExpanded ? null : s.id)}
                >
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{trialName}</div>
                    <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: '0.15rem' }}>
                      {completedRuns.length} run{completedRuns.length !== 1 ? 's' : ''} completed · {s.runs?.length || 0} total
                    </div>
                  </div>
                  <span style={{ color: 'var(--muted)', fontSize: 12 }}>{isExpanded ? '▲' : '▼'}</span>
                </div>

                {isExpanded && (
                  <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border2)' }}>
                    {(s.runs || []).map((run, i) => {
                      const playerNames = (run.playerIds || []).map((id) => playersById[id]?.name || '?')
                      const borderColor = { complete: 'var(--success)', cancelled: 'var(--muted)', active: 'var(--accent)', pending: 'var(--border2)' }[run.status]
                      const statusLabel = { complete: 'Complete', cancelled: 'Cancelled', active: 'Active', pending: 'Upcoming' }[run.status]
                      return (
                        <div key={run.id || i} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.3rem 0', borderLeft: `3px solid ${borderColor}`, paddingLeft: '0.6rem', marginBottom: '0.3rem' }}>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--muted)', minWidth: 50 }}>Run {i + 1}</span>
                          <span style={{ fontSize: 13, flex: 1 }}>{playerNames.join(', ') || '—'}</span>
                          <span style={{ fontSize: 11, color: 'var(--muted)' }}>{statusLabel}</span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
