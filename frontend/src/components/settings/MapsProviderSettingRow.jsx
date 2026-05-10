import { useState } from 'react'
import { useMapsProvider } from '../../hooks/useMapsProvider'
import MapsProviderChooser, {
  MAPS_PROVIDER_LABELS,
} from '../maps/MapsProviderChooser'

export default function MapsProviderSettingRow() {
  const { provider, setProvider, clearProvider } = useMapsProvider()
  const [open, setOpen] = useState(false)

  const valueLabel = provider ? MAPS_PROVIDER_LABELS[provider] : 'Not set'

  return (
    <div className="mt-1 flex items-stretch rounded-lg border border-slate-200/60 bg-white/60 dark:border-slate-600/40 dark:bg-surface-dark/50">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full min-h-[44px] items-center justify-between gap-2 px-2.5 py-1.5 text-left cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-1"
        aria-haspopup="dialog"
      >
        <span className="text-[11px] font-semibold text-slate-600 dark:text-gray-300">
          Maps provider
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className={
              provider
                ? 'text-[11px] font-medium text-gray-900 dark:text-gray-100'
                : 'text-[11px] font-medium text-gray-400'
            }
          >
            {valueLabel}
          </span>
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden
            className="text-gray-400"
          >
            <path
              d="M9 6l6 6-6 6"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </button>

      <MapsProviderChooser
        open={open}
        initialProvider={provider}
        showRemember={false}
        showClear={Boolean(provider)}
        confirmLabel="Save"
        onConfirm={(p) => {
          setProvider(p)
          setOpen(false)
        }}
        onClear={() => clearProvider()}
        onClose={() => setOpen(false)}
      />
    </div>
  )
}
