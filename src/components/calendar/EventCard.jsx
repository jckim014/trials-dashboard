import React from 'react'

function formatLocalTime(timestamp) {
  if (!timestamp) return 'TBD'
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp)
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

export default function EventCard({ event, playersById, trialName }) {
  return (
    <div className="card">
      <div className="card-header">
        <div>
          <div className="card-title">{event.title}</div>
          <div className="card-meta">
            {event.map} · {event.condition} · {formatLocalTime(event.startTime)}
            {trialName && <> · <span style={{ color: 'var(--scoring)' }}>{trialName}</span></>}
          </div>
          {event.description && <p style={{ marginTop: '0.4rem', fontSize: 13 }}>{event.description}</p>}
        </div>
        <span className={'badge ' + event.status}>{STATUS_LABELS[event.status] || event.status}</span>
      </div>

      {(event.squads || []).length > 0 && (
        <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
          {event.squads.map((squad, i) => {
            const isScoring = squad.label === 'scoring'
            const supportNum = event.squads.slice(0, i).filter(s => s.label === 'support').length + 1
            return (
              <div key={i} style={{ fontSize: 13 }}>
                <span style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11,
                  color: isScoring ? 'var(--scoring)' : 'var(--muted)',
                  fontWeight: 600,
                  marginRight: '0.5rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}>
                  {isScoring ? 'Scoring' : `Support ${supportNum}`}
                </span>
                {squad.memberIds.length === 0
                  ? <span style={{ color: 'var(--muted)' }}>—</span>
                  : squad.memberIds.map((id) => playersById[id]?.name || '?').join(', ')}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
