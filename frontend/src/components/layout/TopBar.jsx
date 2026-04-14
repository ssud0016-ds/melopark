import { useClock } from '../../hooks/useClock'
import { cn } from '../../utils/cn'

const NAV_ITEMS = [
  { id: 'home', label: 'Home' },
  { id: 'map', label: 'Live Map' },
]

export default function TopBar({ activePage, onNavigate, darkMode, onToggleDark }) {
  const time = useClock()

  return (
    <nav
      className="fixed top-0 inset-x-0 z-50 h-16 bg-white dark:bg-surface-dark border-b
                 border-gray-200/60 dark:border-gray-700/60 shadow-sm px-4 md:px-6
                 grid grid-cols-[1fr_auto_1fr] items-center"
    >
      {/* Logo */}
      <a
        href="#"
        onClick={(e) => { e.preventDefault(); onNavigate('home') }}
        className="flex items-center gap-2.5 justify-self-start"
      >
        <div className="w-8 h-8 bg-brand rounded-lg flex items-center justify-center font-extrabold text-sm text-white">
          P
        </div>
        <span className="font-bold text-lg text-gray-900 dark:text-white">
          Melo<span className="text-brand">Park</span>
        </span>
      </a>

      {/* Centre nav */}
      <ul className="flex items-center gap-1 justify-self-center" role="tablist">
        {NAV_ITEMS.map(({ id, label }) => (
          <li key={id} role="presentation">
            <button
              role="tab"
              aria-selected={activePage === id}
              onClick={() => onNavigate(id)}
              className={cn(
                'px-4 py-1.5 rounded-lg text-sm font-medium transition-colors',
                activePage === id
                  ? 'bg-brand-50 text-brand dark:bg-brand-900 dark:text-brand-light'
                  : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100',
              )}
            >
              {label}
            </button>
          </li>
        ))}
      </ul>

      {/* Right — live badge + dark toggle */}
      <div className="flex items-center gap-3 justify-self-end">
        <div className="hidden sm:flex items-center gap-2 bg-brand-50 dark:bg-brand-900/40 border border-brand/20 rounded-full px-3.5 py-1.5 text-xs font-medium text-brand-dark dark:text-brand-light">
          <span className="w-1.5 h-1.5 rounded-full bg-brand animate-pulse-dot" />
          Live CBD&nbsp;{time}
        </div>

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
