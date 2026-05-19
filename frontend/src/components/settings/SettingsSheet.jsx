import { useState } from 'react'
import MapsProviderSettingRow from './MapsProviderSettingRow'

const STORAGE_KEY = 'melopark-dark-mode'

function deriveThemeMode() {
  if (typeof window === 'undefined') return 'system'
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored === null) return 'system'
  return stored === 'true' ? 'dark' : 'light'
}

function SectionHeading({ label }) {
  return (
    <div className="pt-2 pb-1 text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 select-none">
      {label}
    </div>
  )
}

function Divider() {
  return <div className="h-px bg-gray-100 dark:bg-gray-700/60 my-1" />
}

function ToggleSwitch({ checked, onChange, label, hint, id }) {
  return (
    <div className="flex items-start justify-between gap-3 py-2">
      <div className="min-w-0">
        <label htmlFor={id} className="text-sm font-medium text-gray-800 dark:text-gray-100 cursor-pointer">
          {label}
        </label>
        {hint && (
          <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 leading-snug">{hint}</div>
        )}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={onChange}
        className={[
          'relative inline-flex h-5 w-10 shrink-0 cursor-pointer items-center rounded-full border transition-colors mt-0.5',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-1',
          checked
            ? 'border-brand bg-brand'
            : 'border-gray-300 bg-gray-200 hover:bg-gray-300 dark:border-slate-600 dark:bg-slate-700',
        ].join(' ')}
      >
        <span
          aria-hidden
          className={[
            'pointer-events-none absolute left-0.5 top-0.5 h-4 w-4 rounded-full shadow ring-1 transition-transform duration-200 ease-out',
            checked
              ? 'translate-x-5 bg-white ring-brand/20'
              : 'translate-x-0 bg-white ring-black/10 dark:bg-slate-300 dark:ring-white/10',
          ].join(' ')}
        />
      </button>
    </div>
  )
}

function NavRow({ label, hint, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-between gap-2 py-3 text-left cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-inset min-h-[44px]"
    >
      <div>
        <div className="text-sm font-medium text-gray-800 dark:text-gray-100">{label}</div>
        {hint && <div className="text-xs text-gray-400 mt-0.5">{hint}</div>}
      </div>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="text-gray-400 shrink-0">
        <polyline points="9 18 15 12 9 6" />
      </svg>
    </button>
  )
}

/**
 * Settings bottom sheet — consolidated from TopBar + filter accordion.
 *
 * Rendered at z-[570] (above sheet z-550, below search bar z-1000).
 * Opens at SNAP_HALF by default; drag to SNAP_FULL for Help & About.
 */
export default function SettingsSheet({
  open,
  onClose,
  darkMode,
  onSetTheme,
  colorBlindMode,
  onToggleColorBlind,
  accessibleOnly,
  onToggleAccessible,
  onNavigate,
  onHelpOpen,
}) {
  const [themeMode, setThemeMode] = useState(deriveThemeMode)

  const applyTheme = (mode) => {
    setThemeMode(mode)
    onSetTheme(mode)
  }

  if (!open) return null

  const chipBase = 'flex-1 rounded-full border py-1.5 text-xs font-semibold text-center cursor-pointer transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-1'
  const chipActive = 'border-brand bg-brand text-white'
  const chipIdle = 'border-slate-300 bg-white text-slate-700 hover:border-slate-400 dark:border-slate-600 dark:bg-surface-dark-secondary dark:text-gray-100'

  return (
    <>
      {/* Scrim */}
      <button
        type="button"
        aria-label="Close settings"
        className="fixed inset-0 z-[565] cursor-pointer border-0 bg-black/40 p-0"
        onClick={onClose}
      />

      {/* Sheet */}
      <div className="fixed bottom-0 left-0 right-0 z-[570] bg-white dark:bg-surface-dark rounded-t-[20px] shadow-sheet max-h-[80dvh] flex flex-col">
        {/* Drag handle visual */}
        <div className="pt-3 pb-0 flex flex-col items-center shrink-0">
          <div className="w-9 h-1 bg-gray-200 dark:bg-gray-600 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-3 pb-3 shrink-0 border-b border-gray-100 dark:border-gray-700/60">
          <span className="text-base font-bold text-gray-900 dark:text-white">Settings</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close settings"
            className="flex h-11 w-11 items-center justify-center rounded-full text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-100 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-1"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto overscroll-contain px-5 pb-8">
          {/* APPEARANCE */}
          <SectionHeading label="Appearance" />
          <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Theme</div>
          <div className="flex gap-2">
            {['light', 'dark', 'system'].map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => applyTheme(mode)}
                className={`${chipBase} ${themeMode === mode ? chipActive : chipIdle}`}
                aria-pressed={themeMode === mode}
              >
                {mode.charAt(0).toUpperCase() + mode.slice(1)}
              </button>
            ))}
          </div>

          <Divider />

          {/* MAP DISPLAY */}
          <SectionHeading label="Map Display" />
          <ToggleSwitch
            id="settings-colorblind"
            checked={colorBlindMode}
            onChange={onToggleColorBlind}
            label="Color-blind palette"
            hint="Adjusts street colors for red-green colorblindness"
          />

          <Divider />

          {/* ACCESSIBILITY */}
          <SectionHeading label="Accessibility" />
          <ToggleSwitch
            id="settings-accessible"
            checked={accessibleOnly}
            onChange={onToggleAccessible}
            label="Accessible bays only"
            hint="Filter map to DDA-compliant wheelchair-accessible bays"
          />

          <Divider />

          {/* NAVIGATION */}
          <SectionHeading label="Navigation" />
          <MapsProviderSettingRow />

          <Divider />

          {/* HELP & ABOUT */}
          <SectionHeading label="Help &amp; About" />
          <NavRow
            label="Help &amp; How to use"
            hint="Replay the walkthrough"
            onClick={() => { onClose(); onHelpOpen() }}
          />
          <Divider />
          <NavRow
            label="Attribution"
            onClick={() => { onClose(); onNavigate('attribution') }}
          />
          <NavRow
            label="Terms of Use"
            onClick={() => { onClose(); onNavigate('terms') }}
          />
          <NavRow
            label="About MelOPark"
            onClick={() => { onClose(); onNavigate('about') }}
          />

          <Divider />

          {/* Version footer */}
          <div className="pt-2 text-xs text-gray-400 dark:text-gray-500">
            v1.0 · Data: City of Melbourne Open Data
          </div>
        </div>
      </div>
    </>
  )
}
