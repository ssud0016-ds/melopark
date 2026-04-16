import { useMemo, useRef, useEffect, useCallback } from 'react'
import { FixedSizeList } from 'react-window'
import BayCard from './BayCard'
import { metersBetweenBayAndDestination } from '../../utils/mapGeo'

const ROW_HEIGHT = 96

export default function BayList({ visibleBays, selectedBayId, destination, onSelect, height }) {
  const listRef = useRef(null)

  const sorted = useMemo(() => {
    const withDist = visibleBays.map((b) => ({
      ...b,
      _dist: destination ? metersBetweenBayAndDestination(b, destination) : Infinity,
    }))

    return withDist.sort((a, b) => {
      if (a.hasRules && !b.hasRules) return -1
      if (!a.hasRules && b.hasRules) return 1
      if (a.type === 'available' && b.type !== 'available') return -1
      if (a.type !== 'available' && b.type === 'available') return 1
      if (destination) return a._dist - b._dist
      return 0
    })
  }, [visibleBays, destination])

  const rulesCount = useMemo(() => sorted.filter((b) => b.hasRules).length, [sorted])

  useEffect(() => {
    if (!selectedBayId || !listRef.current) return
    const idx = sorted.findIndex((b) => b.id === selectedBayId)
    if (idx >= 0) {
      listRef.current.scrollToItem(idx, 'smart')
    }
  }, [selectedBayId, sorted])

  if (!sorted.length) {
    return (
      <div className="text-center py-8 px-4 text-gray-400 dark:text-gray-500">
        <div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-lg font-bold text-gray-400 dark:text-gray-500 mx-auto mb-2.5">P</div>
        <div className="font-semibold mb-1 text-gray-500 dark:text-gray-400">No bays match</div>
        <div className="text-sm">Try a different filter or widen your search</div>
      </div>
    )
  }

  const listHeight = Math.max(200, (height || 400) - 28)

  const Row = useCallback(({ index, style }) => {
    const bay = sorted[index]
    if (!bay) return null
    return (
      <div style={style} className="px-3">
        <BayCard
          bay={bay}
          selected={bay.id === selectedBayId}
          destination={destination}
          onSelect={onSelect}
        />
      </div>
    )
  }, [sorted, selectedBayId, destination, onSelect])

  return (
    <div role="listbox" aria-label="Parking bays">
      {rulesCount > 0 && (
        <div className="text-[11px] font-semibold text-[#35338c] dark:text-[#a3a1e6] mb-2 px-4 pt-1">
          {rulesCount} bay{rulesCount !== 1 ? 's' : ''} with restriction rules shown first
          {destination && ' · sorted by distance'}
        </div>
      )}
      <FixedSizeList
        ref={listRef}
        height={listHeight}
        itemCount={sorted.length}
        itemSize={ROW_HEIGHT}
        width="100%"
        overscanCount={5}
      >
        {Row}
      </FixedSizeList>
    </div>
  )
}
