import { useReducedMotion } from '../../hooks/useReducedMotion'

export const TAB_BAR_HEIGHT = 56 // px, not including safe-area-inset-bottom

function MapIcon({ filled }) {
  return filled ? (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"
        fill="currentColor"
      />
      <circle cx="12" cy="9" r="2.5" fill="white" />
    </svg>
  ) : (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
      <circle cx="12" cy="9" r="2.5" />
    </svg>
  )
}

function PredictionsIcon({ filled }) {
  return filled ? (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3" y="12" width="4" height="9" rx="1" fill="currentColor" />
      <rect x="10" y="7" width="4" height="14" rx="1" fill="currentColor" />
      <rect x="17" y="3" width="4" height="18" rx="1" fill="currentColor" />
    </svg>
  ) : (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" aria-hidden>
      <line x1="5" y1="21" x2="5" y2="12" />
      <line x1="12" y1="21" x2="12" y2="7" />
      <line x1="19" y1="21" x2="19" y2="3" />
    </svg>
  )
}

const TABS = [
  { id: 'map',         label: 'Live Map',    Icon: MapIcon },
  { id: 'predictions', label: 'Predictions', Icon: PredictionsIcon },
]

export default function BottomTabBar({ activePage, onNavigate }) {
  const prefersReduced = useReducedMotion()

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-tab-bar flex bg-white dark:bg-surface-dark-secondary border-t border-gray-100 dark:border-gray-700/60"
      style={{
        height: `calc(${TAB_BAR_HEIGHT}px + env(safe-area-inset-bottom))`,
        paddingBottom: 'env(safe-area-inset-bottom)',
        // Subtle elevation to separate from map
        boxShadow: '0 -1px 3px rgba(0,0,0,0.06)',
      }}
      role="tablist"
      aria-label="Main navigation"
    >
      {TABS.map(({ id, label, Icon }) => {
        const isActive = activePage === id
        return (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={isActive}
            aria-label={label}
            onClick={() => !isActive && onNavigate?.(id)}
            className={[
              'flex flex-1 flex-col items-center justify-center gap-0.5 h-full cursor-pointer',
              'focus:outline-none focus-visible:bg-gray-100 dark:focus-visible:bg-gray-800',
              !prefersReduced && 'transition-colors duration-150',
              isActive
                ? 'text-brand dark:text-brand-light'
                : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300',
            ].filter(Boolean).join(' ')}
          >
            <Icon filled={isActive} />
            <span className={`text-[11px] font-semibold tracking-tight leading-none ${isActive ? '' : ''}`}>
              {label}
            </span>
          </button>
        )
      })}
    </div>
  )
}
