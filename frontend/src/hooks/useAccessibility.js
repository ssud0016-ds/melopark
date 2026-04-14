import { useCallback, useRef } from 'react'

export function useAccessibility() {
  const liveRef = useRef(null)

  const announce = useCallback((message) => {
    const el = liveRef.current
    if (!el) return
    el.textContent = ''
    requestAnimationFrame(() => {
      el.textContent = message
    })
  }, [])

  const LiveRegion = () => (
    <div
      ref={liveRef}
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className="sr-only"
    />
  )

  return { announce, LiveRegion }
}
