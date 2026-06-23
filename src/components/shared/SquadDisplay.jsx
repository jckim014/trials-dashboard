import React from 'react'

export default function SquadDisplay({ squads, playersById }) {
  if (!squads || squads.length === 0) return null

  return (
    <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      {squads.map((squad, i) => {
        const isScoring = squad.label === 'scoring'
        const supportNum = squads.slice(0, i).filter(s => s.label === 'support').length + 1

        return (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <span style={{
              fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 600,
              color: isScoring ? 'var(--accent)' : 'var(--muted)',
              textTransform: 'uppercase', letterSpacing: '0.05em',
              minWidth: 56, flexShrink: 0,
            }}>
              {isScoring ? 'Scoring' : `Support ${supportNum}`}
            </span>

            {squad.memberIds.length === 0
              ? <span style={{ fontSize: 12, color: 'var(--muted)' }}>—</span>
              : squad.memberIds.map((id) => {
                  const name = playersById[id]?.name || '?'
                  return (
                    <span
                      key={id}
                      style={{
                        display: 'inline-block',
                        fontSize: 12,
                        fontWeight: 500,
                        padding: '0.2rem 0.65rem',
                        borderRadius: 20,
                        background: isScoring
                          ? 'rgba(57,208,216,0.12)'
                          : 'rgba(139,148,158,0.12)',
                        border: `1px solid ${isScoring ? 'rgba(57,208,216,0.35)' : 'rgba(139,148,158,0.3)'}`,
                        color: 'var(--text)',
                      }}
                    >
                      {name}
                    </span>
                  )
                })
            }
          </div>
        )
      })}
    </div>
  )
}
