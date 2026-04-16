import { useClock } from '../../hooks/useClock'
import { cn } from '../../utils/cn'

export default function TopBar({ activePage, onNavigate, darkMode, onToggleDark }) {
  const time = useClock()

  return (
    <nav
      className="fixed top-0 inset-x-0 z-50 flex min-h-[calc(4rem+env(safe-area-inset-top,0px))] items-center justify-between border-b border-gray-200/60 bg-white pt-[env(safe-area-inset-top,0px)] pl-[max(1rem,env(safe-area-inset-left,0px))] pr-[max(1rem,env(safe-area-inset-right,0px))] shadow-sm dark:border-gray-700/60 dark:bg-surface-dark md:pl-[max(1.5rem,env(safe-area-inset-left,0px))] md:pr-[max(1.5rem,env(safe-area-inset-right,0px))]"
    >
      {/* Logo — navigates to map */}
      <a
        href="#"
        onClick={(e) => { e.preventDefault(); onNavigate('map') }}
        className="flex items-center gap-2.5"
      >
        <div className="w-8 h-8 bg-brand rounded-lg flex items-center justify-center font-extrabold text-sm text-white">
          P
        </div>
        <span className="font-bold text-lg text-gray-900 dark:text-white">
          Melo<span className="text-brand">Park</span>
        </span>
      </a>

      {/* Right — live badge + About Us + dark toggle */}
      <div className="flex items-center gap-3">
        <div className="hidden sm:flex items-center gap-2 bg-brand-50 dark:bg-brand-900/40 border border-brand/20 rounded-full px-3.5 py-1.5 text-xs font-medium text-brand-dark dark:text-brand-light">
          <span className="w-1.5 h-1.5 rounded-full bg-brand animate-pulse-dot" />
          Live CBD&nbsp;{time}
        </div>

        <button
          onClick={() => onNavigate('about')}
          className={cn(
            'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
            activePage === 'about'
              ? 'bg-brand-50 text-brand dark:bg-brand-900 dark:text-brand-light'
              : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100',
          )}
        >
          About Us
        </button>

        <button
          onClick={onToggleDark}
          aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-500
                     hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-base"
        >
          {darkMode ? '☀️' : '🌙'}
        </button>
      </div>
    </nav>
  )
}
