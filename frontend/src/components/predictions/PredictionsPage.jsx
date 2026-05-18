/**
 * PredictionsPage.jsx — Epic 6 — compact clean version
 */
import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import * as d3 from 'd3'
import BottomTabBar from '../nav/BottomTabBar'

const BRAND='#2E2A8A', TEAL='#1D9E75', GMAPS='#1a73e8'
const TIERS={
  low:     {c:'#1D9E75',bg:'#E8F8F2',bgD:'rgba(29,158,117,0.18)',br:'#9FE1CB',t:'#085041',label:'Low'},
  moderate:{c:'#BA7517',bg:'#FEF3E2',bgD:'rgba(186,117,23,0.18)', br:'#FAC775',t:'#633806',label:'Moderate'},
  high:    {c:'#D85A30',bg:'#FEF0EB',bgD:'rgba(216,90,48,0.18)',  br:'#F5C4B3',t:'#712B13',label:'High'},
  critical:{c:'#E24B4A',bg:'#FEEBEB',bgD:'rgba(226,75,74,0.18)', br:'#F7C1C1',t:'#791F1F',label:'Very busy'},
}
const TIER_ORDER={low:0,moderate:1,high:2,critical:3}
const HRS=[0,1,2,3,4,5,6], HL=['Now','+1h','+2h','+3h','+4h','+5h','+6h']

async function apiFetch(p){
  const b=(import.meta.env.VITE_API_URL||'').replace(/\/$/,'')
  const r=await fetch(`${b}${p}`); if(!r.ok)throw new Error(r.status); return r.json()
}
function drive(m){
  if(!m||m<=0)return null
  return{km:(m/1000).toFixed(1),mins:Math.max(1,Math.round(m/1000/0.4*5))}
}
function splitZone(z){
  const m=z.match(/^(.+?)\s*\((.+)\)$/)
  return m?[m[1],m[2]]:[z,null]
}

// ── Icons ──────────────────────────────────────────────────────────────────────
const Ic={
  Search:()=><svg viewBox="0 0 20 20" fill="none" className="w-5 h-5"><circle cx="8.5" cy="8.5" r="5.5" stroke="currentColor" strokeWidth="1.8"/><line x1="13" y1="13" x2="18" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>,
  Pin:  ()=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" className="w-4 h-4"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/><circle cx="12" cy="9" r="2.5"/></svg>,
  Map:  ()=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" className="w-4 h-4"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/></svg>,
  Car:  ()=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" className="w-4 h-4"><path d="M5 17H3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v9a2 2 0 0 1-2 2h-2"/><circle cx="7.5" cy="17.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/></svg>,
  Nav:  ()=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" className="w-4 h-4"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg>,
  Park: ()=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" className="w-4 h-4"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 17V7h4a3 3 0 0 1 0 6H9"/></svg>,
  Check:()=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" className="w-4 h-4"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>,
  Alert:()=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" className="w-4 h-4"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
  Cal:  ()=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" className="w-4 h-4"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
  Leaf: ()=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" className="w-4 h-4"><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/></svg>,
  Trend:()=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" className="w-4 h-4"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>,
  Clock:()=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" className="w-4 h-4"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  X:    ()=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="w-4 h-4"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  Rf:   ()=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="w-4 h-4"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>,
  Spin: ()=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="w-4 h-4 animate-spin"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>,
}

// ── Arc Spectrum ───────────────────────────────────────────────────────────────
function Arc({pct,level,dark}){
  const ref=useRef(null), anim=useRef(null)
  const t=TIERS[level]??TIERS.low
  useEffect(()=>{
    if(!ref.current)return
    const el=ref.current
    d3.select(el).selectAll('*').remove()
    if(anim.current)cancelAnimationFrame(anim.current)
    const W=el.clientWidth||260, H=Math.round(W*0.58)
    const cx=W/2, cy=H*0.92, R=Math.min(W*0.4,110), rIn=R-R*0.13
    const track=dark?'#1e2a3a':'#dde3f0'
    const svg=d3.select(el).append('svg').attr('width','100%').attr('viewBox',`0 0 ${W} ${H}`).attr('preserveAspectRatio','xMidYMid meet')
    const defs=svg.append('defs')
    const gid='g'+Math.random().toString(36).slice(2)
    const lg=defs.append('linearGradient').attr('id',gid).attr('x1','0%').attr('y1','0%').attr('x2','100%').attr('y2','0%')
    ;[['0%','#1D9E75'],['40%','#7BBF50'],['65%','#BA7517'],['100%','#D85A30']].forEach(([o,c])=>lg.append('stop').attr('offset',o).attr('stop-color',c))
    // track
    svg.append('path').attr('d',d3.arc()({innerRadius:rIn,outerRadius:R,startAngle:-Math.PI/1.08,endAngle:Math.PI/1.08})).attr('transform',`translate(${cx},${cy})`).attr('fill',track)
    // fill arc clipped to pct
    const cid='c'+Math.random().toString(36).slice(2)
    defs.append('clipPath').attr('id',cid).append('path')
      .attr('d',d3.arc()({innerRadius:rIn-2,outerRadius:R+2,startAngle:-Math.PI/1.08,endAngle:-Math.PI/1.08+(pct/100)*(2*Math.PI/1.08)}))
      .attr('transform',`translate(${cx},${cy})`)
    svg.append('rect').attr('x',cx-R-4).attr('y',cy-R-4).attr('width',(R+4)*2).attr('height',(R+4)*2).attr('fill',`url(#${gid})`).attr('clip-path',`url(#${cid})`)
    // ticks 0 25 50 75 100
    ;[0,25,50,75,100].forEach(v=>{
      const a=-Math.PI/1.08+(v/100)*(2*Math.PI/1.08)
      const col=v===0?'#1D9E75':v===100?'#D85A30':dark?'#64748b':'#94a3b8'
      svg.append('line').attr('x1',cx+(rIn-3)*Math.sin(a)).attr('y1',cy-(rIn-3)*Math.cos(a)).attr('x2',cx+(R+3)*Math.sin(a)).attr('y2',cy-(R+3)*Math.cos(a)).attr('stroke',col).attr('stroke-width',2)
      svg.append('text').attr('x',cx+(R+14)*Math.sin(a)).attr('y',cy-(R+14)*Math.cos(a)).attr('text-anchor','middle').attr('dominant-baseline','middle').attr('font-size',8.5).attr('font-weight',600).attr('fill',col).text(v+'%')
    })
    // animated needle
    const nl=svg.append('line').attr('x1',cx).attr('y1',cy).attr('x2',cx).attr('y2',cy-(rIn-10)).attr('stroke',dark?'#f1f5f9':'#1e293b').attr('stroke-width',3).attr('stroke-linecap','round')
    svg.append('circle').attr('cx',cx).attr('cy',cy).attr('r',5.5).attr('fill',dark?'#f1f5f9':'#1e293b')
    let t0=null
    const go=ts=>{if(!t0)t0=ts;const p=Math.min((ts-t0)/1300,1),e=1-Math.pow(1-p,3),a=-Math.PI/1.08+(e*pct/100)*(2*Math.PI/1.08),l=rIn-10;nl.attr('x2',cx+l*Math.sin(a)).attr('y2',cy-l*Math.cos(a));if(p<1)anim.current=requestAnimationFrame(go)}
    anim.current=requestAnimationFrame(go)
    const tc=dark?'#f1f5f9':'#0f172a'
    svg.append('text').attr('x',cx).attr('y',cy-rIn*0.44).attr('text-anchor','middle').attr('font-size',R*0.31).attr('font-weight',700).attr('fill',tc).text(pct+'%')
    svg.append('text').attr('x',cx).attr('y',cy-rIn*0.44+R*0.23).attr('text-anchor','middle').attr('font-size',11).attr('font-weight',600).attr('fill',t.c).text(t.label)
    return()=>{if(anim.current)cancelAnimationFrame(anim.current)}
  },[pct,level,dark])
  return <div ref={ref} className="w-full overflow-visible"/>
}

