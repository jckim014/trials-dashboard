import React, { useState, useRef, useEffect } from 'react'

// 5 primary + 5 backup. No teal (--accent) or amber (--scoring) — those
// are reserved for squad-type indicators. Color index is assigned once
// on first save and stored in Firestore, so roles keep their color forever.
export const ROLE_COLORS = [
  // Primary (0–4)
  { bg: 'rgba(220,80,100,0.15)',  border: 'rgba(220,80,100,0.5)',  text: '#e06070' }, // rose
  { bg: 'rgba(140,100,220,0.15)', border: 'rgba(140,100,220,0.5)', text: '#a882e0' }, // violet
  { bg: 'rgba(80,180,120,0.15)',  border: 'rgba(80,180,120,0.5)',  text: '#60c890' }, // sage
  { bg: 'rgba(210,120,50,0.15)',  border: 'rgba(210,120,50,0.5)',  text: '#d4844a' }, // orange
  { bg: 'rgba(80,160,210,0.15)',  border: 'rgba(80,160,210,0.5)',  text: '#58aad8' }, // sky
  // Backup (5–9)
  { bg: 'rgba(190,80,190,0.15)',  border: 'rgba(190,80,190,0.5)',  text: '#cc66cc' }, // magenta
  { bg: 'rgba(160,180,60,0.15)',  border: 'rgba(160,180,60,0.5)',  text: '#b0c840' }, // lime
  { bg: 'rgba(120,140,160,0.15)', border: 'rgba(120,140,160,0.5)', text: '#8aa0b8' }, // slate
  { bg: 'rgba(200,140,160,0.15)', border: 'rgba(200,140,160,0.5)', text: '#d898a8' }, // blush
  { bg: 'rgba(80,190,190,0.15)',  border: 'rgba(80,190,190,0.5)',  text: '#50c8c8' }, // cyan
]

export function getColor(colorIndex) {
  return ROLE_COLORS[colorIndex ?? 0] ?? ROLE_COLORS[ROLE_COLORS.length - 1]
}

/**
 * Colored pill for a saved role entry ({ role, color }).
 * onClick opens the picker.
 */
export function RolePill({ entry, onClick, style }) {
  if (!entry?.role) return (
    <span
      onClick={onClick}
      title="Click to set role/task"
      style={{
        fontSize: 11, color: 'var(--muted)', fontStyle: 'italic',
        border: '1px dashed var(--border2)', borderRadius: 3,
        padding: '0.1rem 0.4rem', cursor: 'pointer', userSelect: 'none',
        ...style,
      }}
    >
      + role
    </span>
  )
  const color = getColor(entry.color)
  return (
    <span
      onClick={onClick}
      title="Click to change role"
      style={{
        fontSize: 11, fontWeight: 500,
        background: color.bg,
        border: `1px solid ${color.border}`,
        color: color.text,
        borderRadius: 3, padding: '0.1rem 0.5rem',
        cursor: 'pointer', userSelect: 'none', flexShrink: 0,
        ...style,
      }}
    >
      {entry.role}
    </span>
  )
}

/**
 * Custom combo-box role picker.
 *
 * pool: Array of { role: string, color: number } — the trial's saved roles.
 * value: string — the current text value of the input.
 * onChange: (val: string) => void
 *
 * Color assignment happens in schema.js (addRoleToPool) not here.
 * This component is display/selection only.
 */
