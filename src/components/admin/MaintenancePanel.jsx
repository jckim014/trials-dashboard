import React, { useState } from 'react'
import { setMetaforgeCache, exportSnapshot, importSnapshot } from '../../data/schema.js'

const FETCH_COMMAND = `fetch('https://metaforge.app/api/arc-raiders/events-schedule').then(r=>r.json()).then(d=>console.log(JSON.stringify(d)))`

export default function MaintenancePanel() {
  return (
    <div>
      <ScheduleSection />
      <hr className="divider" />
      <BackupSection />
      <hr className="divider" />
      <ThemeSwitcherSection />
    </div>
  )
}

// ── Schedule Cache ────────────────────────────────────────────────────────────

function ScheduleSection() {
  const [json, setJson] = useState('')
  const [status, setStatus] = useState(null)
  const [error, setError] = useState(null)
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    await navigator.clipboard.writeText(FETCH_COMMAND)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function handleSave() {
    setStatus('saving')
    setError(null)
    try {
      const parsed = JSON.parse(json)
      const items = Array.isArray(parsed?.data) ? parsed.data : []
      if (items.length === 0) throw new Error('No data array found. Make sure you copied the full response.')
      const normalized = items
        .filter(item => item.map && item.name && item.startTime)
        .map(item => ({ map: item.map, condition: item.name, startTime: item.startTime, endTime: item.endTime || null }))
      await setMetaforgeCache(normalized)
      setStatus('success')
      setJson('')
    } catch (e) {
      setError(e.message)
      setStatus('error')
    }
  }

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>Update Schedule Cache</h2>
      <p style={{ marginBottom: '0.75rem', fontSize: 13 }}>
        Paste fresh schedule JSON from the Metaforge API to update the event time dropdowns.
        Do this weekly or when time windows look stale.
      </p>
      <ol style={{ color: 'var(--muted)', fontSize: 13, marginBottom: '1rem', paddingLeft: '1.25rem', lineHeight: 2 }}>
        <li>Go to <a href="https://metaforge.app/arc-raiders/event-timers" target="_blank" rel="noreferrer">metaforge.app/arc-raiders/event-timers</a></li>
        <li>Open DevTools (F12) → Console</li>
        <li>
          Click to copy the command, then paste and run it in the console:
          <div
            onClick={handleCopy}
            title="Click to copy"
            style={{
              marginTop: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.6rem',
              background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
              padding: '0.5rem 0.75rem', cursor: 'pointer', transition: 'border-color 0.12s, background 0.12s',
              ...(copied ? { borderColor: 'var(--success)', background: 'rgba(63,185,80,0.08)' } : {}),
            }}
            onMouseEnter={e => { if (!copied) e.currentTarget.style.borderColor = 'var(--accent)' }}
            onMouseLeave={e => { if (!copied) e.currentTarget.style.borderColor = 'var(--border)' }}
          >
            <code style={{ flex: 1, fontSize: 11, color: 'var(--accent)', wordBreak: 'break-all', background: 'none', border: 'none', padding: 0 }}>
              {FETCH_COMMAND}
            </code>
            <span style={{ fontSize: 12, color: copied ? 'var(--success)' : 'var(--muted)', whiteSpace: 'nowrap', flexShrink: 0 }}>
              {copied ? '✓ Copied' : '⎘ Copy'}
            </span>
          </div>
        </li>
        <li>Copy the output from the console and paste it below</li>
      </ol>
      <span className="label">Schedule JSON</span>
      <textarea
        value={json}
        onChange={(e) => setJson(e.target.value)}
        placeholder="Paste JSON here..."
        rows={5}
        style={{ width: '100%', fontFamily: 'var(--font-mono)', fontSize: 11 }}
      />
      <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
        <button className="btn-primary" onClick={handleSave} disabled={status === 'saving' || !json.trim()}>
          {status === 'saving' ? 'Saving...' : 'Save to Cache'}
        </button>
        {status === 'success' && <span style={{ color: 'var(--success)', fontSize: 13 }}>Schedule cached successfully</span>}
        {status === 'error' && <span style={{ color: 'var(--danger)', fontSize: 13 }}>{error}</span>}
      </div>
    </div>
  )
}

// ── Backup / Restore ──────────────────────────────────────────────────────────

