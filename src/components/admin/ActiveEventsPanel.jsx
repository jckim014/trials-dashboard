import React, { useEffect, useState } from 'react'
import { getEvents, getPlayers, updateEvent, finalizeEvent, getTrialNames } from '../../data/schema.js'
import EventList from '../shared/EventList.jsx'
import CompleteEventModal from './CompleteEventModal.jsx'
import EditSquadsModal from './EditSquadsModal.jsx'

function formatLocalTime(ts) {
  if (!ts) return 'TBD'
  const date = ts.toDate ? ts.toDate() : new Date(ts)
  return date.toLocaleString(undefined, {
    weekday: 'short', month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
  })
}

const STATUS_LABELS = {
  active: 'Upcoming',
  success: 'Complete',
  failed: 'Incomplete',
  cancelled: 'Cancelled',
}

export default function ActiveEventsPanel() {
  const [events, setEvents] = useState([])
  const [players, setPlayers] = useState([])
  const [trialNamesByWeek, setTrialNamesByWeek] = useState({}) // { [weekKey]: { 1: 'Search cars', ... } }
  const [loading, setLoading] = useState(true)
  const [finalizing, setFinalizing] = useState(null)
  const [completingEvent, setCompletingEvent] = useState(null) // event pending the Complete modal

  async function load() {
    const [evts, plyrs] = await Promise.all([getEvents(), getPlayers()])
    setEvents(evts)
    setPlayers(plyrs)

    // Load trial names for every distinct week present among the events,
    // so each card can show the current custom trial name, not just "Trial N".
    const weekKeys = [...new Set(evts.map((e) => e.weekKey))]
    const namesEntries = await Promise.all(
      weekKeys.map(async (wk) => [wk, await getTrialNames(wk)])
    )
    setTrialNamesByWeek(Object.fromEntries(namesEntries))

    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function handleFinalize(event, status) {
    if (status === 'success') {
      setCompletingEvent(event)
      return
    }

    const confirmMsg = status === 'cancelled'
      ? 'Cancel this event? No points will be awarded.'
      : 'Mark as Incomplete? Support squads get +1 contribution. Scoring squad gets no score-achieved point.'
    if (!window.confirm(confirmMsg)) return
    setFinalizing(event.id)
    await finalizeEvent(event, status)
    await load()
    setFinalizing(null)
  }

  async function handleConfirmComplete(score) {
    if (!completingEvent) return
    setFinalizing(completingEvent.id)
    await finalizeEvent(completingEvent, 'success', score)
    await load()
    setFinalizing(null)
    setCompletingEvent(null)
  }

  if (loading) return <p>Loading events...</p>

  const playersById = Object.fromEntries(players.map((p) => [p.id, p]))

  const scoringMemberNames = completingEvent
    ? (completingEvent.squads || [])
        .find((s) => s.label === 'scoring')
        ?.memberIds.map((id) => playersById[id]?.name || '?') || []
    : []

  const completingTrialName = completingEvent
    ? completingEvent.trialNumber
      ? (trialNamesByWeek[completingEvent.weekKey]?.[completingEvent.trialNumber] || `Trial ${completingEvent.trialNumber}`)
      : 'Trial (not set)'
    : ''

  return (
    <>
      <EventList
        events={events}
        emptyMessage="No upcoming events. Create one in the Create Event tab."
        renderCard={(event) => (
          <EventAdminCard
            key={event.id}
            event={event}
            playersById={playersById}
            players={players}
            trialName={event.trialNumber ? (trialNamesByWeek[event.weekKey]?.[event.trialNumber] || `Trial ${event.trialNumber}`) : null}
            onFinalize={handleFinalize}
            finalizing={finalizing === event.id}
            onUpdate={load}
            readonly={event.status !== 'active'}
          />
        )}
      />

      {completingEvent && (
        <CompleteEventModal
          event={completingEvent}
          trialName={completingTrialName}
          scoringMemberNames={scoringMemberNames}
          onConfirm={handleConfirmComplete}
          onCancel={() => setCompletingEvent(null)}
          saving={finalizing === completingEvent.id}
        />
      )}
    </>
  )
}

function supportLabel(squads, squadIndex) {
  const supportNum = squads.slice(0, squadIndex).filter(s => s.label === 'support').length + 1
  return `Support ${supportNum}`
}

function EventAdminCard({ event, playersById, players, trialName, onFinalize, finalizing, onUpdate, readonly = false }) {
  const [editingSquads, setEditingSquads] = useState(false)
  const [saving, setSaving] = useState(false)

  async function saveSquads(squads) {
    setSaving(true)
    await updateEvent(event.id, { squads })
    setEditingSquads(false)
    setSaving(false)
    onUpdate()
  }

  return (
    <>
      <div className="card" style={{ marginBottom: '0.75rem' }}>
        <div className="card-header">
          <div>
            <div className="card-title">{event.title}</div>
            <div className="card-meta">
              {event.map} · {event.condition} · {formatLocalTime(event.startTime)}
              {trialName && <> · <span style={{ color: 'var(--scoring)' }}>{trialName}</span></>}
            </div>
            {event.description && <p style={{ marginTop: '0.35rem', fontSize: 13 }}>{event.description}</p>}
          </div>
          <span className={'badge ' + event.status}>{STATUS_LABELS[event.status] || event.status}</span>
        </div>

        {/* Squads read view */}
        <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
          {(event.squads || []).map((squad, i) => {
            const isScoring = squad.label === 'scoring'
            return (
              <div key={i} style={{ fontSize: 13 }}>
                <span style={{
                  fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600,
                  color: isScoring ? 'var(--scoring)' : 'var(--muted)',
                  textTransform: 'uppercase', letterSpacing: '0.04em', marginRight: '0.5rem',
                }}>
                  {isScoring ? 'Scoring' : supportLabel(event.squads, i)}
                </span>
                {squad.memberIds.length === 0
                  ? <span style={{ color: 'var(--muted)' }}>—</span>
                  : squad.memberIds.map((id) => playersById[id]?.name || '?').join(', ')}
              </div>
            )
          })}
          {!readonly && (
            <button
              onClick={() => setEditingSquads(true)}
              style={{ marginTop: '0.5rem', fontSize: 12, alignSelf: 'flex-start' }}
            >
              Edit Squads
            </button>
          )}
        </div>

        {/* Finalize controls */}
        {!readonly && (
          <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border2)' }}>
            <button className="btn-success" onClick={() => onFinalize(event, 'success')} disabled={finalizing}>Complete</button>
            <button className="btn-danger" onClick={() => onFinalize(event, 'failed')} disabled={finalizing}>Incomplete</button>
            <button className="btn-neutral" onClick={() => onFinalize(event, 'cancelled')} disabled={finalizing}>Cancel Event</button>
          </div>
        )}
      </div>

      {/* Squad edit modal */}
      {editingSquads && (
        <EditSquadsModal
          event={event}
          players={players}
          playersById={playersById}
          onSave={saveSquads}
          onCancel={() => setEditingSquads(false)}
          saving={saving}
        />
      )}
    </>
  )
}