export default function RolePicker({ value, onChange, onSelect, onDelete, onClear, pool = [], placeholder = 'Type or pick a role...', style, autoFocus }) {
  const [open, setOpen] = useState(false)
  const [highlighted, setHighlighted] = useState(-1)
  const wrapperRef = useRef(null)
  const inputRef = useRef(null)

  const trimmed = value?.trim() || ''

  const listItems = [
    { type: 'add', label: null },
    ...(value ? [{ type: 'clear', label: null }] : []),
    ...pool.map(e => ({ type: 'pool', label: e.role, color: e.color })),
  ]

  useEffect(() => {
    function handleClick(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false)
        setHighlighted(-1)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function handleInputChange(e) {
    onChange(e.target.value)
    setOpen(true)
    setHighlighted(-1)
  }

  function handleSelect(label) {
    onChange(label)
    setOpen(false)
    setHighlighted(-1)
    onSelect?.(label)
  }

  function handleAddNew() {
    onChange('')
    setOpen(true)
    setHighlighted(-1)
    // Slight delay so the input is visible before we focus it
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  function handleKeyDown(e) {
    if (!open && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) { setOpen(true); return }
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlighted(h => Math.min(h + 1, listItems.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlighted(h => Math.max(h - 1, -1)) }
    else if (e.key === 'Enter') {
      if (highlighted >= 0 && listItems[highlighted]) { e.preventDefault(); handleSelect(listItems[highlighted].label) }
      else setOpen(false)
    } else if (e.key === 'Escape') { setOpen(false); setHighlighted(-1) }
  }

  return (
    <div ref={wrapperRef} style={{ position: 'relative', width: '100%', ...style }}>
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        <input
          ref={inputRef}
          type="text"
          value={value || ''}
          onChange={handleInputChange}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          autoFocus={autoFocus}
          autoComplete="off"
          style={{ width: '100%', fontSize: 11, padding: '0.2rem 1.6rem 0.2rem 0.4rem', boxSizing: 'border-box' }}
        />
        {pool.length > 0 && (
          <span
            onMouseDown={(e) => { e.preventDefault(); open ? setOpen(false) : setOpen(true); inputRef.current?.focus() }}
            style={{
              position: 'absolute', right: '0.35rem', fontSize: 9,
              color: 'var(--muted)', cursor: 'pointer', userSelect: 'none', lineHeight: 1,
              transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.15s',
            }}
          >▾</span>
        )}
      </div>

      {open && listItems.length > 0 && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 3px)', left: 0, right: 0,
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-sm)', boxShadow: '0 6px 16px rgba(0,0,0,0.4)',
          zIndex: 200, maxHeight: 180, overflowY: 'auto',
        }}>
          {listItems.map((item, idx) => {
            const isHighlighted = idx === highlighted
            const color = item.type === 'pool' ? getColor(item.color) : null
            return (
              <div
                key={item.label + item.type}
                onMouseDown={(e) => { e.preventDefault(); handleSelect(item.label) }}
                onMouseEnter={() => setHighlighted(idx)}
                onMouseLeave={() => setHighlighted(-1)}
                style={{
                  padding: '0.3rem 0.6rem', cursor: 'pointer',
                  background: isHighlighted ? 'var(--surface2)' : 'transparent',
                  borderBottom: idx < listItems.length - 1 ? '1px solid var(--border2)' : 'none',
                  display: 'flex', alignItems: 'center', gap: '0.4rem',
                  transition: 'background 0.08s',
                }}
              >
                {item.type === 'clear' ? (
                  <span
                    style={{ fontSize: 11, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                    onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(false); onClear?.() }}
                  >
                    <span style={{ fontSize: 11, lineHeight: 1 }}>✕</span>
                    Clear role
                  </span>
                ) : item.type === 'add' ? (
                  <span
                    style={{
                      fontSize: 11, color: 'var(--accent)',
                      display: 'flex', alignItems: 'center', gap: '0.35rem',
                    }}
                    onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); handleAddNew() }}
                  >
                    <span style={{ fontSize: 13, lineHeight: 1 }}>+</span>
                    Add new role
                  </span>
                ) : (
                  <>
                    <span style={{
                      fontSize: 11, fontWeight: 500,
                      background: color.bg, border: `1px solid ${color.border}`, color: color.text,
                      borderRadius: 3, padding: '0.05rem 0.5rem', flex: 1,
                    }}>{item.label}</span>
                    {onDelete && (
                      <span
                        onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); onDelete(item.label) }}
                        title="Remove role"
                        style={{
                          fontSize: 11, color: 'var(--muted)', cursor: 'pointer',
                          padding: '0 0.2rem', lineHeight: 1, flexShrink: 0,
                          borderRadius: 3,
                        }}
                        onMouseEnter={e => e.currentTarget.style.color = 'var(--danger)'}
                        onMouseLeave={e => e.currentTarget.style.color = 'var(--muted)'}
                      >✕</span>
                    )}
                  </>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
