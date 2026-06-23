import React, { useState } from 'react'
import { setMetaforgeCache } from '../../data/schema.js'

const FETCH_COMMAND = `fetch('https://metaforge.app/api/arc-raiders/events-schedule').then(r=>r.json()).then(d=>console.log(JSON.stringify(d)))`

export default function ScheduleCachePanel() {
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
        .map(item => ({
          map: item.map,
          condition: item.name,
          startTime: item.startTime,
          endTime: item.endTime || null,
        }))
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
              marginTop: '0.4rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.6rem',
              background: 'var(--bg)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              padding: '0.5rem 0.75rem',
              cursor: 'pointer',
              transition: 'border-color 0.12s, background 0.12s',
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
        placeholder='Paste JSON here...'
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
