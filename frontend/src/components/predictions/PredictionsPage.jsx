/**
 * PredictionsPage.jsx — Epic 6 Predictive Parking Intelligence
 *
 * Features:
 *  - Text search with autocomplete (finds nearest zone)
 *  - Animated pressure timeline (colour-coded hour segments)
 *  - Staggered card entrance animations
 *  - "Open in Map" on every zone → flies map to location
 *  - Events open Google Maps in new tab with directions
 *  - Collapsible All Zones behind a toggle button
 *  - No alternatives within radius → nearest available shown
 *  - HD clear layout, slate-50 background, full-width on large screens
 */

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'

// ─── SVG icons ─────────────────────────────────────────────────────────────────
const I = {
  Search:   <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" className="w-4 h-4"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.35-4.35"/></svg>,
  Pin:      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" className="w-4 h-4"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/><circle cx="12" cy="9" r="2.5"/></svg>,
  Map:      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" className="w-3.5 h-3.5"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/></svg>,
  Car:      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" className="w-4 h-4"><path d="M5 17H3v-5l2-5h14l2 5v5h-2"/><circle cx="7.5" cy="17" r="1.5"/><circle cx="16.5" cy="17" r="1.5"/><path d="M5 12h14"/></svg>,
  Walk:     <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" className="w-3.5 h-3.5"><circle cx="13" cy="4" r="1.5"/><path d="M9 20l1-4 3 2 2-8"/><path d="M6.5 13.5L9 12l3.5 2"/><path d="M15 20l-1-4"/></svg>,
  Check:    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" className="w-4 h-4"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>,
  Alert:    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" className="w-4 h-4"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
  Calendar: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" className="w-3.5 h-3.5"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
  External: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" className="w-3 h-3"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>,
  Refresh:  (spin) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" className={`w-4 h-4 ${spin ? 'animate-spin' : ''}`}><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>,
  ChevDown: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="w-4 h-4"><polyline points="6 9 12 15 18 9"/></svg>,
  ChevUp:   <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="w-4 h-4"><polyline points="18 15 12 9 6 15"/></svg>,
  Grid:     <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="w-4 h-4"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>,
  Close:    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="w-4 h-4"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  Right:    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="w-4 h-4"><polyline points="9 18 15 12 9 6"/></svg>,
  Star:     <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" className="w-4 h-4"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>,
}

// ─── Interactive Forecast Line Chart ──────────────────────────────────────────
const CHART_COLOURS = ['#6366f1','#f97316','#10b981','#3b82f6','#8b5cf6','#f59e0b']

