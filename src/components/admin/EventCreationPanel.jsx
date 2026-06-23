import React, { useEffect, useState } from 'react'
import { createEvent, getTrialNames } from '../../data/schema.js'
import {
  getEventSchedule,
  getConditionsForMap,
  getTimeWindowsForMapCondition,
  KNOWN_MAPS,
} from '../../data/metaforge.js'
import { weekKeyForEventTime, getWeekKey } from '../../utils/weeks.js'

const TRIAL_NUMBERS = [1, 2, 3, 4, 5]

export default function EventCreationPanel({ onEventCreated }) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [selectedMap, setSelectedMap] = useState('')
  const [selectedCondition, setSelectedCondition] = useState('')
  const [selectedTime, setSelectedTime] = useState(null)
  const [selectedTrialNum, setSelectedTrialNum] = useState('')

  const [schedule, setSchedule] = useState([])
  const [scheduleLoading, setScheduleLoading] = useState(false)
  const [scheduleError, setScheduleError] = useState(null)
  const [availableConditions, setAvailableConditions] = useState([])
  const [availableWindows, setAvailableWindows] = useState([])

  const [trialNames, setTrialNames] = useState({})
  const [trialNamesLoading, setTrialNamesLoading] = useState(true)

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function loadSchedule() {
      setScheduleLoading(true)
      setScheduleError(null)
      try {
        const data = await getEventSchedule()
        setSchedule(data)
        if (data.length === 0) setScheduleError('No schedule data. Use the cache panel below to load schedule data.')
      } catch (e) {
        setScheduleError('Failed to load schedule: ' + e.message)
      }
      setScheduleLoading(false)
    }
    loadSchedule()
  }, [])

  // Events are always created for the current week, so we can load this
  // week's custom trial names immediately rather than waiting on a time
  // window selection.
  useEffect(() => {
    async function loadTrialNames() {
      setTrialNamesLoading(true)
      const names = await getTrialNames(getWeekKey())
      setTrialNames(names)
      setTrialNamesLoading(false)
    }
    loadTrialNames()
  }, [])

  useEffect(() => {
    if (!selectedMap) { setAvailableConditions([]); setSelectedCondition(''); return }
    setAvailableConditions(getConditionsForMap(schedule, selectedMap))
    setSelectedCondition('')
    setSelectedTime(null)
  }, [selectedMap, schedule])

  useEffect(() => {
    if (!selectedMap || !selectedCondition) { setAvailableWindows([]); setSelectedTime(null); return }
    setAvailableWindows(getTimeWindowsForMapCondition(schedule, selectedMap, selectedCondition))
    setSelectedTime(null)
  }, [selectedMap, selectedCondition, schedule])

  function formatWindow(w) {
    const shortTZ = w.startTime.toLocaleTimeString(undefined, { timeZoneName: 'short' }).split(' ').pop()
    const start = w.startTime.toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
    const end = w.endTime ? w.endTime.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) : '?'
    return `${start} – ${end} ${shortTZ}`
  }

  async function handleCreate() {
    setError(null)
    if (!title.trim()) { setError('Please enter an event title.'); return }
    if (!selectedMap) { setError('Please select a map.'); return }
    if (!selectedCondition) { setError('Please select a condition.'); return }
    if (!selectedTime) { setError('Please select a time window.'); return }
    if (!selectedTrialNum) { setError('Please select which trial this event is for.'); return }

    const weekKey = weekKeyForEventTime(selectedTime.startTime)
    setSaving(true)
    try {
      await createEvent({
        title: title.trim(),
        description: description.trim(),
        map: selectedMap,
        condition: selectedCondition,
        startTime: selectedTime.startTime,
        endTime: selectedTime.endTime,
        weekKey,
        trialNumber: Number(selectedTrialNum),
        squads: [
          { label: 'scoring', memberIds: [] },
          { label: 'support', memberIds: [] },
        ],
      })
      setTitle('')
      setDescription('')
      setSelectedMap('')
      setSelectedCondition('')
      setSelectedTime(null)
      setSelectedTrialNum('')
      onEventCreated?.()
    } catch (e) {
      setError('Failed to create event: ' + e.message)
    }
    setSaving(false)
  }

  return (
    <div>
      <div style={{ display: 'grid', gap: '1rem', maxWidth: 560, marginBottom: '1.5rem' }}>
        <div>
          <span className="label">Title *</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Tuesday Night Raid Run"
            style={{ width: '100%' }}
          />
        </div>
        <div>
          <span className="label">Description</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional notes for the group..."
            rows={2}
            style={{ width: '100%' }}
          />
        </div>
      </div>

      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1.5rem', alignItems: 'flex-end' }}>
        <div>
          <span className="label">Map *</span>
          <select value={selectedMap} onChange={(e) => setSelectedMap(e.target.value)} style={{ minWidth: 150 }}>
            <option value="">— Select —</option>
            {KNOWN_MAPS.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        <div>
          <span className="label">Condition *</span>
          <select
            value={selectedCondition}
            onChange={(e) => setSelectedCondition(e.target.value)}
            disabled={!selectedMap || scheduleLoading}
            style={{ minWidth: 180 }}
          >
            <option value="">
              {scheduleLoading ? 'Loading...' : !selectedMap ? '— Pick map first —' : availableConditions.length === 0 ? 'None available' : '— Select —'}
            </option>
            {availableConditions.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <span className="label">Time Window *</span>
          <select
            value={selectedTime ? selectedTime.startTime.toISOString() : ''}
            onChange={(e) => {
              const w = availableWindows.find((w) => w.startTime.toISOString() === e.target.value)
              setSelectedTime(w || null)
            }}
            disabled={!selectedCondition || availableWindows.length === 0}
            style={{ minWidth: 240 }}
          >
            <option value="">
              {!selectedCondition ? '— Pick condition first —' : availableWindows.length === 0 ? 'No upcoming windows' : '— Select —'}
            </option>
            {availableWindows.map((w) => (
              <option key={w.startTime.toISOString()} value={w.startTime.toISOString()}>
                {formatWindow(w)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <span className="label">Trial *</span>
          <select
            value={selectedTrialNum}
            onChange={(e) => setSelectedTrialNum(e.target.value)}
            disabled={trialNamesLoading}
            style={{ minWidth: 160 }}
          >
            <option value="">{trialNamesLoading ? 'Loading...' : '— Select —'}</option>
            {TRIAL_NUMBERS.map((n) => (
              <option key={n} value={n}>{trialNames[n] || `Trial ${n}`}</option>
            ))}
          </select>
        </div>
      </div>

      <p style={{ marginBottom: '1rem', fontSize: 12 }}>
        Which weekly trial this event counts toward. Used when completing the event to apply a score to the scoring squad.
      </p>

      {scheduleError && <div className="alert alert-warning" style={{ marginBottom: '1rem' }}>{scheduleError}</div>}
      {error && <div className="alert alert-error" style={{ marginBottom: '1rem' }}>{error}</div>}

      <button className="btn-primary" onClick={handleCreate} disabled={saving} style={{ padding: '0.5rem 1.5rem' }}>
        {saving ? 'Creating...' : 'Create Event'}
      </button>
    </div>
  )
}
