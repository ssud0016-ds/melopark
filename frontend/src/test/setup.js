import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

afterEach(() => {
  cleanup()
})

// jsdom 27 ships a non-functional Storage implementation (the `localStorage`
// object has no `getItem`/`setItem`/`clear` methods). Install a Map-backed
// shim so production code paths and tests can use it.
if (typeof window !== 'undefined') {
  const needsShim = typeof window.localStorage?.getItem !== 'function'
  if (needsShim) {
    const makeStorage = () => {
      const m = new Map()
      return {
        get length() {
          return m.size
        },
        clear() {
          m.clear()
        },
        getItem(k) {
          return m.has(String(k)) ? m.get(String(k)) : null
        },
        setItem(k, v) {
          m.set(String(k), String(v))
        },
        removeItem(k) {
          m.delete(String(k))
        },
        key(i) {
          return Array.from(m.keys())[i] ?? null
        },
      }
    }
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: makeStorage(),
    })
    Object.defineProperty(window, 'sessionStorage', {
      configurable: true,
      value: makeStorage(),
    })
  }
}

if (typeof window !== 'undefined' && !window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }),
  })
}
