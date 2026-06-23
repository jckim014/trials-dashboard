import React, { useEffect, useState } from 'react'
import { getEvents, getPlayers, getTrialNames } from '../../data/schema.js'
import EventList from '../shared/EventList.jsx'
import EventCard from './EventCard.jsx'

export default function CalendarPage() {
  const [events, setEvents] = useState([])
  const [players, setPlayers] = useState([])
  const [trialNamesByWeek, setTrialNamesByWeek] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [evts, plyrs] = await Promise.all([getEvents(), getPlayers()])
      setEvents(evts)
      setPlayers(plyrs)

      const weekKeys = [...new Set(evts.map((e) => e.weekKey))]
      const namesEntries = await Promise.all(
        weekKeys.map(async (wk) => [wk, await getTrialNames(wk)])
      )
      setTrialNamesByWeek(Object.fromEntries(namesEntries))

      setLoading(false)
    }
    load()
  }, [])

  if (loading) return <p>Loading events...</p>

  const playersById = Object.fromEntries(players.map((p) => [p.id, p]))

  return (
    <div>
      <h1>Trials Calendar</h1>
      <EventList
        events={events}
        emptyMessage="No upcoming events scheduled."
        renderCard={(event) => (
          <EventCard
            key={event.id}
            event={event}
            playersById={playersById}
            trialName={event.trialNumber ? (trialNamesByWeek[event.weekKey]?.[event.trialNumber] || `Trial ${event.trialNumber}`) : null}
          />
        )}
      />
    </div>
  )
}
