import { useEffect, useRef, useState } from 'react'
import { cn } from '../../utils/cn'
import { listFocusable } from '../../utils/focusTrap'
import { useReducedMotion } from '../../hooks/useReducedMotion'

const OPTIONS = [
  {
    value: 'google',
    label: 'Google Maps',
    sub: 'Native app or browser',
  },
  {
    value: 'apple',
    label: 'Apple Maps',
    sub: 'iPhone & iPad',
  },
  {
    value: 'web',
    label: 'Browser fallback',
    sub: 'Always opens in this browser',
  },
]

export const MAPS_PROVIDER_LABELS = OPTIONS.reduce((acc, o) => {
  acc[o.value] = o.label
  return acc
}, {})

/**
 * Modal chooser. Reuses OnboardingOverlay pattern.
 *
 * @param {{
 *   open: boolean,
 *   initialProvider?: 'google'|'apple'|'web'|null,
 *   showRemember?: boolean,
 *   showClear?: boolean,
 *   confirmLabel?: string,
 *   onConfirm: (provider: 'google'|'apple'|'web', remember: boolean) => void,
 *   onClear?: () => void,
 *   onClose: () => void,
 * }} props
 */
export default function MapsProviderChooser({
  open,
  initialProvider = null,
  showRemember = true,
  showClear = false,
  confirmLabel,
  onConfirm,
  onClear,
  onClose,
}) {
  const panelRef = useRef(null)
  const previousFocusRef = useRef(null)
  const prefersReduced = useReducedMotion()
  const [selected, setSelected] = useState(initialProvider || 'google')
  const [remember, setRemember] = useState(true)

  useEffect(() => {
    if (open) {
      setSelected(initialProvider || 'google')
      setRemember(true)
    }
  }, [open, initialProvider])

  useEffect(() => {
    if (!open) return
    previousFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null

    const root = panelRef.current
    if (root) {
      const first = listFocusable(root)[0]
      first?.focus?.()
    }

    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
        return
      }
      if (e.key !== 'Tab') return
      const root = panelRef.current
      if (!root) return
      const elems = listFocusable(root)
      if (elems.length === 0) return
      const active = document.activeElement
      const first = elems[0]
      const last = elems[elems.length - 1]
      if (!e.shiftKey && active === last) {
        e.preventDefault()
        first.focus()
      } else if (e.shiftKey && active === first) {
        e.preventDefault()
        last.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown, true)
    return () => {
      document.removeEventListener('keydown', onKeyDown, true)
      const prev = previousFocusRef.current
      if (prev && document.body.contains(prev) && typeof prev.focus === 'function') {
        prev.focus()
      }
    }
  }, [open, onClose])

  if (!open) return null

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) onClose()
  }

  const confirm = () => {
    onConfirm(selected, showRemember ? remember : true)
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="maps-chooser-title"
      onMouseDown={handleBackdropClick}
      className={cn(
        'fixed inset-0 z-[2100] flex items-center justify-center bg-black/35 dark:bg-black/55 px-4',
        prefersReduced ? '' : 'backdrop-blur-[2px]',
      )}
    >
      <div
        ref={panelRef}
        className="w-full max-w-[360px] rounded-2xl bg-white dark:bg-surface-dark-secondary shadow-sheet p-6"
      >
        <h2
          id="maps-chooser-title"
          className="text-xl font-bold text-gray-900 dark:text-gray-100"
        >
          Choose your maps app
        </h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          MelOPark will use this whenever you open directions.
        </p>

        <fieldset
          className="mt-4 flex flex-col gap-2"
          aria-label="Maps provider options"
        >
          {OPTIONS.map((opt) => {
            const isSelected = selected === opt.value
            return (
              <label
                key={opt.value}
                className={cn(
                  'flex items-start gap-3 rounded-lg border px-3 py-2 cursor-pointer min-h-[44px]',
                  'focus-within:ring-2 focus-within:ring-brand focus-within:ring-offset-1',
                  isSelected
                    ? 'border-brand bg-brand-50 dark:bg-brand-900/30 dark:border-brand-300'
                    : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50',
                )}
              >
                <input
                  type="radio"
                  name="maps-provider"
                  value={opt.value}
                  checked={isSelected}
                  onChange={() => setSelected(opt.value)}
                  className="mt-1 h-4 w-4 accent-brand"
                />
                <span className="flex-1">
                  <span className="block text-sm font-semibold text-gray-900 dark:text-gray-100">
                    {opt.label}
                  </span>
                  <span className="block text-xs text-gray-500 dark:text-gray-400">
                    {opt.sub}
                  </span>
                </span>
              </label>
            )
          })}
        </fieldset>

        {showRemember && (
          <label className="mt-4 flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              className="h-4 w-4 accent-brand"
            />
            <span className="text-sm text-gray-700 dark:text-gray-200">
              Remember my choice
            </span>
          </label>
        )}

        {showClear && (
          <button
            type="button"
            onClick={() => {
              onClear?.()
              onClose()
            }}
            className="mt-4 text-sm font-semibold text-brand dark:text-brand-100 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-1 cursor-pointer"
          >
            Clear preference
          </button>
        )}

        <div className="mt-6 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] rounded-lg px-4 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-1 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={confirm}
            className="min-h-[44px] rounded-lg bg-brand px-4 text-sm font-semibold text-white hover:bg-brand/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-1 cursor-pointer"
          >
            {confirmLabel || 'Continue'}
          </button>
        </div>
      </div>
    </div>
  )
}
