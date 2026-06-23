import React, { useRef } from 'react'

/**
 * A date input wrapped so clicking anywhere in the box (not just the
 * small calendar icon) opens the native date picker. Falls back
 * gracefully in browsers that don't support showPicker() — the input is
 * still focusable/clickable as normal in that case.
 */
export default function WeekPicker({ value, onChange, label = 'Week' }) {
  const inputRef = useRef(null)

  function openPicker() {
    if (inputRef.current?.showPicker) {
      try {
        inputRef.current.showPicker()
      } catch {
        inputRef.current.focus()
      }
    } else {
      inputRef.current?.focus()
    }
  }

  return (
    <div>
      {label && <span className="label">{label}</span>}
      <div
        onClick={openPicker}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-sm)',
          background: 'var(--surface2)',
          cursor: 'pointer',
          padding: '0.1rem 0.3rem',
        }}
      >
        <input
          ref={inputRef}
          type="date"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={{
            border: 'none',
            background: 'transparent',
            cursor: 'pointer',
            padding: '0.3rem 0.3rem',
          }}
        />
      </div>
    </div>
  )
}