function catmullRomToBezier(pts) {
  if (pts.length < 2) return ''
  let d = `M ${pts[0].x} ${pts[0].y}`
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i-1)], p1 = pts[i], p2 = pts[i+1], p3 = pts[Math.min(pts.length-1, i+2)]
    const cp1x = p1.x + (p2.x - p0.x) / 6, cp1y = p1.y + (p2.y - p0.y) / 6
    const cp2x = p2.x - (p3.x - p1.x) / 6, cp2y = p2.y - (p3.y - p1.y) / 6
    d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`
  }
  return d
}

function ForecastLineChart({ lines, selectedHour, onHourClick, hlabels, onLineSelect }) {
  const [hoverHour, setHoverHour]   = useState(null)
  const [hoverLine, setHoverLine]   = useState(null)   // mouse-over line idx
  const [activeLine, setActiveLine] = useState(null)   // clicked/pinned line idx
  const [tooltipPos, setTooltipPos] = useState({ x:0, y:0 })
  const svgRef = useRef(null)

  const W=100, H=80, PX=7, PY=8

  const { allVals, minV, maxV } = useMemo(() => {
    const vals = lines.flatMap(l => l.pts.filter(p => p !== null))
    if (!vals.length) return { allVals:[], minV:0, maxV:1 }
    return { allVals:vals, minV:Math.max(0,Math.min(...vals)-0.06), maxV:Math.min(1,Math.max(...vals)+0.04) }
  }, [lines])

  const scaleY = useCallback(v => PY + (1-(v-minV)/(maxV-minV))*(H-PY-8), [minV,maxV])
  const scaleX = useCallback(i => PX + (i/(hlabels.length-1))*(W-PX*2), [hlabels.length])

  const activeHour = hoverHour !== null ? hoverHour : selectedHour
  const highlighted = activeLine !== null ? activeLine : hoverLine

  const handleMouseMove = useCallback((e) => {
    const svg = svgRef.current; if (!svg) return
    const rect = svg.getBoundingClientRect()
    const relX = ((e.clientX-rect.left)/rect.width)*W
    const relY = ((e.clientY-rect.top)/rect.height)*H
    // Snap hour
    const closestH = hlabels.map((_,i)=>i).reduce((best,i)=>
      Math.abs(scaleX(i)-relX)<Math.abs(scaleX(best)-relX)?i:best, 0)
    setHoverHour(closestH)
    setTooltipPos({ x:e.clientX-rect.left, y:e.clientY-rect.top })
    // Detect nearest line (threshold 6 SVG units)
    let nearestIdx=null, nearestDist=6
    lines.forEach((l,i) => {
      const v = l.pts[closestH]
      if (v==null) return
      const d = Math.abs(scaleY(v)-relY)
      if (d<nearestDist) { nearestDist=d; nearestIdx=i }
    })
    setHoverLine(nearestIdx)
  }, [hlabels, lines, scaleX, scaleY])

  const handleLineClick = (li) => {
    const next = activeLine===li ? null : li
    setActiveLine(next)
    if (next!==null) onLineSelect?.(lines[next].fullLabel||lines[next].label)
  }

  if (!allVals.length) return null

  return (
    <div className="rounded-xl overflow-hidden" style={{backgroundColor:'#ffffff',border:'1px solid #e2e8f0'}}>
      <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} className="w-full cursor-crosshair"
        style={{height:160,display:'block'}} preserveAspectRatio="none"
        onMouseMove={handleMouseMove}
        onMouseLeave={()=>{setHoverHour(null);setHoverLine(null)}}
        onClick={()=>hoverHour!==null&&onHourClick?.(hoverHour)}>
        <rect width={W} height={H} fill="#ffffff"/>
        <defs>
          {lines.map((l,i)=>(
            <linearGradient key={i} id={`fcgrad${i}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={l.colour} stopOpacity="0.18"/>
              <stop offset="100%" stopColor={l.colour} stopOpacity="0.02"/>
            </linearGradient>
          ))}
        </defs>
        {/* Grid */}
        {[0.25,0.5,0.75].map(v=>{
          const yv=minV+v*(maxV-minV); if(yv>1||yv<0) return null
          return <g key={v}>
            <line x1={PX} y1={scaleY(yv)} x2={W-PX} y2={scaleY(yv)} stroke="#f1f5f9" strokeWidth="0.5"/>
            <text x={PX-0.8} y={scaleY(yv)+1} fontSize="2.8" fill="#94a3b8" textAnchor="end">{Math.round(yv*100)}%</text>
          </g>
        })}
        {/* Area fills */}
        {lines.map((l,li)=>{
          const pts=l.pts.map((v,i)=>v!=null?{x:scaleX(i),y:scaleY(v)}:null).filter(Boolean)
          if(pts.length<2) return null
          const isHL=highlighted===li, isDim=highlighted!==null&&!isHL
          const ab=`${catmullRomToBezier(pts)} L ${pts[pts.length-1].x} ${H-8} L ${pts[0].x} ${H-8} Z`
          return <path key={li} d={ab} fill={`url(#fcgrad${li})`} opacity={isDim?0.1:1}/>
        })}
        {/* Lines — clickable */}
        {lines.map((l,li)=>{
          const pts=l.pts.map((v,i)=>v!=null?{x:scaleX(i),y:scaleY(v)}:null).filter(Boolean)
          if(pts.length<2) return null
          const isHL=highlighted===li, isDim=highlighted!==null&&!isHL
          return <g key={li} style={{cursor:'pointer'}} onClick={(e)=>{e.stopPropagation();handleLineClick(li)}}>
            {/* Wider invisible hit area */}
            <path d={catmullRomToBezier(pts)} fill="none" stroke="transparent" strokeWidth="6"/>
            <path d={catmullRomToBezier(pts)} fill="none" stroke={l.colour}
              strokeWidth={isHL?3:isDim?1:1.8}
              strokeLinejoin="round" strokeLinecap="round"
              opacity={isDim?0.18:isHL?1:0.85}
              style={{transition:'all 0.2s ease'}}/>
          </g>
        })}
        {/* Vertical crosshair */}
        <line x1={scaleX(activeHour)} y1={PY-2} x2={scaleX(activeHour)} y2={H-8}
          stroke="#3b82f6" strokeWidth="0.5" strokeDasharray="2 1.5" opacity="0.5"/>
        {/* Dots at active hour */}
        {lines.map((l,li)=>{
          const v=l.pts[activeHour]; if(v==null) return null
          const isHL=highlighted===li, isDim=highlighted!==null&&!isHL
          return <circle key={li} cx={scaleX(activeHour)} cy={scaleY(v)} r={isHL?3:2}
            fill={l.colour} stroke="white" strokeWidth="0.8"
            opacity={isDim?0.2:1}
            style={{transition:'all 0.2s ease'}}/>
        })}
        {/* X labels */}
        {hlabels.map((lbl,i)=>(
          <text key={i} x={scaleX(i)} y={H-1} fontSize="2.8" textAnchor="middle"
            fill={i===activeHour?'#3b82f6':'#94a3b8'}
            fontWeight={i===activeHour?'700':'400'}>{lbl}</text>
        ))}
      </svg>

      {/* Tooltip */}
      {hoverHour !== null && (
        <div className="absolute pointer-events-none z-30 rounded-xl shadow-2xl px-3 py-2.5 min-w-[180px]"
          style={{
            left: tooltipPos.x>250 ? tooltipPos.x-190 : tooltipPos.x+14,
            top: Math.max(4, tooltipPos.y-90),
            backgroundColor:'#1e293b', border:'1px solid rgba(255,255,255,0.1)',
          }}>
          <p className="font-bold mb-1.5 text-[11px] pb-1.5" style={{color:'#93c5fd',borderBottom:'1px solid rgba(255,255,255,0.08)'}}>
            {hlabels[hoverHour]}
          </p>
          {lines.map((l,i)=>{
            const isHL = highlighted===i
            return (
              <div key={i} className="flex items-center gap-2 py-0.5"
                style={{opacity: highlighted!==null&&!isHL ? 0.4 : 1, transition:'opacity 0.2s'}}>
                <span className="rounded-full shrink-0"
                  style={{width:isHL?10:8,height:isHL?10:8,backgroundColor:l.colour,transition:'all 0.2s'}}/>
                <span className="flex-1 truncate text-[10px] max-w-[110px]"
                  style={{color:isHL?'#f1f5f9':'#94a3b8',fontWeight:isHL?700:400}}>{l.label}</span>
                <span className="font-black tabular-nums text-[10px]" style={{color:l.colour}}>
                  {l.pts[hoverHour]!=null?`${Math.round(l.pts[hoverHour]*100)}%`:'—'}
                </span>
              </div>
            )
          })}
          <p className="text-[9px] mt-1.5 pt-1" style={{color:'#475569',borderTop:'1px solid rgba(255,255,255,0.06)'}}>
            Click a line to highlight it
          </p>
        </div>
      )}

      {/* Legend — clickable to highlight */}
      <div className="flex flex-wrap gap-x-3 gap-y-1.5 px-3 py-2.5 border-t"
        style={{backgroundColor:'#f8fafc', borderColor:'#e2e8f0'}}>
        {lines.map((l,i)=>{
          const isHL=activeLine===i, isDim=activeLine!==null&&!isHL
          return (
            <button key={i} onClick={()=>handleLineClick(i)}
              className="flex items-center gap-1.5 rounded-md px-1.5 py-0.5 transition-all"
              style={{opacity:isDim?0.35:1, backgroundColor:isHL?`${l.colour}18`:'transparent',
                border:`1px solid ${isHL?l.colour:'transparent'}`}}>
              <span className="rounded-full inline-block" style={{width:isHL?14:10,height:3,backgroundColor:l.colour,transition:'all 0.2s'}}/>
              <span className="text-[10px] font-medium truncate max-w-[120px]"
                style={{color:isHL?l.colour:'#64748b'}}>{l.label}</span>
            </button>
          )
        })}
        {activeLine!==null && (
          <button onClick={()=>setActiveLine(null)}
            className="text-[10px] text-gray-400 hover:text-gray-600 underline ml-auto transition-colors">
            Clear
          </button>
        )}
      </div>
    </div>
  )
}