// ── Day Donut ──────────────────────────────────────────────────────────────────
function Donut({chart,sel,onSel,dark}){
  const ref=useRef(null)
  useEffect(()=>{
    if(!ref.current||!chart.length)return
    const el=ref.current
    d3.select(el).selectAll('*').remove()
    const W=Math.min(el.clientWidth||220,240),H=W+40,cx=W/2,cy=(H+10)/2,R=W*0.32,thick=R*0.26
    const tc=dark?'#f1f5f9':'#0f172a',dim=dark?'#64748b':'#94a3b8'
    const svg=d3.select(el).append('svg').attr('width','100%').attr('viewBox',`0 0 ${W} ${H}`).attr('preserveAspectRatio','xMidYMid meet')
    const n=chart.length,sA=(2*Math.PI)/n,gap=0.06
    chart.forEach((d,i)=>{
      const tt=TIERS[d.level]??TIERS.low,isSel=i===sel
      const s=-Math.PI/2+i*sA+gap/2,e=-Math.PI/2+(i+1)*sA-gap/2
      svg.append('path').attr('d',d3.arc().innerRadius(R-thick).outerRadius(isSel?R+8:R).startAngle(s).endAngle(e)()).attr('transform',`translate(${cx},${cy})`).attr('fill',tt.c).attr('opacity',isSel?1:0.5).style('cursor','pointer').on('click',()=>onSel(i))
      const mA=-Math.PI/2+(i+0.5)*sA,lR=R+22
      svg.append('text').attr('x',cx+lR*Math.cos(mA)).attr('y',cy+lR*Math.sin(mA)).attr('text-anchor','middle').attr('dominant-baseline','middle').attr('font-size',isSel?10:8).attr('font-weight',isSel?700:500).attr('fill',isSel?tt.c:dim).style('cursor','pointer').on('click',()=>onSel(i)).text(Math.round(d.occ*100)+'%')
    })
    const cur=chart[sel]??{occ:0.19,level:'low'},ct=TIERS[cur.level]??TIERS.low
    svg.append('text').attr('x',cx).attr('y',cy-9).attr('text-anchor','middle').attr('font-size',W*0.14).attr('font-weight',700).attr('fill',tc).text(Math.round(cur.occ*100)+'%')
    svg.append('text').attr('x',cx).attr('y',cy+W*0.1).attr('text-anchor','middle').attr('font-size',9).attr('fill',ct.c).text(ct.label)
    svg.append('text').attr('x',cx).attr('y',cy+W*0.1+13).attr('text-anchor','middle').attr('font-size',8).attr('fill',dim).text(sel===0?'now':HL[sel])
  },[chart,sel,dark])
  return <div ref={ref} className="w-full overflow-visible"/>
}

