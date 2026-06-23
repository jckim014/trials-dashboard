import React, { useEffect, useState } from 'react'
import { getPlayers, getWeeklyStats, getTrialScoresForWeek, getTrialNames } from '../../data/schema.js'
import { getWeekKey, formatWeekLabel } from '../../utils/weeks.js'
import StandingsTable from '../shared/StandingsTable.jsx'
import WeekPicker from '../shared/WeekPicker.jsx'

const TRIAL_NUMBERS = [1, 2, 3, 4, 5]

export default function StatsPage() {
  const [players, setPlayers] = useState([])
  const [weeklyStats, setWeeklyStats] = useState([])
  const [trialScores, setTrialScores] = useState([])
  const [trialNames, setTrialNames] = useState({})
  const [weekKey, setWeekKey] = useState(getWeekKey())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const [plyrs, stats, scores, names] = await Promise.all([
        getPlayers(),
        getWeeklyStats(weekKey),
        getTrialScoresForWeek(weekKey),
        getTrialNames(weekKey),
      ])
      setPlayers(plyrs)
      setWeeklyStats(stats)
      setTrialScores(scores)
      setTrialNames(names)
      setLoading(false)
    }
    load()
  }, [weekKey])

  if (loading) return <p>Loading stats...</p>

  const statsByPlayer = Object.fromEntries(weeklyStats.map((s) => [s.playerId, s]))
  const scoresByPlayer = {}
  for (const s of trialScores) {
    if (!scoresByPlayer[s.playerId]) scoresByPlayer[s.playerId] = {}
    scoresByPlayer[s.playerId][s.trialNumber] = s.score
  }

  const sortedPlayers = [...players].sort((a, b) => {
    const aStats = statsByPlayer[a.id] || {}
    const bStats = statsByPlayer[b.id] || {}
    return (bStats.contributionPoints || 0) - (aStats.contributionPoints || 0)
  })

  return (
    <div>
      <h1>Stats</h1>

      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
        <WeekPicker value={weekKey} onChange={setWeekKey} />
        <span style={{ color: 'var(--muted)', fontSize: 13, marginTop: '1.1rem' }}>{formatWeekLabel(weekKey)}</span>
      </div>

      <h2>Trial Scores</h2>
      <table>
        <thead>
          <tr>
            <th>Player</th>
            {TRIAL_NUMBERS.map((n) => <th key={n}>{trialNames[n] || `Trial ${n}`}</th>)}
          </tr>
        </thead>
        <tbody>
          {sortedPlayers.map((p) => (
            <tr key={p.id}>
              <td style={{ fontWeight: 500 }}>{p.name}</td>
              {TRIAL_NUMBERS.map((n) => (
                <td key={n} style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}>
                  {scoresByPlayer[p.id]?.[n] ?? <span style={{ color: 'var(--muted)' }}>—</span>}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      <h2>Standings</h2>
      <StandingsTable
        players={players}
        statsByPlayer={statsByPlayer}
        sortByContribution
        showRank
      />
    </div>
  )
}
