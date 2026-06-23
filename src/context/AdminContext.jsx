import React, { createContext, useContext, useState, useEffect } from 'react'
import { sha256Hex } from '../utils/hash.js'
import { getAdminConfig } from '../data/schema.js'

const AdminContext = createContext(null)

const SESSION_KEY = 'trials_admin_authed'

export function AdminProvider({ children }) {
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    // Restore session flag (cleared when tab/browser closes)
    const stored = sessionStorage.getItem(SESSION_KEY)
    if (stored === 'true') setIsAdmin(true)
    setLoading(false)
  }, [])

  async function login(passphrase) {
    setError(null)
    try {
      const config = await getAdminConfig()
      if (!config?.passwordHash) {
        setError('Admin not configured yet.')
        return false
      }
      const hash = await sha256Hex(passphrase)
      if (hash === config.passwordHash) {
        setIsAdmin(true)
        sessionStorage.setItem(SESSION_KEY, 'true')
        return true
      } else {
        setError('Incorrect passphrase.')
        return false
      }
    } catch (e) {
      setError('Login failed: ' + e.message)
      return false
    }
  }

  function logout() {
    setIsAdmin(false)
    sessionStorage.removeItem(SESSION_KEY)
  }

  return (
    <AdminContext.Provider value={{ isAdmin, loading, error, login, logout }}>
      {children}
    </AdminContext.Provider>
  )
}

export function useAdmin() {
  const ctx = useContext(AdminContext)
  if (!ctx) throw new Error('useAdmin must be used within AdminProvider')
  return ctx
}