// ── Small components ───────────────────────────────────────────────────────────
function Badge({level,small}){
  const t=TIERS[level]??TIERS.low
  return <span className={`inline-flex items-center gap-1 rounded-full font-bold border flex-shrink-0 ${small?'px-2 py-0.5 text-[10px]':'px-2.5 py-0.5 text-xs'}`} style={{background:t.bg,borderColor:t.br,color:t.t}}><span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{background:t.c}}/>{t.label}</span>
}
function MapBtn({lat,lon,label,nav,sm}){
  if(!lat||!lon)return null
  return <button onClick={e=>{e.stopPropagation();nav(lat,lon,label)}} className={`flex items-center gap-1.5 font-semibold rounded-xl text-white hover:opacity-90 active:scale-95 flex-shrink-0 transition-all ${sm?'px-2.5 py-1.5 text-xs':'px-3 py-2 text-sm'}`} style={{background:BRAND}}><Ic.Map/><span>Map</span></button>
}
function GoBtn({lat,lon}){
  if(!lat||!lon)return null
  return <button onClick={e=>{e.stopPropagation();window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}&travelmode=driving`,'_blank','noopener')}} className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-bold rounded-xl text-white hover:opacity-90 flex-shrink-0" style={{background:GMAPS}}>
    <svg viewBox="0 0 192 192" className="w-3.5 h-3.5"><path fill="#fff" d="M96 8C46.6 8 8 46.6 8 96s38.6 88 88 88 88-38.6 88-88S145.4 8 96 8z"/><path fill={GMAPS} d="M96 32c-19.3 0-36 10.4-45.2 26H53l43 43 43-43h2.2C132 42.4 115.3 32 96 32z"/><path fill="#34A853" d="M50.8 58A53.7 53.7 0 0 0 42 84H42l54 54 7-7-44.2-65z"/><path fill="#FBBC05" d="M42 84a54 54 0 0 0 7.7 28l43.3-28H42z"/><path fill="#EA4335" d="M141.2 58L98 101l-2 57 5-5 47.5-67.8A54 54 0 0 0 141.2 58z"/><path fill="#4285F4" d="M149 112.5L96 158l-3 18 57-63.5z"/></svg>
    <span>Go</span>
  </button>
}
function Ring({pct,level}){
  const [tick,set]=useState(0)
  useEffect(()=>{const id=setInterval(()=>set(t=>t+1),2200);return()=>clearInterval(id)},[])
  const t=TIERS[level]??TIERS.low,R=44,sw=8,r2=R-sw,circ=2*Math.PI*r2,dash=(pct/100)*circ
  return <div className="relative flex-shrink-0" style={{width:90,height:90}}>
    <div className="absolute inset-0 rounded-full" style={{background:t.c,opacity:0.04+(tick%2)*0.06,transform:`scale(${1.12+(tick%2)*0.08})`,transition:'transform 2s ease,opacity 2s ease'}}/>
    <svg width="90" height="90" viewBox="0 0 90 90">
      <circle cx="45" cy="45" r={r2} fill="none" stroke={t.c} strokeWidth={sw} opacity="0.15"/>
      <circle cx="45" cy="45" r={r2} fill="none" stroke={t.c} strokeWidth={sw} strokeDasharray={`${dash.toFixed(1)} ${circ.toFixed(1)}`} strokeDashoffset={(circ/4).toFixed(1)} strokeLinecap="round" style={{transition:'stroke-dasharray 1.2s cubic-bezier(.16,1,.3,1)'}}/>
    </svg>
    <div className="absolute inset-0 flex flex-col items-center justify-center">
      <span className="text-lg font-bold leading-none text-slate-900 dark:text-white tabular-nums">{pct}%</span>
      <span className="text-[10px] mt-0.5 font-semibold" style={{color:t.c}}>CBD</span>
    </div>
  </div>
}
function StreetRow({zone,onSel,selected,nav,dark,spin}){
  const t=TIERS[zone.warning_level]??TIERS.low
  const pct=Math.round(zone.predicted_occupancy*100)
  const [main,cross]=splitZone(zone.zone)
  return <button onClick={()=>onSel(zone)} className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left transition-all border cursor-pointer group ${selected?'ring-1':'hover:shadow-sm'}`}
    style={selected?{background:dark?t.bgD:t.bg,borderColor:t.br}:{background:dark?'rgba(255,255,255,0.04)':'rgba(238,240,250,0.8)',borderColor:dark?'#1e2a3a':'#d5d8ef'}}>
    {spin?<span className="flex-shrink-0 text-slate-400"><Ic.Spin/></span>:<span className="w-2.5 h-2.5 rounded-full flex-shrink-0 mt-0.5" style={{background:t.c}}/>}
    <div className="flex-1 min-w-0">
      <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">{main}</p>
      {cross&&<p className="text-[11px] text-slate-400 dark:text-slate-500 truncate">{cross}</p>}
    </div>
    <div className="flex items-center gap-2 flex-shrink-0 w-24">
      <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{background:dark?'#1e2a3a':'#d5d8ef'}}><div className="h-full rounded-full" style={{width:`${pct}%`,background:t.c}}/></div>
      <span className="text-xs font-bold tabular-nums w-8 text-right" style={{color:t.c}}>{pct}%</span>
    </div>
    {zone.zone_lat&&<button onClick={e=>{e.stopPropagation();nav(zone.zone_lat,zone.zone_lon,zone.zone)}} className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg flex-shrink-0" style={{color:BRAND}}><Ic.Map/></button>}
  </button>
}
function AltCard({alt,rank,nav,dark}){
  const lv=alt.pressure_level??alt.warning_level??'low',t=TIERS[lv]??TIERS.low
  const pct=Math.round((alt.predicted_occ??alt.alt_predicted_occupancy??alt.predicted_occupancy??0)*100)
  const lat=alt.zone_lat,lon=alt.zone_lon,dr=drive(alt.distance_m??alt.walk_distance_m??null)
  const [main,cross]=splitZone(alt.zone??alt.alternative_zone??'Parking area')
  return <div className="rounded-2xl border overflow-hidden" style={{borderColor:t.br,background:dark?t.bgD:`${t.bg}55`}}>
    <div className="flex items-center gap-3 px-4 pt-3 pb-2">
      <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-white text-sm flex-shrink-0" style={{background:t.c}}>{rank}</div>
      <div className="flex-1 min-w-0"><p className="text-sm font-bold text-slate-900 dark:text-white truncate">{main}</p>{cross&&<p className="text-xs text-slate-400 dark:text-slate-500 truncate">{cross}</p>}</div>
      <Badge level={lv} small/>
    </div>
    <div className="px-4 pb-2"><div className="h-2 rounded-full overflow-hidden" style={{background:dark?'rgba(255,255,255,0.08)':'rgba(0,0,0,0.06)'}}><div className="h-full rounded-full" style={{width:`${pct}%`,background:`linear-gradient(90deg,${t.c}88,${t.c})`}}/></div></div>
    <div className="flex items-center justify-between px-4 pb-3 gap-2">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5"><span style={{color:t.c}}><Ic.Park/></span><div className="flex flex-col leading-none"><span className="text-sm font-bold tabular-nums" style={{color:t.c}}>{pct}%</span><span className="text-[9px] text-slate-400">occupied</span></div></div>
        {dr&&<div className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400"><span style={{color:t.c}}><Ic.Car/></span><span className="font-semibold tabular-nums">{dr.mins} min · {dr.km} km</span></div>}
      </div>
      <div className="flex items-center gap-1.5" onClick={e=>e.stopPropagation()}>{lat&&lon&&<><MapBtn lat={lat} lon={lon} label={alt.zone} nav={nav} sm/><GoBtn lat={lat} lon={lon}/></>}</div>
    </div>
  </div>
}
function AltSkel(){return <div className="rounded-2xl border border-slate-100 dark:border-slate-800 p-4 space-y-3 animate-pulse"><div className="flex items-center gap-3"><div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800"/><div className="flex-1 space-y-2"><div className="h-3 rounded bg-slate-100 dark:bg-slate-800 w-3/4"/><div className="h-2 rounded bg-slate-100 dark:bg-slate-800 w-1/2"/></div></div><div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800"/></div>}

// ── Zone Banner ────────────────────────────────────────────────────────────────
function Banner({zone,zchart,selH,setH,alts,aLoad,nav,onClose,dark}){
  const t=TIERS[zone.warning_level]??TIERS.low
  const [main,cross]=splitZone(zone.zone)
  const pctNow=Math.round(zone.predicted_occupancy*100)
  const altList=alts?.alternatives?.slice(0,5)??[]
  const isLoad=aLoad||alts===null
  const tgt=alts?.target_zone??null
  const track=dark?'#1e2a3a':'#d5d8ef'
  const bg=dark?'#0f172a':'#F0F3FF'

  return <div className="rounded-2xl border-2 overflow-hidden shadow-xl" style={{borderColor:t.c,background:bg}}>
    <div className="h-1.5" style={{background:`linear-gradient(90deg,${t.c},${t.c}44)`}}/>
    {/* Header */}
    <div className="px-5 py-4 border-b" style={{borderColor:dark?'#1e293b':'#d5d8ef'}}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <span className="mt-0.5 flex-shrink-0" style={{color:BRAND}}><Ic.Pin/></span>
          <div><h3 className="text-base font-bold text-slate-900 dark:text-white leading-snug">{main}</h3>{cross&&<p className="text-xs text-slate-500 dark:text-slate-400">{cross}</p>}</div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Badge level={zone.warning_level}/>
          <MapBtn lat={zone.zone_lat} lon={zone.zone_lon} label={zone.zone} nav={nav} sm/>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl border-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-all" style={{borderColor:dark?'#334155':'#d5d8ef',background:dark?'#1e293b':'white'}}><Ic.X/></button>
        </div>
      </div>
      {/* Occupancy bar — clear label */}
      <div className="mt-3 flex items-center gap-3">
        <div className="flex items-center gap-2 flex-shrink-0">
          <span style={{color:t.c}}><Ic.Park/></span>
          <span className="text-lg font-bold tabular-nums" style={{color:t.c}}>{pctNow}%</span>
          <span className="text-xs text-slate-400 dark:text-slate-500">of bays occupied now</span>
        </div>
        <div className="flex-1 h-2.5 rounded-full overflow-hidden" style={{background:track}}>
          <div className="h-full rounded-full transition-all duration-700" style={{width:`${pctNow}%`,background:t.c}}/>
        </div>
      </div>
    </div>
    {/* Body: 2-col */}
    <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x" style={{borderColor:dark?'#1e293b':'#d5d8ef'}}>
      {/* Left: forecast — always open */}
      <div className="p-5" style={{background:dark?'#0d1526':'#EDF0FF'}}>
        <div className="flex items-center gap-2 mb-3">
          <span className="text-slate-400"><Ic.Clock/></span>
          <p className="text-sm font-bold text-slate-700 dark:text-slate-300">6-hour forecast</p>
          <span className="text-xs text-slate-400 dark:text-slate-500">tap to compare</span>
        </div>
        <div className="space-y-2">
          {zchart.map((d,i)=>{
            const dt=TIERS[d.level]??TIERS.low,s=i===selH,p=Math.round(d.occ*100)
            return <button key={i} onClick={()=>setH(i)} className="w-full flex items-center gap-2.5 cursor-pointer">
              <span className="w-8 text-xs font-bold text-right flex-shrink-0 tabular-nums" style={{color:s?dt.c:'#94a3b8'}}>{HL[i]}</span>
              <div className="flex-1 relative h-6 rounded-xl overflow-hidden" style={{background:track}}>
                <div className="absolute inset-y-0 left-0 rounded-xl flex items-center px-2.5 transition-all duration-700"
                  style={{width:`${Math.max(p,4)}%`,background:s?dt.c:`${dt.c}88`,boxShadow:s?`0 0 8px ${dt.c}55`:'none',minWidth:'3rem'}}>
                  <span className="text-[10px] font-bold text-white tabular-nums">{p}%</span>
                </div>
              </div>
              <Badge level={d.level} small/>
            </button>
          })}
        </div>
      </div>
      {/* Right: alternatives */}
      <div className="p-5" style={{background:dark?'#0f172a':bg}}>
        <div className="flex items-center gap-2 mb-3">
          <span className="text-slate-400"><Ic.Nav/></span>
          <p className="text-sm font-bold text-slate-700 dark:text-slate-300">Nearby alternative parking</p>
          {isLoad?<span className="flex items-center gap-1 text-xs text-slate-400"><Ic.Spin/> Finding</span>:<span className="text-xs text-slate-400">{altList.length} options by car</span>}
        </div>
        {isLoad&&<div className="space-y-3"><AltSkel/><AltSkel/><AltSkel/></div>}
        {!isLoad&&<>
          {tgt&&<div className="rounded-2xl border p-3.5 mb-3" style={{background:dark?(TIERS[tgt.pressure_level]?.bgD||'rgba(255,255,255,0.04)'):`${TIERS[tgt.pressure_level]?.bg||'#F8FAFC'}66`,borderColor:TIERS[tgt.pressure_level]?.br||'#e2e8f0'}}>
            <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{color:TIERS[tgt.pressure_level]?.c||TEAL}}>Your destination</p>
            <div className="flex items-center gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{(tgt.zone||'').split(' (')[0]}</p>
                <div className="mt-1.5 flex items-center gap-2">
                  <div className="flex-1 h-2 rounded-full overflow-hidden" style={{background:track}}><div className="h-full rounded-full" style={{width:`${Math.round((tgt.predicted_occ??0)*100)}%`,background:TIERS[tgt.pressure_level]?.c||TEAL}}/></div>
                  <span className="text-xs font-bold tabular-nums" style={{color:TIERS[tgt.pressure_level]?.c||TEAL}}>{Math.round((tgt.predicted_occ??0)*100)}% occupied</span>
                </div>
              </div>
              <MapBtn lat={zone.zone_lat} lon={zone.zone_lon} label={zone.zone} nav={nav} sm/>
            </div>
          </div>}
          {altList.length>0&&<div className="space-y-2.5">{altList.map((a,i)=><AltCard key={i} alt={a} rank={i+1} nav={nav} dark={dark}/>)}</div>}
          {altList.length===0&&<div className="rounded-2xl border-2 p-4 flex items-center gap-3" style={{background:dark?'rgba(29,158,117,0.1)':'#F0FBF7',borderColor:'#9FE1CB'}}><span style={{color:TEAL}}><Ic.Check/></span><div><p className="text-sm font-bold" style={{color:TEAL}}>Good availability</p><p className="text-xs text-slate-400 mt-0.5">No busier alternatives nearby</p></div></div>}
        </>}
      </div>
    </div>
  </div>
}

