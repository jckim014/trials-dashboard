import React, { useEffect, useState } from 'react'
import {
  getPlayers, getWeeklyStats, getTrialNames,
  getActiveSession, getSessionsForWeek, createSession, updateSession,
  completeWave, cancelWave,
} from '../../data/schema.js'
import { getWeekKey, formatWeekLabel } from '../../utils/weeks.js'
import { suggestScoringCandidates } from '../../utils/suggestions.js'

const TRIAL_NUMBERS = [1, 2, 3, 4, 5]

function genId() {
  return Math.random().toString(36).slice(2, 10)
}

export default function SessionPanel() {
  const [players, setPlayers] = useState([])
  const [weeklyStats, setWeeklyStats] = useState([])
  const [trialNames, setTrialNames] = useState({})
  const [session, setSession] = useState(null)
  const [pastSessions, setPastSessions] = useState([])
  const [loading, setLoading] = useState(true)

  const [newTrial, setNewTrial] = useState('')

  const [completingRunIndex, setCompletingRunIndex] = useState(null)
  const [completeScore, setCompleteScore] = useState('')
  const [saving, setSaving] = useState(false)

  const weekKey = getWeekKey()

  async function load() {
    const [plyrs, stats, names, active, allSessions] = await Promise.all([
      getPlayers(),
      getWeeklyStats(weekKey),
      getTrialNames(weekKey),
      getActiveSession(),
      getSessionsForWeek(weekKey),
    ])
    setPlayers(plyrs)
    setWeeklyStats(stats)
    setTrialNames(names)
    setSession(active)
    setPastSessions(allSessions.filter((s) => s.status === 'closed'))
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const statsByPlayer = Object.fromEntries(weeklyStats.map((s) => [s.playerId, s]))
  const playersById = Object.fromEntries(players.map((p) => [p.id, p]))
  const suggestedOrder = suggestScoringCandidates(players, weeklyStats)

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
    const runs = session.runs.map((w, i) => i === runIndex ? { ...w, playerIds } : w)
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

  async function handleCompleteRun() {
    if (completingRunIndex === null) return
    const score = completeScore.trim() === '' ? null : Number(completeScore)
    setSaving(true)
    await completeWave(session, completingRunIndex, isNaN(score) ? null : score)
    setCompletingRunIndex(null)
    setCompleteScore('')
    setSaving(false)
    await load()
  }

  async function handleCancelRun(runIndex) {
    if (!window.confirm('Cancel this run? No points will be awarded.')) return
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
        // ── New session form ──
        <div style={{ maxWidth: 400 }}>
          <h2 style={{ marginTop: 0 }}>Start a Session</h2>
          <p style={{ fontSize: 13, marginBottom: '1.5rem' }}>
            A session tracks the scoring rotation for one trial. All players on the roster are available to assign to runs.
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
          <button
            className="btn-primary"
            onClick={handleCreateSession}
            disabled={!newTrial}
            style={{ padding: '0.5rem 1.5rem' }}
          >
            Start Session
          </button>
        </div>
      ) : (
        // ── Active session ──
        <ActiveSession
          session={session}
          players={suggestedOrder}
          playersById={playersById}
          statsByPlayer={statsByPlayer}
          trialNames={trialNames}
          onAddRun={handleAddRun}
          onUpdateRunPlayers={handleUpdateRunPlayers}
          onMoveRun={handleMoveRun}
          onDeleteRun={handleDeleteRun}
          onCompleteRun={(i) => { setCompletingRunIndex(i); setCompleteScore('') }}
          onCancelRun={handleCancelRun}
          onCloseSession={handleCloseSession}
        />
      )}

      {/* Complete run modal */}
      {completingRunIndex !== null && session && (
        <div
          onClick={() => setCompletingRunIndex(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
        >
          <div onClick={(e) => e.stopPropagation()} className="card" style={{ maxWidth: 400, width: '90%', margin: 0 }}>
            <div className="card-title" style={{ marginBottom: '0.5rem' }}>
              Complete Run {completingRunIndex + 1}
            </div>
            <p style={{ fontSize: 13, marginBottom: '1rem' }}>
              Players get +1 scoring turn. Score applied to {trialNames[session.trialNumber] || `Trial ${session.trialNumber}`}.
            </p>
            <div style={{ marginBottom: '1rem' }}>
              <span className="label">
                Score ({(session.runs[completingRunIndex]?.playerIds || []).map((id) => playersById[id]?.name || '?').join(', ') || 'Empty'})
              </span>
              <input
                type="number"
                min="0"
                autoFocus
                value={completeScore}
                onChange={(e) => setCompleteScore(e.target.value)}
                placeholder="Leave blank to skip"
                style={{ width: '100%', fontFamily: 'var(--font-mono)' }}
                onKeyDown={(e) => { if (e.key === 'Enter') handleCompleteRun() }}
              />
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button className="btn-success" onClick={handleCompleteRun} disabled={saving}>
                {saving ? 'Saving...' : 'Confirm Complete'}
              </button>
              <button onClick={() => setCompletingRunIndex(null)} disabled={saving}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Past sessions — always visible at the bottom */}
      {pastSessions.length > 0 && (
        <PastSessions
          sessions={pastSessions}
          playersById={playersById}
          trialNames={trialNames}
        />
      )}
    </div>
  )
}

// ── Active Session ───────────────────────────────────────────────────────────

function ActiveSession({ session, players, playersById, statsByPlayer, trialNames, onAddRun, onUpdateRunPlayers, onMoveRun, onDeleteRun, onCompleteRun, onCancelRun, onCloseSession }) {
  const [editingRunIndex, setEditingRunIndex] = useState(null)

  const trialName = trialNames[session.trialNumber] || `Trial ${session.trialNumber}`
  const activeRunIndex = session.runs.findIndex((w) => w.status === 'active')
  const completedCount = session.runs.filter((w) => w.status === 'complete').length
  const pendingCount = session.runs.filter((w) => w.status === 'pending').length

  const scoredInSession = new Set(
    session.runs
      .filter((w) => w.status === 'complete')
      .flatMap((w) => w.playerIds || [])
  )

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div>
          <h2 style={{ marginTop: 0, marginBottom: '0.25rem' }}>Session: {trialName}</h2>
          <p style={{ fontSize: 13, margin: 0 }}>
            {completedCount} run{completedCount !== 1 ? 's' : ''} complete · {pendingCount} upcoming
          </p>
        </div>
        <button className="btn-neutral" onClick={onCloseSession} style={{ fontSize: 12 }}>
          Close Session
        </button>
      </div>

      {/* Player pool overview */}
      <div style={{ marginBottom: '1.5rem', padding: '0.75rem', background: 'var(--surface)', border: '1px solid var(--border2)', borderRadius: 'var(--radius)' }}>
        <span className="label" style={{ marginBottom: '0.4rem' }}>Player Pool — Priority Order</span>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
          {players.map((p) => {
            const stats = statsByPlayer[p.id] || { contributionPoints: 0, scoreAchieved: 0 }
            const scored = scoredInSession.has(p.id)
            return (
              <div
                key={p.id}
                style={{
                  padding: '0.2rem 0.6rem', fontSize: 12, borderRadius: 16,
                  border: `1px solid ${scored ? 'var(--success)' : 'var(--border)'}`,
                  background: scored ? 'rgba(63,185,80,0.1)' : 'var(--surface2)',
                  color: scored ? 'var(--success)' : 'var(--text)',
                }}
                title={`${stats.contributionPoints}pt · ${stats.scoreAchieved}t`}
              >
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
          statsByPlayer={statsByPlayer}
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

// ── Run Card ────────────────────────────────────────────────────────────────

function RunCard({ run, runNumber, playersById, players, statsByPlayer, scoredInSession, isActive, isPending, isEditing, onEdit, onCancelEdit, onSavePlayers, onComplete, onCancel, onMoveUp, onMoveDown, onDelete }) {
  const [selectedIds, setSelectedIds] = useState(run.playerIds || [])

  useEffect(() => { setSelectedIds(run.playerIds || []) }, [run.playerIds])

  function togglePlayer(playerId) {
    setSelectedIds((prev) =>
      prev.includes(playerId)
        ? prev.filter((id) => id !== playerId)
        : prev.length < 3 ? [...prev, playerId] : prev
    )
  }

  const borderColor = {
    complete: 'var(--success)',
    cancelled: 'var(--muted)',
    active: 'var(--accent)',
    pending: 'var(--border2)',
  }[run.status]

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
            {badgeClass && <span className={`badge ${badgeClass}`} style={{ fontSize: 10 }}>{statusLabel}</span>}
            {!badgeClass && <span style={{ fontSize: 11, color: 'var(--muted)' }}>{statusLabel}</span>}
          </div>
          {!isEditing && (
            <div style={{ fontSize: 13 }}>
              {playerNames.length === 0
                ? <span style={{ color: 'var(--muted)' }}>No players assigned</span>
                : playerNames.join(', ')}
              {run.score != null && (
                <span style={{ marginLeft: '0.5rem', color: 'var(--accent)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                  · Score: {run.score}
                </span>
              )}
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
          <p style={{ fontSize: 12, marginBottom: '0.4rem' }}>
            Select up to 3 players. Sorted by priority. ✓ = already scored this session.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', marginBottom: '0.5rem' }}>
            {players.map((p) => {
              const stats = statsByPlayer[p.id] || { contributionPoints: 0, scoreAchieved: 0 }
              const selected = selectedIds.includes(p.id)
              const scored = scoredInSession.has(p.id) && !run.playerIds.includes(p.id)
              return (
                <button
                  key={p.id}
                  onClick={() => togglePlayer(p.id)}
                  disabled={!selected && selectedIds.length >= 3}
                  title={`${stats.contributionPoints}pt · ${stats.scoreAchieved}t`}
                  style={{
                    padding: '0.25rem 0.6rem', fontSize: 12, borderRadius: 16,
                    border: selected ? '2px solid var(--accent)' : '1px solid var(--border)',
                    background: selected ? 'rgba(57,208,216,0.12)' : 'var(--surface)',
                    color: scored ? 'var(--success)' : 'var(--text)', cursor: 'pointer',
                    opacity: !selected && selectedIds.length >= 3 ? 0.4 : 1,
                  }}
                >
                  {p.name}{scored ? ' ✓' : ''}
                </button>
              )
            })}
          </div>
          <div style={{ display: 'flex', gap: '0.4rem' }}>
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
            const completedRuns = (s.runs || []).filter((w) => w.status === 'complete')
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
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--muted)', minWidth: 55 }}>Run {i + 1}</span>
                          <span style={{ fontSize: 13, flex: 1 }}>{playerNames.join(', ') || '—'}</span>
                          {run.score != null && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--accent)' }}>{run.score}</span>}
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
