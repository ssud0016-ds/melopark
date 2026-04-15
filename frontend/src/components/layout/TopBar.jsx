import { useClock } from '../../hooks/useClock'
import { cn } from '../../utils/cn'

function SunGlyph({ className }) {
  return (
    <svg className={className} width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.75" />
      <path
        d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  )
}

function MoonGlyph({ className }) {
  return (
    <svg className={className} width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M21 14.5A8.5 8.5 0 0 1 9.5 3 6.7 6.7 0 1 0 21 14.5Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export default function TopBar({ activePage, onNavigate, darkMode, onToggleDark }) {
  const time = useClock()
  return (
    <nav
      className="fixed top-0 inset-x-0 z-50 h-16 overflow-visible bg-white dark:bg-surface-dark border-b
                 border-gray-200/60 dark:border-gray-700/60 shadow-sm px-3 sm:px-4 md:px-6
                 flex items-center gap-2 sm:gap-3"
    >
      {/* Logo — left */}
      <a
        href="#"
        onClick={(e) => { e.preventDefault(); onNavigate('map') }}
        className="relative z-[1] flex shrink-0 items-center bg-transparent"
      >
        <img
          src={darkMode ? '/MelOParkLogoDark.png' : '/MelOParkLogoLight.png'}
          alt="MelOPark"
          className="block h-[10.25rem] w-auto max-w-[min(860px,95vw)] object-contain object-left bg-transparent
                     drop-shadow-[0_2px_8px_rgba(0,0,0,0.18)] dark:drop-shadow-[0_2px_14px_rgba(0,0,0,0.65)]"
        />
      </a>

      {/* Centre — Live Map + About Us */}
      <div className="flex min-w-0 flex-1 items-center justify-center gap-2 sm:gap-3 px-1">
        <button
          type="button"
          onClick={() => onNavigate('map')}
          aria-current={activePage === 'map' ? 'page' : undefined}
          aria-label="Go to Live Map"
          className={cn(
            'shrink-0 rounded-lg border-0 px-2.5 py-1.5 text-xs transition-colors sm:px-3 sm:text-sm',
            activePage === 'map'
              ? 'bg-brand-50 font-medium text-brand dark:bg-brand dark:font-semibold dark:text-white'
              : 'bg-transparent font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:bg-transparent dark:font-normal dark:text-gray-200 dark:hover:bg-white/5 dark:hover:text-white',
          )}
        >
          Live Map
        </button>
        <button
          type="button"
          onClick={() => onNavigate('about')}
          className={cn(
            'shrink-0 rounded-lg border-0 px-2.5 py-1.5 text-xs transition-colors sm:px-3 sm:text-sm',
            activePage === 'about'
              ? 'bg-brand-50 font-medium text-brand dark:bg-brand dark:font-semibold dark:text-white'
              : 'bg-transparent font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:bg-transparent dark:font-normal dark:text-gray-200 dark:hover:bg-white/5 dark:hover:text-white',
          )}
        >
          About Us
        </button>
      </div>

      {/* Right — live badge + theme toggle */}
      <div className="flex shrink-0 items-center gap-2 sm:gap-3">
        <div className="hidden sm:flex items-center gap-2 rounded-full border border-brand bg-brand px-3.5 py-1.5 text-xs font-medium text-white dark:border-brand-300/80 dark:bg-brand-50 dark:text-brand-900">
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-white/85 animate-pulse-dot dark:bg-brand-700" />
          Live CBD&nbsp;{time}
        </div>

        <div className="flex items-center gap-1">
          <span
            className={cn(
              'flex shrink-0 text-amber-600',
              darkMode ? 'text-amber-300' : 'opacity-100',
            )}
            title="Day"
            aria-hidden
          >
            <SunGlyph />
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={darkMode}
            aria-label={darkMode ? 'Switch to day view' : 'Switch to night view'}
            onClick={onToggleDark}
            className={cn(
              'relative inline-flex h-5 w-10 shrink-0 cursor-pointer items-center rounded-full border transition-colors',
              'border-gray-300 bg-gray-200 hover:bg-gray-300',
              'dark:border-brand-300/80 dark:bg-brand-100 dark:hover:bg-brand-50',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2',
              'dark:focus-visible:ring-offset-surface-dark',
            )}
          >
            <span
              aria-hidden
              className={cn(
                'pointer-events-none absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow ring-1 ring-black/10 transition-transform duration-200 ease-out',
                'dark:bg-brand-900 dark:ring-brand-800/40',
                darkMode ? 'translate-x-5' : 'translate-x-0',
              )}
            />
          </button>
          <span
            className={cn(
              'flex shrink-0 text-brand',
              darkMode ? 'text-brand-100' : 'opacity-35',
            )}
            title="Night"
            aria-hidden
          >
            <MoonGlyph />
          </span>
        </div>
      </div>
    </nav>
  )
}