// ── Main ───────────────────────────────────────────────────────────────────────
export default function PredictionsPage({onNavigateToMap,onNavigate,darkMode}){
  const nav=onNavigateToMap||function(){}
  const [warns,setWarns]=useState([])
  const [load,setLoad]=useState(true)
  const [err,setErr]=useState(null)
  const [fetched,setFetched]=useState(null)
  const [q,setQ]=useState('')
  const [drop,setDrop]=useState(false)
  const [selZ,setSelZ]=useState(null)
  const [zLoad,setZLoad]=useState(false)
  const sRef=useRef(null),bRef=useRef(null)
  const [alts,setAlts]=useState(null)
  const [aLoad,setALoad]=useState(false)
  const [selH,setSelH]=useState(0)
  const [mob,setMob]=useState(()=>typeof window!=='undefined'&&window.innerWidth<900)

  useEffect(()=>{const fn=()=>setMob(window.innerWidth<900);window.addEventListener('resize',fn);return()=>window.removeEventListener('resize',fn)},[])

  const fetch_=useCallback(async()=>{
    try{setLoad(true);const d=await apiFetch('/api/forecasts/warnings?hours=6');setWarns(d.warnings??[]);setFetched(new Date());setErr(null)}
    catch{setErr('Could not load data.')}finally{setLoad(false)}
  },[])
  useEffect(()=>{fetch_();const id=setInterval(fetch_,5*60*1000);return()=>clearInterval(id)},[fetch_])
  useEffect(()=>{const fn=e=>{if(sRef.current&&!sRef.current.contains(e.target))setDrop(false)};document.addEventListener('mousedown',fn);return()=>document.removeEventListener('mousedown',fn)},[])
  useEffect(()=>{if(selZ&&bRef.current)setTimeout(()=>bRef.current?.scrollIntoView({behavior:'smooth',block:'start'}),80)},[selZ])

  // Derived data
  const zones=useMemo(()=>{const m={};for(const w of warns){if(w.hours_from_now!==0)continue;const p=m[w.zone];if(!p||TIER_ORDER[w.warning_level]>TIER_ORDER[p.warning_level])m[w.zone]=w}return Object.values(m)},[warns])
  const topFree=useMemo(()=>[...zones].sort((a,b)=>a.predicted_occupancy-b.predicted_occupancy).slice(0,6),[zones])
  const busiest=useMemo(()=>[...zones].sort((a,b)=>b.predicted_occupancy-a.predicted_occupancy).slice(0,3),[zones])
  const evts=useMemo(()=>{const s=new Set(),o=[];for(const w of warns){if(w.hours_from_now>2||!w.events_nearby||w.events_nearby==='None')continue;if(!s.has(w.events_nearby)){s.add(w.events_nearby);o.push(w)}}return o},[warns])

  // CBD chart: average occupancy per hour
  const cbdChart=useMemo(()=>HRS.map(h=>{
    const sl=warns.filter(w=>w.hours_from_now===h)
    if(!sl.length)return{h,occ:0.19,level:'low'}
    const avg=sl.reduce((s,w)=>s+w.predicted_occupancy,0)/sl.length
    const lv=sl.reduce((b,w)=>TIER_ORDER[w.warning_level]>TIER_ORDER[b]?w.warning_level:b,'low')
    return{h,occ:avg,level:lv}
  }),[warns])

  const zchart=useMemo(()=>{
    if(!selZ)return[]
    return HRS.map(h=>{const w=warns.find(x=>x.zone===selZ.zone&&x.hours_from_now===h);return{h,occ:w?.predicted_occupancy??0,level:w?.warning_level??'low',event:w?.events_nearby&&w.events_nearby!=='None'?w.events_nearby:null}})
  },[selZ,warns])

  const worst=useMemo(()=>zones.reduce((b,w)=>TIER_ORDER[w.warning_level]>TIER_ORDER[b]?w.warning_level:b,'low'),[zones])

  // CBD current — consistent single source of truth
  const cbdOcc=Math.round((cbdChart[0]?.occ??0.19)*100)
  const cbdLv=cbdChart[0]?.level??'low'
  const cbdTier=TIERS[cbdLv]??TIERS.low
  const cbdFree=100-cbdOcc  // available bays %

  const peakIdx=cbdChart.reduce((b,d,i)=>d.occ>cbdChart[b].occ?i:b,0)
  const peakPct=Math.round(cbdChart[peakIdx]?.occ*100)
  const best=topFree[0]
  const [bestMain]=best?splitZone(best.zone):['N/A',null]

  const signals=useMemo(()=>[
    topFree[0]&&{icon:<Ic.Leaf/>,cfg:TIERS.low,head:splitZone(topFree[0].zone)[0],sub:`${Math.round(topFree[0].predicted_occupancy*100)}% occupied, best now`},
    {icon:<Ic.Trend/>,cfg:TIERS.moderate,head:`Pressure ${cbdChart[1]?.occ>cbdChart[0]?.occ?'rising':'easing'}`,sub:`${Math.round((cbdChart[1]?.occ??0)*100)}% at plus 1 hour`},
    busiest[0]&&{icon:<Ic.Alert/>,cfg:TIERS.high,head:splitZone(busiest[0].zone)[0],sub:`${Math.round(busiest[0].predicted_occupancy*100)}% occupied, avoid`},
    {icon:<Ic.Clock/>,cfg:TIERS.moderate,head:`Peak at ${HL[peakIdx]}`,sub:`${peakPct}% CBD average`},
  ].filter(Boolean),[topFree,busiest,cbdChart,peakIdx,peakPct])

  const results=useMemo(()=>{if(!q.trim())return[];const lo=q.toLowerCase();return zones.filter(z=>z.zone.toLowerCase().includes(lo)).sort((a,b)=>a.zone.toLowerCase().indexOf(lo)-b.zone.toLowerCase().indexOf(lo)).slice(0,10)},[q,zones])

  const pick=useCallback(z=>{setSelZ(z);setQ(z.zone);setDrop(false);setAlts(null);setZLoad(true);setTimeout(()=>setZLoad(false),300)},[])

  useEffect(()=>{
    if(!selZ)return
    const lat=selZ.zone_lat||zones.find(z=>z.zone===selZ.zone)?.zone_lat
    const lon=selZ.zone_lon||zones.find(z=>z.zone===selZ.zone)?.zone_lon
    if(!lat||!lon){setAlts({alternatives:[],target_zone:null});return}
    let x=false;setALoad(true);setAlts(null)
    apiFetch(`/api/forecasts/alternatives?lat=${lat}&lon=${lon}`)
      .then(d=>{if(!x)setAlts(d)}).catch(()=>{if(!x)setAlts({alternatives:[],target_zone:null})}).finally(()=>{if(!x)setALoad(false)})
    return()=>{x=true}
  },[selZ])

  const pgBg=darkMode?'#030712':'#E8EBF8'
  const cardBg=darkMode?'#0f172a':'#F2F4FD'
  const cardBd=darkMode?'rgba(255,255,255,0.08)':'#c8ccec'

  return <div className={`min-h-[100dvh] ${mob?'pb-[56px]':''}`}
    style={{background:pgBg,paddingBottom:mob?'calc(56px + env(safe-area-inset-bottom))':undefined}}>

    {/* ████ FULL STICKY HEADER ████ */}
    <div className="sticky top-0 z-50 shadow-xl" style={{background:`linear-gradient(135deg,#080620 0%,${BRAND} 62%,#0d3020 100%)`}}>
      <div className="w-full px-4 sm:px-8 pt-4 pb-3">
        {/* Title row */}
        <div className="flex items-start justify-between mb-2">
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">Parking Predictions</h1>
            {/* Info line — clear and helpful */}
            <p className="text-xs mt-0.5" style={{color:'rgba(255,255,255,0.55)'}}>
              Melbourne CBD · 6-hour forecast · SCATS traffic data
            </p>
          </div>
          <div className="flex items-center gap-2 mt-0.5 flex-shrink-0">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"/>
            <span className="text-xs" style={{color:'rgba(255,255,255,0.5)'}}>{fetched?fetched.toLocaleTimeString('en-AU',{hour:'2-digit',minute:'2-digit'}):'Live'}</span>
            <button onClick={fetch_} disabled={load} className="p-1.5 rounded-lg disabled:opacity-40 hover:bg-white/10 transition-all" style={{background:'rgba(255,255,255,0.1)'}}>
              <span className="text-white">{load?<Ic.Spin/>:<Ic.Rf/>}</span>
            </button>
          </div>
        </div>

        {/* Search bar — icon correctly aligned inside */}
        <div className="relative" ref={sRef}>
          {/* Search icon — absolutely positioned, vertically centered */}
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4" style={{color:'rgba(255,255,255,0.5)'}}>
            <Ic.Search/>
          </div>
          <input
            value={q}
            onChange={e=>{setQ(e.target.value);setDrop(true)}}
            onFocus={()=>setDrop(true)}
            placeholder="Search a street or suburb to find parking"
            className="w-full py-3.5 pr-10 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-white/30"
            style={{paddingLeft:'2.75rem',background:'rgba(255,255,255,0.13)',border:'1.5px solid rgba(255,255,255,0.2)'}}
          />
          {q&&<button onClick={()=>{setQ('');setSelZ(null);setAlts(null);setDrop(false)}} className="absolute inset-y-0 right-0 flex items-center pr-3 text-white/40 hover:text-white/80 transition-colors"><Ic.X/></button>}

          {/* Dropdown */}
          {drop&&results.length>0&&<div className="absolute left-0 right-0 top-full mt-1.5 rounded-xl border overflow-hidden shadow-2xl z-[100]" style={{background:darkMode?'#1e293b':'white',borderColor:darkMode?'#334155':'#d5d8ef',maxHeight:'60vh',overflowY:'auto'}}>
            <div className="px-4 py-1.5 border-b flex items-center gap-2" style={{borderColor:darkMode?'#334155':'#e2e8f0',background:darkMode?'#0f172a':'#F2F4FD'}}>
              <span className="text-[10px] font-bold uppercase tracking-wider" style={{color:BRAND}}>{results.length} streets found</span>
            </div>
            {results.map((z,i)=>{
              const t=TIERS[z.warning_level]??TIERS.low,pct=Math.round(z.predicted_occupancy*100),[m,cr]=splitZone(z.zone)
              return <button key={`s${i}`} onClick={()=>pick(z)} className="w-full flex items-center gap-3 px-4 py-3 text-left border-b last:border-0 cursor-pointer" style={{borderColor:darkMode?'#1e293b':'#f1f3fc'}}
                onMouseEnter={e=>e.currentTarget.style.background=darkMode?'#1e293b':'#EEF0FA'}
                onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{background:darkMode?t.bgD:t.bg,border:`1px solid ${t.br}`}}><span style={{color:t.c}}><Ic.Pin/></span></div>
                <div className="flex-1 min-w-0"><p className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">{m}</p>{cr&&<p className="text-xs text-slate-400 truncate">{cr}</p>}</div>
                <div className="flex flex-col items-end"><span className="text-sm font-bold tabular-nums" style={{color:t.c}}>{pct}%</span><span className="text-[9px] text-slate-400">occupied</span></div>
                <Badge level={z.warning_level} small/>
              </button>
            })}
          </div>}
        </div>
      </div>

      {/* KPI strip */}
      {!load&&<div className="w-full px-4 sm:px-8 pb-3">
        <div className="grid grid-cols-4 gap-2">
          {/* 1. Available bays — NOT occupied, clearly labelled */}
          {[
            {icon:<Ic.Check/>,lbl:'Available bays',val:`${cbdFree}%`,sub:`${cbdTier.label} pressure`,c:cbdFree>=60?TEAL:cbdFree>=40?'#BA7517':'#D85A30'},
            {icon:<Ic.Clock/>,lbl:`Busiest ${HL[peakIdx]}`,val:`${peakPct}%`,sub:'CBD avg occupied',c:'#BA7517'},
            {icon:<Ic.Leaf/>,lbl:'Most available',val:bestMain,sub:`${Math.round((best?.predicted_occupancy??0)*100)}% occupied`,c:TEAL,sm:true},
            {icon:<Ic.Park/>,lbl:'Zones live',val:`${zones.length}`,sub:'every 5 min',c:'#9d8fef'},
          ].map((s,i)=><div key={i} className="rounded-xl px-3 py-2.5" style={{background:'rgba(255,255,255,0.09)',border:'1px solid rgba(255,255,255,0.13)'}}>
            <div className="flex items-center gap-1.5 mb-1"><span style={{color:s.c}}>{s.icon}</span><span className="text-[9px] font-bold uppercase tracking-wider truncate" style={{color:'rgba(255,255,255,0.4)'}}>{s.lbl}</span></div>
            <p className="font-bold leading-tight tabular-nums" style={{color:s.c,fontSize:s.sm?'0.82rem':'1.15rem'}}>{s.val}</p>
            <p className="text-[10px] mt-0.5 truncate" style={{color:'rgba(255,255,255,0.35)'}}>{s.sub}</p>
          </div>)}
        </div>
      </div>}
    </div>
    {/* end sticky */}

    {err&&<div className="w-full px-4 sm:px-8 mt-4 flex items-center gap-2 p-3.5 rounded-xl bg-red-50 dark:bg-red-950/40 border text-sm text-red-700 dark:text-red-300"><Ic.Alert/>{err}</div>}

    <div className="w-full px-4 sm:px-8 py-5 space-y-4">

      {/* Zone banner — FIRST, below sticky */}
      <div ref={bRef}>
        {selZ&&zchart.length>0&&!zLoad&&<Banner zone={selZ} zchart={zchart} selH={selH} setH={setSelH} alts={alts} aLoad={aLoad} nav={nav} onClose={()=>{setSelZ(null);setQ('');setAlts(null)}} dark={darkMode}/>}
        {selZ&&zLoad&&<div className="rounded-2xl border-2 p-8 flex items-center justify-center gap-3" style={{background:cardBg,borderColor:cardBd}}><Ic.Spin/><span className="text-sm text-slate-400">Loading {selZ.zone.split(' (')[0]}</span></div>}
      </div>

      {/* CBD Demand Overview */}
      <div className="rounded-2xl border-2 shadow-sm overflow-hidden" style={{background:cardBg,borderColor:cardBd}}>
        <div className="px-6 pt-5 pb-3 border-b flex items-start justify-between" style={{borderColor:cardBd}}>
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">CBD Demand Overview</h2>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Pressure spectrum · day demand · least occupied streets · live signals</p>
          </div>
          <Badge level={worst}/>
        </div>
        {load?<div className="h-64 flex items-center justify-center"><div className="w-6 h-6 rounded-full border-2 border-blue-500 dark:border-blue-400 border-t-transparent animate-spin"/></div>:(
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-200 dark:divide-slate-800">
            {/* Arc */}
            <div className="p-6 flex flex-col gap-3">
              <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full animate-pulse" style={{background:cbdTier.c}}/><p className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Pressure spectrum</p></div>
              <div className="flex-1 flex items-center justify-center overflow-visible"><Arc pct={cbdOcc} level={cbdLv} dark={darkMode}/></div>
              <div className="flex items-center justify-center gap-3 flex-wrap">
                {[['#1D9E75','Low 0 to 20'],['#BA7517','Mod 21 to 40'],['#D85A30','High 41+']].map(([c,l])=><span key={l} className="flex items-center gap-1 text-[10px] text-slate-400 dark:text-slate-500"><span className="w-1.5 h-1.5 rounded-full" style={{background:c}}/>{l}</span>)}
              </div>
            </div>
            {/* Donut */}
            <div className="p-6 flex flex-col gap-3">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-slate-400 dark:text-slate-500"><Ic.Clock/></span>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Day demand</p>
                {/* tap hint — visible both modes */}
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{background:darkMode?'rgba(255,255,255,0.15)':'rgba(46,42,138,0.12)',color:darkMode?'#c7d2fe':BRAND,border:`1px solid ${darkMode?'rgba(255,255,255,0.25)':'rgba(46,42,138,0.2)'}`}}>tap segments</span>
              </div>
              <div className="flex-1 flex items-center justify-center overflow-visible"><Donut chart={cbdChart} sel={selH} onSel={setSelH} dark={darkMode}/></div>
              <div className="flex flex-wrap gap-1.5 justify-center">
                {cbdChart.map((d,i)=>{const tt=TIERS[d.level]??TIERS.low,s=i===selH;return<button key={i} onClick={()=>setSelH(i)} className="px-2.5 py-1 rounded-full text-xs font-bold transition-all cursor-pointer tabular-nums hover:scale-105" style={s?{background:tt.c,color:'white',boxShadow:`0 2px 8px ${tt.c}55`}:{background:darkMode?'rgba(255,255,255,0.12)':'rgba(46,42,138,0.1)',color:darkMode?'#c7d2fe':BRAND,border:`1px solid ${darkMode?'rgba(255,255,255,0.2)':'rgba(46,42,138,0.18)'}`}}>{HL[i]}</button>})}
              </div>
              <div className="flex items-center justify-center gap-3 flex-wrap">
                {[['#1D9E75','Low'],['#BA7517','Moderate'],['#D85A30','High']].map(([c,l])=><span key={l} className="flex items-center gap-1 text-[10px] text-slate-400 dark:text-slate-500"><span className="w-1.5 h-1.5 rounded-full" style={{background:c}}/>{l}</span>)}
              </div>
            </div>
            {/* Streets */}
            <div className="p-6 flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-bold" style={{background:darkMode?'rgba(29,158,117,0.2)':'#E8F8F2',color:TEAL}}><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"/>now</span>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Least occupied</p>
              </div>
              <div className="space-y-2 flex-1">
                {topFree.slice(0,6).map(z=><StreetRow key={z.zone} zone={z} onSel={pick} selected={selZ?.zone===z.zone} spin={zLoad&&selZ?.zone===z.zone} nav={nav} dark={darkMode}/>)}
              </div>
            </div>
            {/* Ring + signals */}
            <div className="p-6 flex flex-col gap-4">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Live signals</p>
              <div className="flex items-center gap-4">
                <Ring pct={cbdOcc} level={cbdLv}/>
                <div>
                  <p className="text-base font-bold text-slate-900 dark:text-white">{cbdTier.label}</p>
                  <div className="flex items-center gap-1.5 mt-1"><span style={{color:cbdOcc<=40?TEAL:'#D85A30'}}>{cbdOcc<=40?<Ic.Check/>:<Ic.Alert/>}</span><p className="text-xs text-slate-400 dark:text-slate-500">{cbdOcc<=40?'Good to park':'Plan ahead'}</p></div>
                </div>
              </div>
              <div className="border-t pt-3 flex-1 space-y-0" style={{borderColor:darkMode?'#1e293b':'#d5d8ef'}}>
                {signals.map((s,i)=><div key={i} className="flex items-center gap-3 py-2.5 border-b last:border-0" style={{borderColor:darkMode?'#1e293b':'#e8eaf8'}}>
                  <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{background:darkMode?s.cfg.bgD:s.cfg.bg}}><span style={{color:s.cfg.c}}>{s.icon}</span></div>
                  <div className="flex-1 min-w-0"><p className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">{s.head}</p><p className="text-xs text-slate-400 dark:text-slate-500 truncate">{s.sub}</p></div>
                </div>)}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Events */}
      {evts.length>0&&<div className="rounded-2xl border-2 shadow-sm overflow-hidden" style={{background:cardBg,borderColor:cardBd}}>
        <div className="px-6 pt-4 pb-3 border-b flex items-center justify-between" style={{borderColor:cardBd}}>
          <div className="flex items-center gap-2"><span className="text-amber-500"><Ic.Cal/></span><h2 className="text-sm font-bold text-slate-900 dark:text-white">Active Events nearby</h2></div>
          <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{background:darkMode?'rgba(186,117,23,0.2)':'#FEF3E2',color:'#BA7517'}}>{evts.length}</span>
        </div>
        <div className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {evts.slice(0,4).map((w,i)=><div key={i} className="flex items-start gap-2.5 p-3 rounded-xl border" style={{background:darkMode?'rgba(186,117,23,0.08)':'#FFFBF0',borderColor:'#FAC775'}}>
            <span className="text-amber-500 mt-0.5 flex-shrink-0"><Ic.Cal/></span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">{w.events_nearby}</p>
              <p className="text-xs text-slate-400 truncate mt-0.5">{w.zone.split(' (')[0]}</p>
              {w.zone_lat&&<div className="mt-2"><MapBtn lat={w.zone_lat} lon={w.zone_lon} label={w.zone} nav={nav} sm/></div>}
            </div>
          </div>)}
        </div>
      </div>}

      <p className="text-xs text-slate-400 dark:text-slate-600 text-center pb-4">Melbourne CBD · SCATS traffic data · City of Melbourne open data · XGBoost</p>
    </div>

    {mob&&<BottomTabBar activePage="predictions" onNavigate={onNavigate}/>}
  </div>
}
