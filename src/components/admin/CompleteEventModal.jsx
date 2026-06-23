import React, { useState } from 'react'

/**
 * Modal shown when completing an event. Lets the admin optionally enter
 * a score that gets applied to every member of the scoring squad for
 * the event's assigned trial slot.
 */
export default function CompleteEventModal({ event, trialName, scoringMemberNames, onConfirm, onCancel, saving }) {
  const [score, setScore] = useState('')

  function handleConfirm() {
    const trimmed = score.trim()
    const parsed = trimmed === '' ? null : Number(trimmed)
    if (trimmed !== '' && (isNaN(parsed) || parsed < 0)) return
    onConfirm(parsed)
  }

  return (
    <div
      onClick={onCancel}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="card"
        style={{ maxWidth: 420, width: '90%', margin: 0 }}
      >
        <div className="card-title" style={{ marginBottom: '0.5rem' }}>Complete "{event.title}"</div>
        <p style={{ fontSize: 13, marginBottom: '1rem' }}>
          Support squads get +1 contribution. Scoring squad gets +1 score achieved.
        </p>

        <div style={{ marginBottom: '1rem' }}>
          <span className="label">
            Score for {trialName} {scoringMemberNames.length > 0 && `(${scoringMemberNames.join(', ')})`}
          </span>
          <input
            type="number"
            min="0"
            autoFocus
            value={score}
            onChange={(e) => setScore(e.target.value)}
            placeholder="Leave blank to skip"
            style={{ width: '100%', fontFamily: 'var(--font-mono)' }}
          />
          {scoringMemberNames.length === 0 && (
            <p style={{ fontSize: 12, marginTop: '0.3rem', color: 'var(--warning)' }}>
              No one is assigned to the scoring squad — score won't be applied to anyone.
            </p>
          )}
        </div>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn-success" onClick={handleConfirm} disabled={saving}>
            {saving ? 'Saving...' : 'Confirm Complete'}
          </button>
          <button onClick={onCancel} disabled={saving}>Cancel</button>
        </div>
      </div>
    </div>
  )
}
