/**
 * Given the player roster and this week's stats, return players sorted
 * by suggested priority for the NEXT scoring squad slot.
 *
 * Primary sort: lowest scoreAchieved this week first (ensures rotation —
 *   everyone gets a turn before anyone gets a second).
 * Tiebreaker: highest contributionPoints first (rewards those who've
 *   been supporting more).
 *
 * This is a SUGGESTION ONLY — the admin makes the final call.
 */
export function suggestScoringCandidates(players, weeklyStats) {
  const statsByPlayer = Object.fromEntries(
    weeklyStats.map((s) => [s.playerId, s])
  )

  return [...players]
    .map((player) => {
      const stats = statsByPlayer[player.id] || {
        contributionPoints: 0,
        scoreAchieved: 0,
      }
      return { ...player, ...stats, id: player.id }
    })
    .sort((a, b) => {
      const turnsA = a.scoreAchieved || 0
      const turnsB = b.scoreAchieved || 0
      if (turnsA !== turnsB) return turnsA - turnsB // fewer turns = higher priority

      const contribA = a.contributionPoints || 0
      const contribB = b.contributionPoints || 0
      return contribB - contribA // more contribution = higher priority
    })
}
