import { useEffect, useState } from 'react'
import { cn } from '../../utils/cn'

export default function TrapToast({ message, visible, onDismiss, duration = 5000 }) {
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (visible) {
      requestAnimationFrame(() => setShow(true))
      const timer = setTimeout(() => {
        setShow(false)
        setTimeout(() => onDismiss?.(), 300)
      }, duration)
      return () => clearTimeout(timer)
    } else {
      setShow(false)
    }
  }, [visible, duration, onDismiss])

  if (!visible) return null

  return (
    <div
      role="alert"
      className={cn(
        'fixed top-20 left-1/2 -translate-x-1/2 z-[600] max-w-[min(420px,92vw)]',
        'bg-trap-50 dark:bg-surface-dark-secondary border border-trap-300 dark:border-trap-400/40',
        'text-orange-800 dark:text-orange-200 rounded-xl px-4 py-3 shadow-overlay',
        'flex items-start gap-3 transition-all duration-300',
        show ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2',
      )}
    >
      <span className="text-lg shrink-0 mt-0.5">&#9888;&#65039;</span>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold">Parking Trap Detected</div>
        <div className="text-xs mt-0.5 leading-relaxed">{message}</div>
      </div>
      <button
        onClick={() => {
          setShow(false)
          setTimeout(() => onDismiss?.(), 300)
        }}
        aria-label="Dismiss"
        className="shrink-0 text-orange-400 hover:text-orange-600 dark:text-orange-300 text-lg leading-none cursor-pointer bg-transparent border-none"
      >
        &times;
      </button>
    </div>
  )
}