// ─── Level config ──────────────────────────────────────────────────────────────
const L = {
  low:      { label:'Low',       c:'#22c55e', bg:'#f0fdf4', br:'#bbf7d0', t:'#15803d', bar:'bg-green-400'  },
  moderate: { label:'Moderate',  c:'#f59e0b', bg:'#fffbeb', br:'#fde68a', t:'#b45309', bar:'bg-amber-400'  },
  high:     { label:'High',      c:'#f97316', bg:'#fff7ed', br:'#fed7aa', t:'#c2410c', bar:'bg-orange-500' },
  critical: { label:'Very busy', c:'#ef4444', bg:'#fef2f2', br:'#fecaca', t:'#b91c1c', bar:'bg-red-500'    },
}
const LO = { low:0, moderate:1, high:2, critical:3 }
const HRS = [0,1,2,3,4,5,6]
const HLABELS = ['Now','+1h','+2h','+3h','+4h','+5h','+6h']

// ─── Haversine (for nearest zone search) ──────────────────────────────────────
function haversineM(a, b) {
  const R = 6371000, p1 = a[0]*Math.PI/180, p2 = b[0]*Math.PI/180
  const dp = (b[0]-a[0])*Math.PI/180, dl = (b[1]-a[1])*Math.PI/180
  const x = Math.sin(dp/2)**2 + Math.cos(p1)*Math.cos(p2)*Math.sin(dl/2)**2
  return R*2*Math.atan2(Math.sqrt(x), Math.sqrt(1-x))
}

// ─── API ───────────────────────────────────────────────────────────────────────
async function apiFetch(path) {
  const base = (import.meta.env.VITE_API_URL||'').replace(/\/$/,'')
  const r = await fetch(`${base}${path}`)
  if (!r.ok) throw new Error(`HTTP ${r.status}`)
  return r.json()
}

// ─── Pressure Timeline ─────────────────────────────────────────────────────────
function PressureTimeline({ data, selectedHour, onSelect }) {
  if (!data?.length) return null
  return (
    <div className="space-y-3">
      <div className="flex gap-1.5">
        {data.map((d,i) => {
          const cfg = L[d.level] || L.low
          const isSel = i === selectedHour
          const isNow = i === 0
          return (
            <button key={i} onClick={() => onSelect(i)}
              className="flex-1 flex flex-col items-center gap-1.5 group"
              title={`${HLABELS[i]} · ${Math.round(d.occ*100)}%`}>
              <div className={`w-full rounded-lg transition-all duration-300 relative overflow-hidden ${isSel ? 'ring-2 ring-offset-1' : ''}`}
                style={{
                  height: isSel ? 48 : 36,
                  backgroundColor: cfg.c,
                  opacity: isSel ? 1 : isNow ? 0.75 : 0.45,
                  ringColor: cfg.c,
                }}>
                {isSel && (
                  <div className="absolute inset-x-0 top-0 flex items-center justify-center h-full">
                    <span className="text-[11px] font-black text-white drop-shadow">
                      {Math.round(d.occ*100)}%
                    </span>
                  </div>
                )}
                {isNow && !isSel && (
                  <div className="absolute top-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-white/80 animate-pulse" />
                )}
              </div>
              <span className={`text-[10px] font-semibold leading-none transition-colors ${isSel ? 'text-gray-900 dark:text-white' : 'text-gray-400'}`}>
                {HLABELS[i]}
              </span>
            </button>
          )
        })}
      </div>
      <div className="flex items-center gap-3 text-[10px] text-gray-400 pt-1 border-t border-gray-100 dark:border-gray-800">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-2 rounded-sm bg-blue-500 inline-block" />Current hour
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-2 rounded-sm bg-gray-200 inline-block" />Forecast
        </span>
        <span className="ml-auto">Tap segment to inspect that hour</span>
      </div>
    </div>
  )
}

// ─── Zone detail 6h mini-chart ─────────────────────────────────────────────────
function ZoneTimeline({ data, selectedHour, onSelect }) {
  if (!data?.length) return null
  const max = Math.max(...data.map(d=>d.occ), 0.01)
  return (
    <div className="flex gap-1.5 items-end" style={{height:40}}>
      {data.map((d,i) => {
        const cfg = L[d.level]||L.low
        const h = 8 + (d.occ/max)*32
        return (
          <button key={i} onClick={()=>onSelect(i)}
            className="flex-1 rounded-t-sm transition-all duration-300 relative"
            style={{ height:h, backgroundColor: cfg.c, opacity: i===selectedHour?1:0.45 }}
            title={`${HLABELS[i]}: ${Math.round(d.occ*100)}%`} />
        )
      })}
    </div>
  )
}

// ─── OccBar ───────────────────────────────────────────────────────────────────
function OccBar({ pct, level, animate = false }) {
  const cfg = L[level]||L.low
  return (
    <div className="flex items-center gap-2 min-w-0">
      <div className="h-1.5 flex-1 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
        <div className={`h-full rounded-full ${animate ? 'transition-all duration-700' : 'transition-all duration-300'}`}
          style={{ width:`${Math.round(pct*100)}%`, backgroundColor:cfg.c }} />
      </div>
      <span className="text-xs font-bold tabular-nums shrink-0" style={{color:cfg.c}}>
        {Math.round(pct*100)}%
      </span>
    </div>
  )
}

