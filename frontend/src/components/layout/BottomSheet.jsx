import { useRef, useCallback, useEffect, useState } from 'react'
import { cn } from '../../utils/cn'

/**
 * Snap points as fractions of the viewport height (from the bottom).
 * PEEK  – just the header visible (~240px worth)
 * HALF  – comfortably browse ~5-6 bay cards while keeping the map visible
 * FULL  – maximum expansion
 */
const SNAP_PEEK = 0.28
const SNAP_HALF = 0.50
const SNAP_FULL = 0.75

const SNAPS = [SNAP_PEEK, SNAP_HALF, SNAP_FULL]
const VELOCITY_THRESHOLD = 0.4   // px/ms – flick faster than this snaps in drag direction
const MIN_DRAG_PX = 8            // ignore micro-movements

function closestSnap(fraction) {
  let best = SNAPS[0]
  let bestDist = Math.abs(fraction - best)
  for (let i = 1; i < SNAPS.length; i++) {
    const d = Math.abs(fraction - SNAPS[i])
    if (d < bestDist) {
      best = SNAPS[i]
      bestDist = d
    }
  }
  return best
}

function nextSnapInDirection(current, direction) {
  const idx = SNAPS.indexOf(closestSnap(current))
  if (direction > 0 && idx < SNAPS.length - 1) return SNAPS[idx + 1]
  if (direction < 0 && idx > 0) return SNAPS[idx - 1]
  return SNAPS[idx]
}

export default function BottomSheet({ snap, onSnapChange, title, subtitle, children }) {
  const sheetRef = useRef(null)
  const dragState = useRef(null)
  const [dragging, setDragging] = useState(false)
  const [dragOffset, setDragOffset] = useState(0)

  const vh = typeof window !== 'undefined' ? window.innerHeight : 800

  const handlePointerDown = useCallback((e) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return
    dragState.current = {
      startY: e.clientY,
      startSnap: snap,
      startTime: Date.now(),
      moved: false,
    }
    setDragging(true)
    e.currentTarget.setPointerCapture(e.pointerId)
  }, [snap])

  const handlePointerMove = useCallback((e) => {
    const ds = dragState.current
    if (!ds) return
    const dy = e.clientY - ds.startY
    if (!ds.moved && Math.abs(dy) < MIN_DRAG_PX) return
    ds.moved = true
    ds.lastY = e.clientY
    ds.lastTime = Date.now()
    setDragOffset(dy)
  }, [])

  const handlePointerUp = useCallback((e) => {
    const ds = dragState.current
    if (!ds) return
    dragState.current = null
    setDragging(false)
    setDragOffset(0)

    if (!ds.moved) {
      const next = snap === SNAP_FULL ? SNAP_PEEK : SNAPS[SNAPS.indexOf(closestSnap(snap)) + 1] || SNAP_FULL
      onSnapChange(next)
      return
    }

    const dy = e.clientY - ds.startY
    const dt = Math.max(1, Date.now() - ds.startTime)
    const velocity = dy / dt

    const currentFraction = ds.startSnap - dy / vh

    if (Math.abs(velocity) > VELOCITY_THRESHOLD) {
      const direction = velocity < 0 ? 1 : -1
      onSnapChange(nextSnapInDirection(currentFraction, direction))
    } else {
      onSnapChange(closestSnap(currentFraction))
    }
  }, [snap, onSnapChange, vh])

  useEffect(() => {
    const onResize = () => {
      // force re-render on resize so vh-based calcs stay correct
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const heightPx = snap * vh
  const translateY = dragging ? Math.max(-dragOffset, 0 - (SNAP_FULL * vh - heightPx)) : 0
  const visualHeight = Math.min(SNAP_FULL * vh, Math.max(120, heightPx + (dragging ? -dragOffset : 0)))

  const isExpanded = snap === SNAP_FULL

  return (
    <div
      ref={sheetRef}
      className={cn(
        'absolute bottom-0 inset-x-0 z-[550] bg-white dark:bg-surface-dark',
        'rounded-t-[20px] shadow-sheet flex flex-col',
        !dragging && 'transition-[height] duration-400 ease-[cubic-bezier(0.32,0.72,0,1)]',
      )}
      style={{ height: visualHeight }}
    >
      {/* Drag handle – real interactive zone */}
      <div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className="touch-none select-none cursor-grab active:cursor-grabbing shrink-0"
      >
        <div className="w-9 h-1 bg-gray-200 dark:bg-gray-600 rounded-full mx-auto mt-3" />

        {/* Header */}
        <div
          className="flex items-center justify-between px-5 pt-3 pb-3.5 w-full text-left"
        >
          <div>
            <div className="text-base font-bold text-gray-900 dark:text-white">{title}</div>
            {subtitle && (
              <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{subtitle}</div>
            )}
          </div>
          <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-sm">
            {isExpanded ? '↓' : '↑'}
          </div>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto overscroll-contain webkit-overflow-touch min-h-0">
        {children}
      </div>
    </div>
  )
}

export { SNAP_PEEK, SNAP_HALF, SNAP_FULL }