function BackupSection() {
  const [exportStatus, setExportStatus] = useState(null)
  const [importStatus, setImportStatus] = useState(null)
  const [importError, setImportError] = useState(null)
  const [importing, setImporting] = useState(false)

  async function handleExport() {
    setExportStatus('exporting')
    try {
      const snapshot = await exportSnapshot()
      const json = JSON.stringify(snapshot, null, 2)
      const blob = new Blob([json], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `trials-backup-${new Date().toISOString().slice(0, 10)}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      setExportStatus('success')
      setTimeout(() => setExportStatus(null), 3000)
    } catch (e) {
      console.error('Export failed:', e)
      setExportStatus('error')
    }
  }

  async function handleImport(e) {
    const file = e.target.files?.[0]
    if (!file) return

    setImportError(null)
    setImportStatus(null)

    const confirmed = window.confirm(
      '⚠️ This will overwrite ALL existing data with the contents of this backup file. This cannot be undone. Are you sure?'
    )
    if (!confirmed) { e.target.value = ''; return }

    const doubleConfirmed = window.confirm(
      'Final confirmation — all current data will be replaced. Proceed?'
    )
    if (!doubleConfirmed) { e.target.value = ''; return }

    setImporting(true)
    try {
      const text = await file.text()
      const snapshot = JSON.parse(text)
      await importSnapshot(snapshot)
      setImportStatus('success')
    } catch (err) {
      setImportError(err.message)
      setImportStatus('error')
    }
    setImporting(false)
    e.target.value = ''
  }

  return (
    <div>
      <h2>Data Snapshot</h2>
      <p style={{ fontSize: 13, marginBottom: '1.5rem' }}>
        Export a full backup of all app data as a JSON file. To restore, import a previously exported file — this will completely overwrite all current data.
      </p>

      {/* Export */}
      <div style={{ marginBottom: '1.5rem' }}>
        <span className="label">Export</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button
            onClick={handleExport}
            disabled={exportStatus === 'exporting'}
            style={{ padding: '0.4rem 1rem' }}
          >
            {exportStatus === 'exporting' ? 'Exporting...' : '⬇ Download Backup'}
          </button>
          {exportStatus === 'success' && <span style={{ color: 'var(--success)', fontSize: 13 }}>Backup downloaded</span>}
          {exportStatus === 'error' && <span style={{ color: 'var(--danger)', fontSize: 13 }}>Export failed</span>}
        </div>
        <p style={{ fontSize: 12, marginTop: '0.4rem' }}>
          Exports all players, events, sessions, stats, scores, and config. Excludes the temporary schedule cache.
        </p>
      </div>

      {/* Import */}
      <div>
        <span className="label">Restore from Backup</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <label
            style={{
              display: 'inline-block', padding: '0.4rem 1rem', fontSize: 13,
              border: '1px solid var(--danger)', borderRadius: 'var(--radius-sm)',
              color: 'var(--danger)', cursor: importing ? 'not-allowed' : 'pointer',
              opacity: importing ? 0.5 : 1, background: 'transparent',
            }}
          >
            {importing ? 'Restoring...' : '⬆ Upload Backup File'}
            <input
              type="file"
              accept=".json"
              onChange={handleImport}
              disabled={importing}
              style={{ display: 'none' }}
            />
          </label>
          {importStatus === 'success' && <span style={{ color: 'var(--success)', fontSize: 13 }}>Restore complete — reload the page</span>}
          {importStatus === 'error' && <span style={{ color: 'var(--danger)', fontSize: 13 }}>{importError}</span>}
        </div>
        <p style={{ fontSize: 12, marginTop: '0.4rem', color: 'var(--danger)' }}>
          ⚠ Overwrites all current data. Cannot be undone. Double confirmation required.
        </p>
      </div>
    </div>
  )
}

// ── Theme Switcher ────────────────────────────────────────────────────────────
// Kept here as a maintenance/testing tool, not surfaced to regular users.

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

function ThemeSwitcherSection() {
  const [theme, setTheme] = React.useState(() => localStorage.getItem('trials_theme_test') || 'default')

  React.useEffect(() => {
    if (theme === 'default') {
      document.body.removeAttribute('data-theme')
    } else {
      document.body.setAttribute('data-theme', theme)
    }
    localStorage.setItem('trials_theme_test', theme)
  }, [theme])

  return (
    <div>
      <h2>Theme Preview</h2>
      <p style={{ fontSize: 13, marginBottom: '0.75rem' }}>Testing only — applies instantly across the whole app for this browser session.</p>
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
    </div>
  )
}