// ─── Badge ────────────────────────────────────────────────────────────────────
function Badge({ level }) {
  const cfg = L[level]||L.low
  return (
    <span className="inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-semibold border shrink-0"
      style={{backgroundColor:cfg.bg, borderColor:cfg.br, color:cfg.t}}>
      {cfg.label}
    </span>
  )
}

// ─── Card ──────────────────────────────────────────────────────────────────────
function Card({ children, className='', delay=0 }) {
  const [vis, setVis] = useState(false)
  useEffect(() => { const t = setTimeout(()=>setVis(true), delay); return ()=>clearTimeout(t) }, [delay])
  return (
    <div className={`bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-5 transition-all duration-500 ${vis?'opacity-100 translate-y-0':'opacity-0 translate-y-3'} ${className}`}>
      {children}
    </div>
  )
}

// ─── Open Google Maps in new tab ───────────────────────────────────────────────
function openGoogleMaps(lat, lon, label='') {
  const q = label ? encodeURIComponent(label) : `${lat},${lon}`
  window.open(`https://www.google.com/maps/search/${q}/@${lat},${lon},17z`, '_blank', 'noopener')
}
function openDirections(lat, lon) {
  window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}&travelmode=driving`, '_blank', 'noopener')
}

// ─── Map button ───────────────────────────────────────────────────────────────
function MapBtn({ lat, lon, label, onNavigateToMap, small=false }) {
  if (!lat || !lon) return null
  return (
    <button onClick={() => onNavigateToMap(lat, lon, label)}
      className={`flex items-center gap-1 font-semibold rounded-lg border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors shrink-0 ${small ? 'px-2 py-1 text-[10px]' : 'px-2.5 py-1.5 text-xs'}`}
      title="View on Live Map">
      {I.Map}
      <span>Map</span>
    </button>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function Skel({ rows=5 }) {
  return (
    <div className="space-y-3">
      {[...Array(rows)].map((_,i) => (
        <div key={i} className="flex items-center gap-3">
          <div className="w-4 h-3 rounded bg-gray-100 animate-pulse" />
          <div className="h-3 rounded bg-gray-100 animate-pulse flex-1" style={{maxWidth:`${55+i*9}%`}} />
          <div className="w-10 h-3 rounded bg-gray-100 animate-pulse" />
        </div>
      ))}
    </div>
  )
}

// ─── Main ──────────────────────────────────────────────────────────────────────
export default function PredictionsPage({ onNavigateToMap = () => {} }) {
  const [warnings, setWarnings]         = useState([])
  const [loading, setLoading]           = useState(true)
  const [error, setError]               = useState(null)
  const [lastFetched, setLastFetched]   = useState(null)

  // Search
  const [query, setQuery]               = useState('')
  const [showDropdown, setShowDropdown] = useState(false)
  const [destination, setDestination]   = useState(null) // full zone object
  const [arrivalTime, setArrivalTime]   = useState('')
  const searchRef                       = useRef(null)

  // Alternatives
  const [alternatives, setAlternatives] = useState(null)
  const [altLoading, setAltLoading]     = useState(false)

  // UI state
  const [selectedHour, setSelectedHour] = useState(0)
  const [selectedZone, setSelectedZone] = useState(null)
  const [zonesOpen, setZonesOpen]       = useState(false)
  const [zonesHour, setZonesHour]       = useState(0)

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchWarnings = useCallback(async () => {
    try {
      setLoading(true)
      const d = await apiFetch('/api/forecasts/warnings?hours=6')
      setWarnings(d.warnings||[])
      setLastFetched(new Date())
      setError(null)
    } catch { setError('Could not load forecast data.') }
    finally  { setLoading(false) }
  }, [])

  useEffect(() => {
    fetchWarnings()
    const id = setInterval(fetchWarnings, 5*60*1000)
    return () => clearInterval(id)
  }, [fetchWarnings])

  // Close dropdown on outside click
  useEffect(() => {
    const fn = e => { if (searchRef.current && !searchRef.current.contains(e.target)) setShowDropdown(false) }
    document.addEventListener('mousedown', fn)
    return () => document.removeEventListener('mousedown', fn)
  }, [])

  // ── Derived ────────────────────────────────────────────────────────────────
  const currentZones = useMemo(() => {
    const m = {}
    for (const w of warnings) {
      if (w.hours_from_now !== 0) continue
      const p = m[w.zone]
      if (!p || LO[w.warning_level] > LO[p.warning_level]) m[w.zone] = w
    }
    return Object.values(m)
  }, [warnings])

  const topFree  = useMemo(() => [...currentZones].sort((a,b)=>a.predicted_occupancy-b.predicted_occupancy).slice(0,6), [currentZones])
  const busiest  = useMemo(() => [...currentZones].sort((a,b)=>b.predicted_occupancy-a.predicted_occupancy).slice(0,5), [currentZones])

  const activeEvts = useMemo(() => {
    const seen = new Set(), out = []
    for (const w of warnings) {
      if (w.hours_from_now>2 || !w.events_nearby || w.events_nearby==='None') continue
      if (!seen.has(w.events_nearby)) { seen.add(w.events_nearby); out.push(w) }
    }
    return out
  }, [warnings])

  const cbdChart = useMemo(() => HRS.map(h => {
    const sl = warnings.filter(w=>w.hours_from_now===h)
    if (!sl.length) return {h, occ:0.6, level:'moderate'}
    const avg = sl.reduce((s,w)=>s+w.predicted_occupancy,0)/sl.length
    const lv  = sl.reduce((b,w)=>LO[w.warning_level]>LO[b]?w.warning_level:b,'low')
    return {h, occ:avg, level:lv}
  }), [warnings])

  const zoneChart = useMemo(() => {
    if (!selectedZone) return []
    return HRS.map(h => {
      const w = warnings.find(x=>x.zone===selectedZone.zone&&x.hours_from_now===h)
      return {h, occ:w?.predicted_occupancy??0, level:w?.warning_level??'low', event:w?.events_nearby!=='None'?w?.events_nearby:null}
    })
  }, [selectedZone, warnings])

  const worstLevel = useMemo(() =>
    currentZones.reduce((b,w)=>LO[w.warning_level]>LO[b]?w.warning_level:b,'low')
  ,[currentZones])

  // ── Search autocomplete ────────────────────────────────────────────────────
  const searchResults = useMemo(() => {
    if (!query.trim()) return []
    const q = query.toLowerCase()
    return currentZones
      .filter(z => z.zone.toLowerCase().includes(q))
      .sort((a,b) => {
        const ai = a.zone.toLowerCase().indexOf(q)
        const bi = b.zone.toLowerCase().indexOf(q)
        return ai - bi
      })
      .slice(0, 8)
  }, [query, currentZones])

  const handleSelectZone = useCallback(zone => {
    setDestination(zone)
    setSelectedZone(zone)
    setQuery(zone.zone)
    setShowDropdown(false)
  }, [])

  // ── Fetch alternatives ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!destination?.zone_lat) { setAlternatives(null); return }
    let cancelled = false
    setAltLoading(true)
    const atParam = arrivalTime ? `&at=${encodeURIComponent(arrivalTime)}` : ''
    apiFetch(`/api/forecasts/alternatives?lat=${destination.zone_lat}&lon=${destination.zone_lon}${atParam}`)
      .then(d => { if (!cancelled) setAlternatives(d) })
      .catch(() => { if (!cancelled) setAlternatives(null) })
      .finally(() => { if (!cancelled) setAltLoading(false) })
    return () => { cancelled = true }
  }, [destination, arrivalTime])

  // ── Nearest available when no alternatives found ───────────────────────────
  const nearestFallback = useMemo(() => {
    if (!destination?.zone_lat || !alternatives) return null
    if (alternatives.alternatives?.length) return null
    // Find nearest zone with lower occupancy than critical
    const sorted = currentZones
      .filter(z => z.zone !== destination.zone && LO[z.warning_level] < LO['critical'])
      .map(z => ({
        ...z,
        dist: haversineM([destination.zone_lat, destination.zone_lon], [z.zone_lat, z.zone_lon])
      }))
      .sort((a,b) => a.dist - b.dist)
    return sorted[0] || null
  }, [destination, alternatives, currentZones])

  // ── All zones table ────────────────────────────────────────────────────────
  const zonesAtHour = useMemo(() =>
    warnings.filter(w=>w.hours_from_now===zonesHour).sort((a,b)=>b.predicted_occupancy-a.predicted_occupancy)
  , [warnings, zonesHour])

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen" style={{backgroundColor:'#f1f5f9'}}>

      {/* ── Hero search bar ── */}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
          <div className="mb-4">
            <h1 className="text-xl font-bold text-gray-900 dark:text-white tracking-tight">
              Parking Predictions
            </h1>
            <p className="text-sm text-gray-400 mt-0.5">
              Melbourne CBD · 6-hour forecast · SCATS traffic data
            </p>
          </div>

          {/* Search */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1" ref={searchRef}>
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">{I.Search}</span>
              <input
                value={query}
                onChange={e => { setQuery(e.target.value); setShowDropdown(true) }}
                onFocus={() => { if (query) setShowDropdown(true) }}
                placeholder="Search area or street name…"
                className="w-full pl-10 pr-10 py-3 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
              />
              {query && (
                <button onClick={() => { setQuery(''); setDestination(null); setAlternatives(null); setSelectedZone(null) }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors">
                  {I.Close}
                </button>
              )}
              {/* Dropdown */}
              {showDropdown && searchResults.length > 0 && (
                <div className="absolute left-0 right-0 top-full mt-1 bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-lg z-50 overflow-hidden">
                  {searchResults.map((z,i) => {
                    const cfg = L[z.warning_level]||L.low
                    return (
                      <button key={i} onClick={() => handleSelectZone(z)}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors border-b border-gray-50 dark:border-gray-700 last:border-0">
                        <span className="text-gray-400 shrink-0">{I.Pin}</span>
                        <span className="flex-1 text-sm text-gray-800 dark:text-gray-200 truncate">{z.zone}</span>
                        <span className="text-xs font-bold tabular-nums shrink-0" style={{color:cfg.c}}>
                          {Math.round(z.predicted_occupancy*100)}%
                        </span>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
            <div className="relative sm:w-52">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">{I.Calendar}</span>
              <input type="datetime-local" value={arrivalTime} onChange={e=>setArrivalTime(e.target.value)}
                className="w-full pl-10 pr-3 py-3 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm" />
            </div>
            <button onClick={fetchWarnings} disabled={loading}
              className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-50 transition-colors shadow-sm disabled:opacity-40 shrink-0">
              {I.Refresh(loading)}
              {lastFetched ? lastFetched.toLocaleTimeString('en-AU',{hour:'2-digit',minute:'2-digit'}) : 'Refresh'}
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="max-w-5xl mx-auto px-4 sm:px-6 mt-4 flex items-center gap-2 p-3.5 rounded-xl bg-red-50 border border-red-100 text-sm text-red-700">
          {I.Alert}{error}
        </div>
      )}

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-4">

        {/* ── Row 1: Forecast timeline + events ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
          <Card className="lg:col-span-2" delay={0}>
            <div className="flex items-start justify-between mb-5">
              <div>
                <h2 className="text-sm font-bold text-gray-900 dark:text-white">CBD Demand — Next 6 Hours</h2>
                <p className="text-[11px] text-gray-400 mt-0.5">Average predicted occupancy across all zones</p>
              </div>
              <Badge level={worstLevel} />
            </div>
            {loading ? (
              <div className="h-24 flex items-center justify-center">
                <div className="w-5 h-5 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
              </div>
            ) : (
              <>
                <PressureTimeline data={cbdChart} selectedHour={selectedHour} onSelect={setSelectedHour} />

                {/* Multi-line forecast chart — hover to inspect */}
                <div className="relative">
                {(() => {
                  const topZones = warnings
                    .filter(w => w.hours_from_now === 0)
                    .sort((a,b) => b.predicted_occupancy - a.predicted_occupancy)
                    .slice(0, 6)

                  const chartLines = topZones.map((z, i) => ({
                    label: z.zone.length > 28 ? z.zone.slice(0, 28) + '…' : z.zone,
                    fullLabel: z.zone,
                    colour: CHART_COLOURS[i % CHART_COLOURS.length],
                    pts: HRS.map(h => {
                      const w = warnings.find(x => x.zone === z.zone && x.hours_from_now === h)
                      return w?.predicted_occupancy ?? null
                    })
                  })).filter(l => l.pts.some(p => p !== null))

                  if (!chartLines.length) return null
                  return (
                    <div className="mt-5 pt-4 border-t border-gray-50 dark:border-gray-800">
                      <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-3">
                        Forecast trend — top zones
                      </p>
                      <ForecastLineChart
                        lines={chartLines}
                        selectedHour={selectedHour}
                        onHourClick={setSelectedHour}
                        hlabels={HLABELS}
                        onLineSelect={(label)=>{
                          const z=warnings.find(w=>w.zone===label&&w.hours_from_now===0)
                          if(z) handleSelectZone(z)
                        }}
                      />

                    </div>
                  )
                })()}
                </div>
              </>
            )}
          </Card>

          <Card delay={80}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold text-gray-900 dark:text-white">Active Events</h2>
              <span className="text-[10px] text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-full">{activeEvts.length}</span>
            </div>
            {loading ? <Skel rows={3} /> : !activeEvts.length ? (
              <div className="flex flex-col items-center py-6 gap-2 text-gray-300">
                {I.Check}<span className="text-xs text-gray-400">No events detected</span>
              </div>
            ) : (
              <div className="space-y-1.5">
                {activeEvts.slice(0,5).map((w,i) => (
                  <div key={i} className="flex items-start gap-2.5 p-2.5 rounded-xl bg-amber-50 dark:bg-amber-900/15 border border-amber-100 dark:border-amber-800/40 group">
                    <span className="text-amber-500 mt-0.5 shrink-0">{I.Calendar}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-gray-800 dark:text-gray-200 truncate leading-snug">{w.events_nearby}</p>
                      <p className="text-[10px] text-gray-400 truncate mt-0.5">{w.zone}</p>
                      <div className="flex items-center gap-2 mt-1.5">
                        <button onClick={() => w.zone_lat && openGoogleMaps(w.zone_lat, w.zone_lon, w.events_nearby)}
                          className="flex items-center gap-1 text-[10px] font-semibold text-amber-700 hover:text-amber-900 transition-colors">
                          {I.External} Directions
                        </button>
                        {w.zone_lat && (
                          <MapBtn lat={w.zone_lat} lon={w.zone_lon} label={w.zone} onNavigateToMap={onNavigateToMap} small />
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* ── Row 2: Selected zone detail ── */}
        {selectedZone && zoneChart.length > 0 && (() => {
          const now = zoneChart[selectedHour]
          const cfg = L[now?.level]||L.low
          return (
            <Card delay={0} className="border-l-4" style={{borderLeftColor: cfg.c}}>
              <div className="flex items-start justify-between gap-3 mb-4">
                <div className="flex items-start gap-2.5">
                  <span className="text-blue-500 mt-0.5 shrink-0">{I.Pin}</span>
                  <div>
                    <h2 className="text-sm font-bold text-gray-900 dark:text-white">{selectedZone.zone}</h2>
                    <p className="text-[11px] text-gray-400 mt-0.5">6-hour demand forecast for this area</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge level={now?.level||'low'} />
                  <MapBtn lat={selectedZone.zone_lat} lon={selectedZone.zone_lon}
                    label={selectedZone.zone} onNavigateToMap={onNavigateToMap} />
                </div>
              </div>

              <ZoneTimeline data={zoneChart} selectedHour={selectedHour} onSelect={setSelectedHour} />

              <div className="mt-4 grid grid-cols-7 gap-1.5">
                {zoneChart.map((d,i) => {
                  const dcfg = L[d.level]||L.low
                  const isSel = i===selectedHour
                  return (
                    <button key={i} onClick={()=>setSelectedHour(i)}
                      className="flex flex-col items-center gap-1 py-2 rounded-xl border transition-all duration-200"
                      style={isSel ? {backgroundColor:dcfg.bg, borderColor:dcfg.br} : {backgroundColor:'transparent', borderColor:'transparent'}}>
                      <span className="text-[9px] font-medium" style={isSel?{color:dcfg.t}:{color:'#9ca3af'}}>{HLABELS[i]}</span>
                      <span className="text-xs font-bold tabular-nums" style={{color:isSel?dcfg.c:'#6b7280'}}>
                        {Math.round(d.occ*100)}%
                      </span>
                      {d.event && <span className="text-amber-400 scale-75">{I.Alert}</span>}
                    </button>
                  )
                })}
              </div>

              {now?.event && (
                <div className="mt-3 flex items-center gap-2 p-2.5 rounded-xl text-xs font-medium border"
                  style={{backgroundColor:'#fffbeb',borderColor:'#fde68a',color:'#b45309'}}>
                  {I.Alert}<span>Event nearby: {now.event}</span>
                  <button onClick={() => selectedZone.zone_lat && openGoogleMaps(selectedZone.zone_lat, selectedZone.zone_lon, now.event)}
                    className="ml-auto flex items-center gap-1 hover:underline">
                    {I.External} View
                  </button>
                </div>
              )}
            </Card>
          )
        })()}

        {/* ── Row 3: Alternatives ── */}
        {destination && (
          <Card delay={100}>
            <h2 className="text-sm font-bold text-gray-900 dark:text-white mb-1">
              Alternatives near {destination.zone}
            </h2>
            <p className="text-[11px] text-gray-400 mb-4">
              Ranked by availability · 70% occupancy + 30% proximity score
            </p>

            {altLoading ? (
              <div className="flex items-center gap-2 text-sm text-gray-400 py-3">
                <div className="w-4 h-4 rounded-full border-2 border-blue-400 border-t-transparent animate-spin" />
                Finding quieter areas…
              </div>
            ) : !alternatives ? null : (() => {
              const alts = alternatives.alternatives||[]
              const tgt  = alternatives.target_zone
              const showNearestFallback = alts.length===0 && nearestFallback

              return (
                <div className="space-y-2">
                  {tgt && (
                    <div className="flex items-center gap-3 p-3.5 rounded-xl border mb-3"
                      style={{backgroundColor:L[tgt.pressure_level]?.bg||'#fff', borderColor:L[tgt.pressure_level]?.br||'#e5e7eb'}}>
                      <div className="w-1.5 h-10 rounded-full shrink-0" style={{backgroundColor:L[tgt.pressure_level]?.c}} />
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-medium text-gray-400 mb-0.5">Your destination</p>
                        <p className="text-sm font-semibold text-gray-900 truncate">{tgt.zone}</p>
                        <div className="mt-1"><OccBar pct={tgt.predicted_occ} level={tgt.pressure_level} /></div>
                      </div>
                      <MapBtn lat={destination.zone_lat} lon={destination.zone_lon}
                        label={destination.zone} onNavigateToMap={onNavigateToMap} />
                    </div>
                  )}

                  {showNearestFallback && (
                    <div className="p-3 rounded-xl bg-blue-50 border border-blue-100 text-xs text-blue-700 mb-2 flex items-center gap-2">
                      {I.Alert}
                      No quieter alternatives within 800m — showing nearest available parking instead.
                    </div>
                  )}

                  {(showNearestFallback ? [nearestFallback] : alts).map((alt,i) => {
                    const cfg = L[alt.pressure_level||alt.warning_level]||L.low
                    const lat = alt.zone_lat, lon = alt.zone_lon
                    const wm = alt.walk_minutes || (alt.dist ? Math.max(1,Math.round(alt.dist*1.4/83.3)) : null)
                    const occ = alt.predicted_occ ?? alt.alt_predicted_occupancy ?? alt.predicted_occupancy ?? 0
                    return (
                      <div key={i} className="flex items-center gap-3 p-3.5 rounded-xl border transition-all hover:shadow-sm"
                        style={{backgroundColor:'white', borderColor:cfg.br}}>
                        <div className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-black text-white shrink-0"
                          style={{backgroundColor:cfg.c}}>{i+1}</div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900 truncate">{alt.zone||alt.alternative_zone||alt.congested_zone||"Parking area"}</p>
                          <div className="flex items-center gap-3 mt-1">
                            <OccBar pct={occ} level={alt.pressure_level||alt.warning_level} />
                            {wm && (
                              <span className="flex items-center gap-1 text-[10px] text-gray-400 shrink-0 whitespace-nowrap">
                                {I.Walk}{wm} min
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-col gap-1.5 shrink-0">
                          {lat && lon && (
                            <>
                              <MapBtn lat={lat} lon={lon} label={alt.zone} onNavigateToMap={onNavigateToMap} small />
                              <button onClick={() => openDirections(lat, lon)}
                                className="flex items-center gap-1 px-2 py-1 text-[10px] font-semibold rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 transition-colors">
                                {I.External} Directions
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    )
                  })}

                  {!alts.length && !nearestFallback && (
                    <div className="flex items-center gap-2.5 p-3.5 rounded-xl bg-gray-50 border border-gray-100">
                      <span className="text-emerald-500 shrink-0">{I.Check}</span>
                      <p className="text-sm text-gray-500">No quieter alternatives found within 800m.</p>
                    </div>
                  )}
                </div>
              )
            })()}
          </Card>
        )}

        {/* ── Row 4: Best / Busiest ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
          <Card delay={120}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-bold text-gray-900 dark:text-white">Best Availability Now</h2>
                <p className="text-[11px] text-gray-400 mt-0.5">Lowest predicted occupancy</p>
              </div>
              <div className="flex items-center gap-1.5 text-[10px] text-gray-400">
                <span className="w-2 h-2 rounded-full bg-green-400 inline-block" />Low
                <span className="w-2 h-2 rounded-full bg-amber-400 inline-block ml-1" />Moderate
              </div>
            </div>
            {loading ? <Skel /> : !topFree.length ? <p className="text-sm text-gray-400">No data</p> : (
              <div className="space-y-0.5">
                {topFree.map((z,i) => (
                  <button key={z.zone} onClick={() => handleSelectZone(z)}
                    className={`w-full flex items-center gap-2.5 px-2 py-2.5 rounded-xl text-left transition-all group border ${
                      selectedZone?.zone===z.zone
                        ? 'bg-blue-50 border-blue-100 dark:bg-blue-900/20 dark:border-blue-800'
                        : 'border-transparent hover:bg-gray-50 dark:hover:bg-gray-800'}`}>
                    <span className="text-[10px] font-bold text-gray-300 w-4 tabular-nums text-right shrink-0">{i+1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate">{z.zone}</p>
                      <div className="mt-0.5"><OccBar pct={z.predicted_occupancy} level={z.warning_level} animate /></div>
                    </div>
                    {z.zone_lat && (
                      <button onClick={e=>{e.stopPropagation(); onNavigateToMap(z.zone_lat,z.zone_lon,z.zone)}}
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-blue-500 hover:text-blue-700 shrink-0">
                        {I.Map}
                      </button>
                    )}
                  </button>
                ))}
              </div>
            )}
          </Card>

          <Card delay={160}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-bold text-gray-900 dark:text-white">Busiest Areas Now</h2>
                <p className="text-[11px] text-gray-400 mt-0.5">Highest predicted demand — avoid if possible</p>
              </div>
            </div>
            {loading ? <Skel rows={5} /> : !busiest.length ? <p className="text-sm text-gray-400">No data</p> : (
              <div className="space-y-0.5">
                {busiest.map((z,i) => (
                  <button key={z.zone} onClick={() => handleSelectZone(z)}
                    className={`w-full flex items-center gap-2.5 px-2 py-2.5 rounded-xl text-left transition-all group border ${
                      selectedZone?.zone===z.zone
                        ? 'bg-blue-50 border-blue-100 dark:bg-blue-900/20 dark:border-blue-800'
                        : 'border-transparent hover:bg-gray-50 dark:hover:bg-gray-800'}`}>
                    <span className="text-[10px] font-bold text-gray-300 w-4 tabular-nums text-right shrink-0">{i+1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate">{z.zone}</p>
                      <div className="mt-0.5"><OccBar pct={z.predicted_occupancy} level={z.warning_level} animate /></div>
                    </div>
                    <Badge level={z.warning_level} />
                  </button>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* ── All zones — collapsible ── */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden">
          {/* Toggle header */}
          <button onClick={() => setZonesOpen(v=>!v)}
            className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
            <div className="flex items-center gap-3">
              <span className="text-gray-400">{I.Grid}</span>
              <div className="text-left">
                <p className="text-sm font-bold text-gray-900 dark:text-white">All Zones</p>
                <p className="text-[11px] text-gray-400 mt-0.5">{zonesAtHour.length} zones — tap to inspect, filter by hour</p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <div className="flex gap-1">
                {[0,1,2,3,4,5,6].map(h => (
                  <button key={h} onClick={e=>{e.stopPropagation(); setZonesHour(h); setZonesOpen(true)}}
                    className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition-colors ${
                      zonesHour===h ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900' : 'bg-gray-100 dark:bg-gray-700 text-gray-500 hover:bg-gray-200'}`}>
                    {HLABELS[h]}
                  </button>
                ))}
              </div>
              <span className="text-gray-400 ml-2">{zonesOpen ? I.ChevUp : I.ChevDown}</span>
            </div>
          </button>

          {/* Collapsed summary bar */}
          {!zonesOpen && (
            <div className="px-5 pb-4">
              <div className="flex gap-1 h-3">
                {HRS.map(h => {
                  const sl = warnings.filter(w=>w.hours_from_now===h)
                  const avg = sl.length ? sl.reduce((s,w)=>s+w.predicted_occupancy,0)/sl.length : 0
                  const cfg = L[cbdChart[h]?.level]||L.low
                  return (
                    <button key={h} onClick={()=>{setZonesHour(h);setZonesOpen(true)}}
                      className="flex-1 rounded-full transition-all hover:scale-y-150 origin-bottom"
                      style={{backgroundColor:cfg.c, opacity:0.6+avg*0.4}}
                      title={`${HLABELS[h]}: ${Math.round(avg*100)}% avg`} />
                  )
                })}
              </div>
              <p className="text-[10px] text-gray-400 mt-1.5 text-center">Click any segment or the header to expand all zones</p>
            </div>
          )}

          {/* Expanded table */}
          {zonesOpen && (
            <div className="border-t border-gray-50 dark:border-gray-800">
              {/* Compact grid for large zone count */}
              <div className="px-5 py-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5 max-h-[60vh] overflow-y-auto">
                {zonesAtHour.map(w => {
                  const cfg = L[w.warning_level]||L.low
                  return (
                    <button key={w.zone} onClick={() => handleSelectZone(w)}
                      className={`flex items-center gap-2.5 p-2.5 rounded-xl text-left transition-all border group ${
                        selectedZone?.zone===w.zone
                          ? 'bg-blue-50 border-blue-200'
                          : 'border-gray-50 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800'}`}>
                      <span className="w-2 h-2 rounded-full shrink-0" style={{backgroundColor:cfg.c}} />
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-medium text-gray-700 dark:text-gray-300 truncate leading-tight">{w.zone}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <div className="h-1 flex-1 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
                            <div className="h-full rounded-full transition-all duration-500"
                              style={{width:`${Math.round(w.predicted_occupancy*100)}%`, backgroundColor:cfg.c}} />
                          </div>
                          <span className="text-[10px] font-bold tabular-nums shrink-0" style={{color:cfg.c}}>
                            {Math.round(w.predicted_occupancy*100)}%
                          </span>
                        </div>
                      </div>
                      {w.zone_lat && (
                        <button onClick={e=>{e.stopPropagation();onNavigateToMap(w.zone_lat,w.zone_lon,w.zone)}}
                          className="opacity-0 group-hover:opacity-100 transition-opacity text-blue-400 hover:text-blue-600 shrink-0">
                          {I.Map}
                        </button>
                      )}
                    </button>
                  )
                })}
              </div>
              {/* Legend */}
              <div className="px-5 py-3 border-t border-gray-50 dark:border-gray-800 flex flex-wrap items-center gap-4 text-[10px] text-gray-400">
                {Object.entries(L).map(([k,v]) => (
                  <span key={k} className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full inline-block" style={{backgroundColor:v.c}} />
                    {v.label}
                  </span>
                ))}
                <span className="ml-auto text-gray-300">Click any zone to see detail · Tap {I.Map} to open in map</span>
              </div>
            </div>
          )}
        </div>

        <p className="text-[11px] text-gray-400 text-center pb-4">
          Melbourne CBD · SCATS traffic data · City of Melbourne open data · XGBoost predictive model
        </p>
      </div>

      <style>{`
        @keyframes fadeUp { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
        .card-enter { animation: fadeUp 0.4s ease forwards; }
      `}</style>
    </div>
  )
}
