import React, { useEffect, useState } from 'react'
import { updateEvent, getTrialNames } from '../../data/schema.js'
import {
  getEventSchedule,
  getConditionsForMap,
  getTimeWindowsForMapCondition,
  KNOWN_MAPS,
} from '../../data/metaforge.js'
import { weekKeyForEventTime, getWeekKey } from '../../utils/weeks.js'

const TRIAL_NUMBERS = [1, 2, 3, 4, 5]

export default function EditEventModal({ event, onSaved, onCancel }) {
  const [title, setTitle] = useState(event.title || '')
  const [description, setDescription] = useState(event.description || '')
  const [selectedMap, setSelectedMap] = useState(event.map || '')
  const [selectedCondition, setSelectedCondition] = useState(event.condition || '')
  const [selectedTime, setSelectedTime] = useState(
    event.startTime ? { startTime: toDate(event.startTime), endTime: toDate(event.endTime) } : null
  )
  const [selectedTrialNum, setSelectedTrialNum] = useState(event.trialNumber ? String(event.trialNumber) : '')

  const [schedule, setSchedule] = useState([])
  const [scheduleLoading, setScheduleLoading] = useState(false)
  const [scheduleError, setScheduleError] = useState(null)
  const [availableConditions, setAvailableConditions] = useState([])
  const [availableWindows, setAvailableWindows] = useState([])

  const [trialNames, setTrialNames] = useState({})
  const [trialNamesLoading, setTrialNamesLoading] = useState(true)

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  // Track whether the map/condition/time selectors have been touched —
  // until they are, we keep showing the event's existing values even
  // though they may not appear in the freshly-loaded schedule (e.g. if
  // the time window has since passed or the cache rolled over).
  const [scheduleTouched, setScheduleTouched] = useState(false)

  function toDate(t) {
    if (!t) return null
    return t.toDate ? t.toDate() : new Date(t)
  }

  useEffect(() => {
    async function loadSchedule() {
      setScheduleLoading(true)
      setScheduleError(null)
      try {
        const data = await getEventSchedule()
        setSchedule(data)
        if (data.length === 0) setScheduleError('No schedule data. Use the cache panel in Maintenance to load schedule data.')
      } catch (e) {
        setScheduleError('Failed to load schedule: ' + e.message)
      }
      setScheduleLoading(false)
    }
    loadSchedule()
  }, [])

  // Load trial names for whichever week the event's current/selected time falls in
  useEffect(() => {
    async function loadTrialNames() {
      setTrialNamesLoading(true)
      const weekKey = selectedTime ? weekKeyForEventTime(selectedTime.startTime) : getWeekKey()
      const names = await getTrialNames(weekKey)
      setTrialNames(names)
      setTrialNamesLoading(false)
    }
    loadTrialNames()
  }, [selectedTime])

  useEffect(() => {
    if (!selectedMap) { setAvailableConditions([]); return }
    setAvailableConditions(getConditionsForMap(schedule, selectedMap))
  }, [selectedMap, schedule])

  useEffect(() => {
    if (!selectedMap || !selectedCondition) { setAvailableWindows([]); return }
    setAvailableWindows(getTimeWindowsForMapCondition(schedule, selectedMap, selectedCondition))
  }, [selectedMap, selectedCondition, schedule])

  function handleMapChange(map) {
    setScheduleTouched(true)
    setSelectedMap(map)
    setSelectedCondition('')
    setSelectedTime(null)
  }

  function handleConditionChange(condition) {
    setScheduleTouched(true)
    setSelectedCondition(condition)
    setSelectedTime(null)
  }

  function formatWindow(w) {
    const shortTZ = w.startTime.toLocaleTimeString(undefined, { timeZoneName: 'short' }).split(' ').pop()
    const start = w.startTime.toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
    const end = w.endTime ? w.endTime.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) : '?'
    return `${start} – ${end} ${shortTZ}`
  }

  async function handleSave() {
    setError(null)
    if (!title.trim()) { setError('Please enter an event title.'); return }
    if (!selectedMap) { setError('Please select a map.'); return }
    if (!selectedCondition) { setError('Please select a condition.'); return }
    if (!selectedTime) { setError('Please select a time window.'); return }
    if (!selectedTrialNum) { setError('Please select which trial this event is for.'); return }

    const weekKey = weekKeyForEventTime(selectedTime.startTime)
    setSaving(true)
    try {
      await updateEvent(event.id, {
        title: title.trim(),
        description: description.trim(),
        map: selectedMap,
        condition: selectedCondition,
        startTime: selectedTime.startTime,
        endTime: selectedTime.endTime,
        weekKey,
        trialNumber: Number(selectedTrialNum),
      })
      onSaved?.()
    } catch (e) {
      setError('Failed to save changes: ' + e.message)
    }
    setSaving(false)
  }

  // The current time window may not be present in availableWindows (e.g.
  // it has since passed, or the schedule cache shifted). If so, and the
  // selectors haven't been touched yet, show it as an extra option so the
  // dropdown doesn't silently blank out the existing value.
  const windowOptions = (() => {
    if (!selectedTime) return availableWindows
    const alreadyListed = availableWindows.some(
      (w) => w.startTime.getTime() === selectedTime.startTime.getTime()
    )
    if (alreadyListed || scheduleTouched) return availableWindows
    return [selectedTime, ...availableWindows]
  })()

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
          borderRadius: 'var(--radius)', width: '100%', maxWidth: 640,
          maxHeight: '85vh', display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="card-title" style={{ fontSize: 14 }}>Edit Event</div>
          <button onClick={onCancel} style={{ fontSize: 18, background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer' }}>✕</button>
        </div>

        {/* Body */}
        <div style={{ padding: '1.25rem', overflowY: 'auto' }}>
          <div style={{ display: 'grid', gap: '1rem', marginBottom: '1.5rem' }}>
            <div>
              <span className="label">Title *</span>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                style={{ width: '100%' }}
              />
            </div>
            <div>
              <span className="label">Description</span>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                style={{ width: '100%' }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1.5rem', alignItems: 'flex-end' }}>
            <div>
              <span className="label">Map *</span>
              <select value={selectedMap} onChange={(e) => handleMapChange(e.target.value)} style={{ minWidth: 150 }}>
                <option value="">— Select —</option>
                {KNOWN_MAPS.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <span className="label">Condition *</span>
              <select
                value={selectedCondition}
                onChange={(e) => handleConditionChange(e.target.value)}
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
                  setScheduleTouched(true)
                  const w = windowOptions.find((w) => w.startTime.toISOString() === e.target.value)
                  setSelectedTime(w || null)
                }}
                disabled={!selectedCondition || windowOptions.length === 0}
                style={{ minWidth: 240 }}
              >
                <option value="">
                  {!selectedCondition ? '— Pick condition first —' : windowOptions.length === 0 ? 'No upcoming windows' : '— Select —'}
                </option>
                {windowOptions.map((w) => (
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

          {scheduleError && <div className="alert alert-warning" style={{ marginBottom: '1rem' }}>{scheduleError}</div>}
          {error && <div className="alert alert-error" style={{ marginBottom: '1rem' }}>{error}</div>}
        </div>

        {/* Footer */}
        <div style={{ padding: '0.75rem 1.25rem', borderTop: '1px solid var(--border2)', display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
          <button onClick={onCancel} disabled={saving}>Cancel</button>
          <button className="btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  )
}
