import { useState } from 'react'
import { bayLatLng, destinationLatLng } from '../../utils/mapGeo'
import { isValidLatLng } from '../../utils/buildMapsUrl'
import { useMapsProvider } from '../../hooks/useMapsProvider'
import { detectPlatform } from '../../utils/platform'
import { launchMaps } from '../maps/launchMaps'
import MapsProviderChooser, {
  MAPS_PROVIDER_LABELS,
} from '../maps/MapsProviderChooser'

const PLATFORM_DEFAULT = {
  ios: 'apple',
  android: 'google',
  desktop: 'google',
}

/**
 * Navigate + Walk CTAs for BayDetailSheet.
 *
 * @param {{
 *   bay: any,
 *   destination: any,
 *   isMobile?: boolean,
 * }} props
 */
export default function BayDetailNavActions({ bay, destination }) {
  const { provider, setProvider } = useMapsProvider()
  const [chooserOpen, setChooserOpen] = useState(false)
  const [pendingMode, setPendingMode] = useState(null)
  const [notice, setNotice] = useState(null)

  const hasBayCoords =
    bay &&
    ((typeof bay.lat === 'number' && typeof bay.lng === 'number') ||
      (typeof bay.x === 'number' && typeof bay.y === 'number'))
  const hasDestCoords =
    destination &&
    ((typeof destination.lat === 'number' && typeof destination.lng === 'number') ||
      (typeof destination.x === 'number' && typeof destination.y === 'number'))

  const bayLL = hasBayCoords ? bayLatLng(bay) : null
  const destLL = hasDestCoords ? destinationLatLng(destination) : null
  const validBay = isValidLatLng(bayLL)
  const validDest = isValidLatLng(destLL)

  if (!validBay) return null

  const start = (mode) => {
    setNotice(null)
    if (provider) {
      runLaunch(provider, mode)
      return
    }
    setPendingMode(mode)
    setChooserOpen(true)
  }

  const runLaunch = (chosen, mode) => {
    const args = {
      provider: chosen,
      mode,
      destination: bayLL,
      onFallback: ({ provider: p }) => {
        const label = MAPS_PROVIDER_LABELS[p] || p
        setNotice({
          message: `Couldn't open ${label}. Opened Google Maps web instead.`,
        })
      },
    }
    if (mode === 'walk') {
      args.origin = bayLL
      args.destination = destLL
    }
    launchMaps(args)
  }

  const handleConfirm = (chosen, remember) => {
    if (remember) setProvider(chosen)
    setChooserOpen(false)
    if (pendingMode) {
      runLaunch(chosen, pendingMode)
      setPendingMode(null)
    }
  }

  const initialChoice =
    provider || PLATFORM_DEFAULT[detectPlatform()] || 'google'

  return (
    <div className="px-5 py-4 flex flex-col gap-2">
      <button
        type="button"
        onClick={() => {
          start('drive')
        }
        }
        className="min-h-[44px] w-full rounded-lg bg-brand px-4 text-sm font-semibold text-white hover:bg-brand/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-1 cursor-pointer"
      >
        Navigate to bay
      </button>       

      {validDest ? (
        <button
          type="button"
          onClick={() => start('walk')}
          className="min-h-[44px] w-full rounded-lg border border-brand bg-transparent px-4 text-sm font-semibold text-brand hover:bg-brand-50 dark:border-brand-300 dark:text-brand-100 dark:hover:bg-brand-900/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-1 cursor-pointer"
        >
          Walk to destination
        </button>
      ) : (
        <p className="text-[13px] text-gray-500 dark:text-gray-400">
          Set a destination to enable walking directions.
        </p>
      )}

      {notice && (
        <div
          role="status"
          className="mt-1 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700 dark:border-amber-800/50 dark:bg-amber-900/20 dark:text-amber-200 flex items-start gap-2"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden
            className="mt-0.5 shrink-0"
          >
            <path
              d="M12 9v4m0 3.5v.01M10.3 3.86l-7.7 13.34A1.5 1.5 0 0 0 3.9 19.5h16.2a1.5 1.5 0 0 0 1.3-2.3L13.7 3.86a1.5 1.5 0 0 0-2.6 0z"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span>{notice.message}</span>
        </div>
      )}

      <MapsProviderChooser
        open={chooserOpen}
        initialProvider={initialChoice}
        onConfirm={handleConfirm}
        onClose={() => {
          setChooserOpen(false)
          setPendingMode(null)
        }}
      />
    </div>
  )
}
