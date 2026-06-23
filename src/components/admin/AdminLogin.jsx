import React, { useState } from 'react'
import { useAdmin } from '../../context/AdminContext.jsx'

export default function AdminLogin() {
  const { login, error } = useAdmin()
  const [passphrase, setPassphrase] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitting(true)
    await login(passphrase)
    setSubmitting(false)
  }

  return (
    <div style={{ maxWidth: 340, margin: '4rem auto' }}>
      <div className="card">
        <div style={{ marginBottom: '1.25rem' }}>
          <div className="card-title" style={{ fontSize: 16, marginBottom: '0.25rem' }}>Admin Access</div>
          <p style={{ fontSize: 12 }}>Enter the admin passphrase to continue.</p>
        </div>
        <form onSubmit={handleSubmit}>
          <span className="label">Passphrase</span>
          <input
            type="password"
            placeholder="Enter passphrase..."
            value={passphrase}
            onChange={(e) => setPassphrase(e.target.value)}
            style={{ width: '100%', marginBottom: '0.75rem' }}
            autoFocus
          />
          <button
            type="submit"
            className="btn-primary"
            disabled={submitting || !passphrase.trim()}
            style={{ width: '100%', padding: '0.5rem' }}
          >
            {submitting ? 'Verifying...' : 'Log in'}
          </button>
        </form>
        {error && <div className="alert alert-error" style={{ marginTop: '0.75rem', marginBottom: 0 }}>{error}</div>}
      </div>
    </div>
  )
}
