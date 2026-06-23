import React, { useState } from 'react'
import { formatWeekLabel } from '../../utils/weeks.js'

/**
 * Shared list layout for events: upcoming events shown flat at the top,
 * past events grouped by week and collapsed behind a toggle.
 *
 * Used by both the public Calendar page and the admin Events tab — keeping
 * this logic in one place means the two views can't drift out of sync.
 *
 * Props:
 *   events: array of event objects (must have .status, .weekKey, .endedAt)
 *   renderCard: (event) => ReactNode — renders a single event's card.
 *               Admin passes a card with edit/finalize controls; public
 *               passes a read-only card. This component doesn't know or
 *               care which.
 *   emptyMessage: string shown when there are no upcoming events
 */
export default function EventList({ events, renderCard, emptyMessage = 'No upcoming events.' }) {
  const [showPast, setShowPast] = useState(false)

  const upcomingEvents = events.filter((e) => e.status === 'active')
  const pastEvents = events.filter((e) => e.status !== 'active').sort((a, b) => {
    const aTime = a.endedAt?.toMillis?.() || 0
    const bTime = b.endedAt?.toMillis?.() || 0
    return bTime - aTime
  })

  // Group past events by week for readability when expanded
  const pastByWeek = {}
  for (const event of pastEvents) {
    if (!pastByWeek[event.weekKey]) pastByWeek[event.weekKey] = []
    pastByWeek[event.weekKey].push(event)
  }
  const sortedPastWeeks = Object.keys(pastByWeek).sort().reverse()

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>Upcoming Events</h2>
      {upcomingEvents.length === 0 && (
        <div className="empty-state"><p>{emptyMessage}</p></div>
      )}
      {upcomingEvents.map((event) => renderCard(event))}

      {pastEvents.length > 0 && (
        <div style={{ marginTop: '2rem' }}>
          <button
            onClick={() => setShowPast((v) => !v)}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.4rem',
              background: 'none', border: 'none', padding: 0,
              color: 'var(--muted)', fontSize: 13, fontWeight: 600,
              fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.04em',
              cursor: 'pointer',
            }}
          >
            <span style={{ display: 'inline-block', transition: 'transform 0.15s', transform: showPast ? 'rotate(90deg)' : 'rotate(0deg)' }}>
              ▸
            </span>
            Past Events ({pastEvents.length})
          </button>

          {showPast && (
            <div style={{ marginTop: '0.75rem' }}>
              {sortedPastWeeks.map((weekKey) => (
                <section key={weekKey} style={{ marginBottom: '1.5rem' }}>
                  <h2>{formatWeekLabel(weekKey)}</h2>
                  {pastByWeek[weekKey].map((event) => renderCard(event))}
                </section>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
