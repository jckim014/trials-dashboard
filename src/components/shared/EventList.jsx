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
 *   events: array of event objects (must have .status, .weekKey, .endedAt).
 *           Upcoming events are rendered in the order given — sort before
 *           passing in (e.g. by .order for admin, by .startTime for public).
 *   renderCard: (event, dragProps) => ReactNode — renders a single event's
 *               card. Admin passes a card with edit/finalize controls;
 *               public passes a read-only card. This component doesn't
 *               know or care which. dragProps is { dragHandleProps? } —
 *               when reorderable, dragHandleProps is an object to spread
 *               onto whatever element should act as the drag handle
 *               (e.g. a small grip icon in the card header). When not
 *               reorderable, dragProps is an empty object.
 *   emptyMessage: string shown when there are no upcoming events
 *   reorderable: boolean — enables drag-and-drop reordering of upcoming
 *                events. Only meaningful for the admin view.
 *   onReorder: (orderedEventIds: string[]) => void — called after a drop
 *              with the new full order of upcoming event IDs. Required
 *              when reorderable is true.
 */
/**
 * Visual gap that opens up between event cards to show exactly where a
 * dragged event will land. It's also an active drop target in its own
 * right, so dropping directly on the gap (not just the row above/below
 * it) works too.
 */
function GapPlaceholder({ onDragOver, onDrop }) {
  return (
    <div
      onDragOver={onDragOver}
      onDrop={onDrop}
      style={{
        height: 64,
        margin: '0.4rem 0',
        border: '2px dashed var(--accent)',
        borderRadius: 'var(--radius-sm)',
        background: 'rgba(57,208,216,0.06)',
        transition: 'opacity 0.1s',
      }}
    />
  )
}

export default function EventList({
  events,
  renderCard,
  emptyMessage = 'No upcoming events.',
  reorderable = false,
  onReorder,
}) {
  const [showPast, setShowPast] = useState(false)
  const [dragIndex, setDragIndex] = useState(null)
  // gapIndex represents the boundary the placeholder sits at: 0 = before
  // the first card, 1 = between card 0 and 1, ..., N = after the last card.
  const [gapIndex, setGapIndex] = useState(null)
  const scrollRafRef = React.useRef(null)
  const scrollSpeedRef = React.useRef(0)

  const EDGE_ZONE = 80 // px from viewport edge that triggers auto-scroll
  const MAX_SCROLL_SPEED = 18 // px per frame at the very edge

  function stopAutoScroll() {
    if (scrollRafRef.current) {
      cancelAnimationFrame(scrollRafRef.current)
      scrollRafRef.current = null
    }
    scrollSpeedRef.current = 0
  }

  function autoScrollLoop() {
    if (scrollSpeedRef.current !== 0) {
      window.scrollBy(0, scrollSpeedRef.current)
      scrollRafRef.current = requestAnimationFrame(autoScrollLoop)
    } else {
      scrollRafRef.current = null
    }
  }

  function updateAutoScroll(clientY) {
    const viewportHeight = window.innerHeight
    let speed = 0

    if (clientY < EDGE_ZONE) {
      const intensity = (EDGE_ZONE - clientY) / EDGE_ZONE
      speed = -MAX_SCROLL_SPEED * intensity
    } else if (clientY > viewportHeight - EDGE_ZONE) {
      const intensity = (clientY - (viewportHeight - EDGE_ZONE)) / EDGE_ZONE
      speed = MAX_SCROLL_SPEED * intensity
    }

    scrollSpeedRef.current = speed
    if (speed !== 0 && !scrollRafRef.current) {
      scrollRafRef.current = requestAnimationFrame(autoScrollLoop)
    }
  }

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

  React.useEffect(() => {
    if (dragIndex === null) return
    function handleDocumentDragOver(e) {
      updateAutoScroll(e.clientY)
    }
    document.addEventListener('dragover', handleDocumentDragOver)
    return () => {
      document.removeEventListener('dragover', handleDocumentDragOver)
      stopAutoScroll()
    }
  }, [dragIndex])

  function handleDragStart(e, index) {
    setDragIndex(index)
    e.dataTransfer.effectAllowed = 'move'
    // Required for Firefox to initiate drag
    e.dataTransfer.setData('text/plain', String(index))
  }

  function handleDragEnd() {
    setDragIndex(null)
    setGapIndex(null)
    stopAutoScroll()
  }

  function handleRowDragOver(e, index) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    updateAutoScroll(e.clientY)

    // Decide whether the gap belongs above or below this row based on
    // where the cursor sits relative to the row's vertical midpoint.
    const rect = e.currentTarget.getBoundingClientRect()
    const midpoint = rect.top + rect.height / 2
    const newGap = e.clientY < midpoint ? index : index + 1
    if (newGap !== gapIndex) setGapIndex(newGap)
  }

  function handleListDrop(e) {
    e.preventDefault()
    stopAutoScroll()
    if (dragIndex === null || gapIndex === null) {
      setDragIndex(null); setGapIndex(null)
      return
    }
    // A gap immediately before or after the dragged item's current spot
    // is a no-op (item would land back where it started).
    if (gapIndex === dragIndex || gapIndex === dragIndex + 1) {
      setDragIndex(null); setGapIndex(null)
      return
    }

    const reordered = [...upcomingEvents]
    const [moved] = reordered.splice(dragIndex, 1)
    // If the gap was after the dragged item's original position, removing
    // the item shifts everything after it back by one, so adjust.
    const insertAt = gapIndex > dragIndex ? gapIndex - 1 : gapIndex
    reordered.splice(insertAt, 0, moved)

    setDragIndex(null)
    setGapIndex(null)
    onReorder?.(reordered.map((e) => e.id))
  }

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>Upcoming Events</h2>
      {upcomingEvents.length === 0 && (
        <div className="empty-state"><p>{emptyMessage}</p></div>
      )}
      {upcomingEvents.map((event, index) => {
        if (!reorderable) return <React.Fragment key={event.id}>{renderCard(event, {})}</React.Fragment>

        const isDragging = dragIndex === index
        const showGapBefore = dragIndex !== null && gapIndex === index
        const showGapAfter =
          dragIndex !== null && gapIndex === index + 1 && index === upcomingEvents.length - 1

        return (
          <React.Fragment key={event.id}>
            {showGapBefore && (
              <GapPlaceholder
                onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; updateAutoScroll(e.clientY); setGapIndex(index) }}
                onDrop={handleListDrop}
              />
            )}
            <div
              onDragOver={(e) => handleRowDragOver(e, index)}
              onDrop={handleListDrop}
              style={{ opacity: isDragging ? 0.4 : 1, transition: 'opacity 0.12s' }}
            >
              {renderCard(event, {
                dragHandleProps: {
                  draggable: true,
                  onDragStart: (e) => handleDragStart(e, index),
                  onDragEnd: handleDragEnd,
                },
              })}
            </div>
            {showGapAfter && (
              <GapPlaceholder
                onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; updateAutoScroll(e.clientY); setGapIndex(index + 1) }}
                onDrop={handleListDrop}
              />
            )}
          </React.Fragment>
        )
      })}

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
                  {pastByWeek[weekKey].map((event) => (
                    <React.Fragment key={event.id}>{renderCard(event, {})}</React.Fragment>
                  ))}
                </section>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
