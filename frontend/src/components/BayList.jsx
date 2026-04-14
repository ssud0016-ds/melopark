// src/components/BayList.jsx
import React from 'react'
import { BAY_COLORS } from '../data/mapData'
import { metersBetweenBayAndDestination, walkingMinutesFromMeters } from '../utils/mapGeo'

export default function BayList({ visibleBays, selectedBayId, destination, onSelect }) {
  if (!visibleBays.length) {
    return (
      <div style={{ textAlign: 'center', padding: '32px 16px', color: '#9ca3af' }}>
        <div style={{ fontSize: 32, marginBottom: 10 }}>🅿️</div>
        <div style={{ fontWeight: 600, marginBottom: 4, color: '#6b7280' }}>No bays match</div>
        <div style={{ fontSize: 13 }}>Try a different filter or widen your search</div>
      </div>
    );
  }

  return (
    <div style={{ padding: '4px 12px 20px' }}>
      {visibleBays.map(bay => {
        const isSel  = bay.id === selectedBayId;
        const cols   = BAY_COLORS[bay.type] || BAY_COLORS.available;
        const avDot  = bay.free === 0 ? '🔴' : bay.free <= bay.spots * 0.3 ? '🟠' : '🟢';

        const badge = bay.type === 'available'
          ? <span style={{ background:'#dcfce7', color:'#16a34a', fontSize:10, fontWeight:700, padding:'2px 8px', borderRadius:100, flexShrink:0 }}>Available</span>
          : bay.type === 'trap'
          ? <span style={{ background:'#fef3c7', color:'#d97706', fontSize:10, fontWeight:700, padding:'2px 8px', borderRadius:100, flexShrink:0 }}>⚠ Trap</span>
          : <span style={{ background:'#fee2e2', color:'#dc2626', fontSize:10, fontWeight:700, padding:'2px 8px', borderRadius:100, flexShrink:0 }}>Occupied</span>;

        let distLabel = null;
        if (destination) {
          const m = Math.round(metersBetweenBayAndDestination(bay, destination))
          const mn = walkingMinutesFromMeters(m)
          distLabel = <span style={{ fontSize:11, color:'#9ca3af' }}>{m} m · ~{mn} min walk</span>
        }

        return (
          <div
            key={bay.id}
            onClick={() => onSelect(bay.id)}
            style={{
              display: 'flex', alignItems: 'flex-start', gap: 12,
              padding: '13px 14px', borderRadius: 14, cursor: 'pointer',
              border: `1.5px solid ${isSel ? cols.border : 'rgba(0,0,0,0.08)'}`,
              marginBottom: 8,
              background: isSel ? cols.bg : 'white',
              transition: 'all 0.18s',
            }}
            onMouseEnter={e => { if (!isSel) { e.currentTarget.style.borderColor = cols.border; e.currentTarget.style.background = cols.bg; } }}
            onMouseLeave={e => { if (!isSel) { e.currentTarget.style.borderColor = 'rgba(0,0,0,0.08)'; e.currentTarget.style.background = 'white'; } }}
          >
            {/* Colour dot */}
            <div style={{ width:12, height:12, borderRadius:'50%', background:cols.dot, flexShrink:0, marginTop:3 }}/>

            <div style={{ flex:1, minWidth:0 }}>
              {/* Name + status badge */}
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:8, marginBottom:3 }}>
                <div style={{ fontSize:14, fontWeight:700, color:'#111827', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                  {bay.name}
                </div>
                {badge}
              </div>

              {/* Sub info */}
              <div style={{ fontSize:11, color:'#9ca3af', display:'flex', alignItems:'center', gap:8, flexWrap:'wrap', marginBottom:6 }}>
                <span>#{bay.id}</span>
                <span>{avDot} <strong>{bay.free}/{bay.spots}</strong> spots free</span>
                {bay.cost ? <span>{bay.cost}</span> : null}
                {distLabel}
              </div>

              {/* Tags */}
              <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
                <span style={{ fontSize:10, padding:'2px 7px', borderRadius:100, border:'1px solid rgba(0,0,0,0.08)', color:'#4b5563', background:'#f3f4f6', fontWeight:700 }}>
                  {(bay.limitType||'').toUpperCase()}
                </span>
                {bay.tags.filter(t => !t.match(/^[234]P$/i)).map((t, i) => (
                  <span key={i} style={{ fontSize:10, padding:'2px 7px', borderRadius:100, border:'1px solid rgba(0,0,0,0.08)', color:'#4b5563', background:'#f3f4f6' }}>
                    {t}
                  </span>
                ))}
              </div>

              {/* Warning */}
              {bay.warn && (
                <div style={{ background:'#fff7ed', border:'1px solid #fed7aa', borderRadius:8, padding:'6px 10px', fontSize:10, color:'#c2410c', marginTop:6 }}>
                  ⚠ {bay.warn}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
