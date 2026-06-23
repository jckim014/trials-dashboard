import React from 'react'

/**
 * Shared standings table: player name, contribution points, scoring turns.
 * Used by both the public Stats page (read-only) and the admin Roster
 * (which adds extra columns via renderExtraColumns/extraHeaders).
 *
 * Props:
 *   players: array of player objects ({ id, name, ... })
 *   statsByPlayer: { [playerId]: { contributionPoints, scoreAchieved } }
 *   sortByContribution: if true, sorts players by contribution points desc
 *   showRank: if true, shows a # column (used on public Stats for standings)
 *   extraHeaders: ReactNode — extra <th> cells appended after Scoring Turns
 *   renderExtraCells: (player, stats) => ReactNode — extra <td> cells per row
 */
export default function StandingsTable({
  players,
  statsByPlayer,
  sortByContribution = false,
  showRank = false,
  extraHeaders = null,
  renderExtraCells = null,
}) {
  const displayedPlayers = sortByContribution
    ? [...players].sort((a, b) => {
        const aStats = statsByPlayer[a.id] || {}
        const bStats = statsByPlayer[b.id] || {}
        return (bStats.contributionPoints || 0) - (aStats.contributionPoints || 0)
      })
    : players

  if (displayedPlayers.length === 0) {
    return <div className="empty-state"><p>No players yet.</p></div>
  }

  return (
    <table>
      <thead>
        <tr>
          {showRank && <th>#</th>}
          <th>Player</th>
          <th>Contribution</th>
          <th>Scoring Turns</th>
          {extraHeaders}
        </tr>
      </thead>
      <tbody>
        {displayedPlayers.map((p, i) => {
          const stats = statsByPlayer[p.id] || { contributionPoints: 0, scoreAchieved: 0 }
          return (
            <tr key={p.id}>
              {showRank && (
                <td style={{ color: 'var(--muted)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>{i + 1}</td>
              )}
              <td style={{ fontWeight: 500 }}>{p.name}</td>
              <td><span className="stat-num">{stats.contributionPoints}</span></td>
              <td><span className="stat-num" style={{ color: 'var(--scoring)' }}>{stats.scoreAchieved}</span></td>
              {renderExtraCells && renderExtraCells(p, stats)}
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
