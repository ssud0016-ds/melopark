import { useState } from 'react'

/** Change this string to set the shared site password (visible in source; deters casual visitors only). */
const FIXED_SITE_PASSWORD = 'Flamingo031'

const STORAGE_KEY = 'melopark_site_unlocked'

function isGateActive() {
  if (import.meta.env.DEV) return false
  return FIXED_SITE_PASSWORD.length > 0
}

export default function SiteGate({ children }) {
  const [unlocked, setUnlocked] = useState(() => {
    if (!isGateActive()) return true
    try {
      return sessionStorage.getItem(STORAGE_KEY) === '1'
    } catch {
      return false
    }
  })

  const [value, setValue] = useState('')
  const [error, setError] = useState(null)

  if (!isGateActive() || unlocked) {
    return children
  }

  const submit = (e) => {
    e.preventDefault()
    const attempt = value.trim()
    if (attempt === FIXED_SITE_PASSWORD) {
      try {
        sessionStorage.setItem(STORAGE_KEY, '1')
      } catch {
        /* ignore quota / private mode */
      }
      setUnlocked(true)
      setError(null)
      return
    }
    setError('Incorrect password.')
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-surface px-4 dark:bg-surface-dark">
      <div className="w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-8 shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <h1 className="text-center text-xl font-semibold text-brand-900 dark:text-brand-100">
          MelOPark
        </h1>
        <p className="mt-2 text-center text-sm text-gray-600 dark:text-gray-400">
          Enter the site password to continue.
        </p>
        <form className="mt-6 space-y-4" onSubmit={submit}>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Password
            <input
              type="password"
              autoComplete="current-password"
              value={value}
              onChange={(e) => {
                setValue(e.target.value)
                setError(null)
              }}
              className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
            />
          </label>
          {error ? (
            <p className="text-sm text-danger-500" role="alert">
              {error}
            </p>
          ) : null}
          <button
            type="submit"
            className="w-full rounded-lg bg-brand-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-brand-800 dark:bg-brand-700 dark:hover:bg-brand-600"
          >
            Continue
          </button>
        </form>
      </div>
    </div>
  )
}
