import { cn } from '../../utils/cn'

export default function BottomSheet({ open, onToggle, title, subtitle, children }) {
  return (
    <div
      className={cn(
        'absolute inset-x-0 bottom-0 z-[550] flex flex-col rounded-t-[20px] bg-white shadow-sheet dark:bg-surface-dark',
        'max-h-[min(75vh,75dvh)] pb-[env(safe-area-inset-bottom,0px)]',
        'transition-transform duration-400 ease-[cubic-bezier(0.32,0.72,0,1)]',
        open ? 'translate-y-0' : 'translate-y-[calc(100%-260px)]',
      )}
    >
      {/* Drag handle */}
      <div className="w-9 h-1 bg-gray-200 dark:bg-gray-600 rounded-full mx-auto mt-3 shrink-0" />

      {/* Header toggle */}
      <button
        onClick={onToggle}
        aria-expanded={open}
        aria-label={open ? 'Collapse bay list' : 'Expand bay list'}
        className="flex items-center justify-between px-5 pt-3 pb-3.5 shrink-0 cursor-pointer w-full text-left"
      >
        <div>
          <div className="text-base font-bold text-gray-900 dark:text-white">{title}</div>
          {subtitle && (
            <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{subtitle}</div>
          )}
        </div>
        <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-sm">
          {open ? '↓' : '↑'}
        </div>
      </button>

      {/* Content */}
      <div className="flex-1 overflow-y-auto overscroll-contain webkit-overflow-touch">
        {children}
      </div>
    </div>
  )
}
