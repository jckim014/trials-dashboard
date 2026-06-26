import React, { useState } from 'react'
import RosterPanel from './RosterPanel.jsx'
import EventCreationPanel from './EventCreationPanel.jsx'
import ActiveEventsPanel from './ActiveEventsPanel.jsx'
import TrialScoresPanel from './TrialScoresPanel.jsx'
import MaintenancePanel from './MaintenancePanel.jsx'
import SessionPanel from './SessionPanel.jsx'

const TABS = [
  { id: 'active', label: 'Upcoming Events' },
  { id: 'create', label: 'Create Event' },
  { id: 'scores', label: 'Trial Scores' },
  { id: 'roster', label: 'Roster' },
  { id: 'maintenance', label: 'Maintenance' },
]

export default function AdminPage() {
  const [tab, setTab] = useState('active')
  const [scoreSearch, setScoreSearch] = useState('')

  function viewPlayerScores(playerName) {
    setScoreSearch(playerName)
    setTab('scores')
  }

  return (
    <div>
      <h1>Admin Panel</h1>
      <div className="tab-bar">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={'tab-btn' + (tab === t.id ? ' active' : '')}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'session'     && <SessionPanel />}
      {tab === 'active'      && <ActiveEventsPanel />}
      {tab === 'create'      && <EventCreationPanel onEventCreated={() => setTab('active')} />}
      {tab === 'scores'      && <TrialScoresPanel initialSearch={scoreSearch} />}
      {tab === 'roster'      && <RosterPanel onViewScores={viewPlayerScores} />}
      {tab === 'maintenance' && <MaintenancePanel />}
    </div>
  )
}
