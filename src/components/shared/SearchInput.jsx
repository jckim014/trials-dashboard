import React from 'react'

/**
 * Text search input with a clear (×) button that appears once there's
 * text, and Escape-to-clear support. Used anywhere we filter a list by
 * typed text (Roster, Trial Scores) so the behavior stays consistent.
 */
export default function SearchInput({ value, onChange, placeholder = 'Search...', width = 200 }) {
  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Escape') onChange('') }}
        style={{ width, paddingRight: value ? '1.8rem' : undefined }}
      />
      {value && (
        <button
          onClick={() => onChange('')}
          title="Clear search"
          style={{
            position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)',
            background: 'none', border: 'none', padding: '0.15rem 0.4rem',
            color: 'var(--muted)', fontSize: 14, lineHeight: 1, cursor: 'pointer',
          }}
        >
          ×
        </button>
      )}
    </div>
  )
}
