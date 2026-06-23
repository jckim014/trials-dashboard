import React, { useState, useEffect } from 'react'

const THEMES = [
  { id: 'default', label: 'Current (Cold Teal)' },
  { id: 'neon', label: 'Neon Gamer' },
  { id: 'warm', label: 'Warm Professional' },
  { id: 'mono', label: 'High Contrast Mono' },
  { id: 'social-light', label: 'Social Light' },
  { id: 'pastel', label: 'Soft Pastel' },
  { id: 'saas', label: 'Corporate SaaS' },
  { id: 'forest', label: 'Forest Sage' },
  { id: 'sunset', label: 'Sunset Arcade' },
]

const STORAGE_KEY = 'trials_theme_test'

/**
 * Dev/testing tool only — lets the admin preview different color palettes
 * live without touching code. Not meant for end users. Persisted to
 * localStorage so it survives refresh during a testing session.
 */
export default function ThemeSwitcher() {
  const [theme, setTheme] = useState(() => localStorage.getItem(STORAGE_KEY) || 'default')

  useEffect(() => {
    if (theme === 'default') {
      document.body.removeAttribute('data-theme')
    } else {
      document.body.setAttribute('data-theme', theme)
    }
    localStorage.setItem(STORAGE_KEY, theme)
  }, [theme])

  return (
    <div style={{ marginTop: '2rem', paddingTop: '1rem', borderTop: '1px solid var(--border2)' }}>
      <span className="label">Theme Preview (testing only)</span>
      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
        {THEMES.map((t) => (
          <button
            key={t.id}
            onClick={() => setTheme(t.id)}
            className={theme === t.id ? 'btn-primary' : ''}
            style={{ fontSize: 12 }}
          >
            {t.label}
          </button>
        ))}
      </div>
      <p style={{ marginTop: '0.4rem', fontSize: 12 }}>
        Applies instantly across the whole app for this browser session.
      </p>
    </div>
  )
}
