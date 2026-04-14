// src/components/HomePage.jsx
import React from 'react';
import { FACT_CARDS } from '../data/mapData';

const G = '#3fa73f';
const FACT_COLORS = { green: G, teal: '#0891b2', amber: '#f59e0b', red: '#ef4444' };

const WHY_CARDS = [
  { icon:'🚗', bg:'#dcfce7', title:'Reduced Congestion',     body:'Drivers spend an average of 17 minutes cruising for parking in Melbourne\'s CBD. MeloPark guides you to available bays in real time, slashing that wasted time — and the traffic it creates.' },
  { icon:'🌱', bg:'#dcfce7', title:'Lower Emissions',        body:'Every minute a car cruises for parking releases unnecessary CO₂. By reducing search time, MeloPark directly cuts vehicle emissions — supporting Melbourne\'s net-zero targets by 2040.' },
  { icon:'📡', bg:'#eff6ff', title:'Predictive Intelligence', body:'We don\'t just show you what\'s available now — our models predict which bays will free up in the next 30 minutes, so you can plan your journey before leaving home.' },
  { icon:'🏙️', bg:'#fef3c7', title:'Better City Utilisation', body:'Melbourne already has the infrastructure. MeloPark makes it smarter — no new construction required. Existing sensors, existing bays, better outcomes for everyone.' },
];

const card = (style, children) => (
  <div style={{
    background:'white', borderRadius:14, padding:20,
    border:'1px solid rgba(0,0,0,0.08)', ...style,
  }}>{children}</div>
);

export default function HomePage({ availableBayCount, totalFreeSpots, onNavigate }) {
  return (
    <div style={{ paddingTop:64 }}>

      {/* Hero */}
      <section style={{ background:'linear-gradient(160deg,#f0faf0 0%,#ffffff 50%,#f0f7ff 100%)', padding:'72px 24px 56px', textAlign:'center', borderBottom:'1px solid rgba(0,0,0,0.08)' }}>
        <div style={{ maxWidth:600, margin:'0 auto' }}>
          <div style={{ display:'inline-flex', alignItems:'center', gap:7, background:'#edf7ed', border:'1px solid rgba(63,167,63,0.2)', borderRadius:100, padding:'6px 16px', marginBottom:22, fontSize:13, fontWeight:500, color:'#2a7a2a' }}>
            <span style={{ width:7, height:7, background:G, borderRadius:'50%', display:'inline-block' }}/>
            Smarter Parking · Cleaner City · Reducing Emissions
          </div>
          <h1 style={{ fontSize:'clamp(28px,5vw,48px)', fontWeight:800, color:'#111827', lineHeight:1.15, marginBottom:14, letterSpacing:'-0.02em' }}>
            Melbourne's <span style={{ color:G }}>Intelligent</span> Parking Platform
          </h1>
          <p style={{ fontSize:16, color:'#6b7280', lineHeight:1.7, marginBottom:28 }}>
            Transforming Melbourne's existing infrastructure data into real-time, predictive parking intelligence — reducing congestion, lowering carbon emissions and getting you parked faster.
          </p>
          <button onClick={() => onNavigate('map')} style={{ background:G, color:'white', border:'none', borderRadius:10, padding:'12px 28px', fontSize:15, fontWeight:600, cursor:'pointer', fontFamily:'inherit', transition:'all 0.18s' }}
            onMouseEnter={e=>{ e.target.style.background='#57c45a'; e.target.style.transform='translateY(-1px)'; }}
            onMouseLeave={e=>{ e.target.style.background=G; e.target.style.transform='none'; }}>
            ● View Live Map
          </button>
        </div>
      </section>

      {/* Stats bar */}
      <div style={{ background:'white', display:'grid', gridTemplateColumns:'repeat(5,1fr)', borderBottom:'1px solid rgba(0,0,0,0.08)' }}>
        {[
          { num:'31K+',           label:'Bays Tracked'     },
          { num:availableBayCount,label:'Available Now'    },
          { num:'27%',            label:'Less Cruising'    },
          { num:'4.3t',           label:'CO₂ Saved Daily'  },
          { num:totalFreeSpots,   label:'Free Spots Now'   },
        ].map((s,i) => (
          <div key={i} style={{ padding:'20px 12px', textAlign:'center', borderRight:i<4?'1px solid rgba(0,0,0,0.08)':'none' }}>
            <div style={{ fontSize:24, fontWeight:800, color:G, letterSpacing:'-0.02em' }}>{s.num}</div>
            <div style={{ fontSize:11, color:'#9ca3af', marginTop:3, fontWeight:500 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Why MeloPark */}
      <div style={{ padding:'56px 24px', maxWidth:1100, margin:'0 auto' }}>
        <SectionLabel>Why MeloPark</SectionLabel>
        <h2 style={{ fontSize:'clamp(22px,3.5vw,34px)', fontWeight:800, color:'#111827', marginBottom:8, letterSpacing:'-0.02em' }}>The parking problem is a climate problem</h2>
        <p style={{ fontSize:15, color:'#6b7280', lineHeight:1.7, marginBottom:32 }}>30% of urban traffic is drivers circling for parking. We fix that — one bay at a time.</p>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
          {WHY_CARDS.map((c,i) => (
            <HoverCard key={i}>
              <div style={{ width:44, height:44, borderRadius:12, background:c.bg, display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, marginBottom:14 }}>{c.icon}</div>
              <h3 style={{ fontSize:16, fontWeight:700, marginBottom:8, color:'#111827' }}>{c.title}</h3>
              <p style={{ fontSize:13, lineHeight:1.7, color:'#6b7280' }}>{c.body}</p>
            </HoverCard>
          ))}
        </div>
      </div>

      {/* Live Dashboard */}
      <div style={{ padding:'0 24px 56px', maxWidth:1100, margin:'0 auto' }}>
        <SectionLabel>Live Dashboard</SectionLabel>
        <h2 style={{ fontSize:'clamp(22px,3.5vw,34px)', fontWeight:800, color:'#111827', marginBottom:8, letterSpacing:'-0.02em' }}>Parking at a glance</h2>
        <p style={{ fontSize:15, color:'#6b7280', lineHeight:1.7, marginBottom:28 }}>Real-time snapshot of Melbourne CBD parking conditions.</p>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))', gap:14 }}>
          {[
            { label:'Available Bays',    num:availableBayCount, col:'#111827', sub:'of 9 total monitored',       badge:'↑ 3 freed in last 10 min', up:true  },
            { label:'Avg Search Time',   num:'8min',            col:'#111827', sub:'was 17 min before MeloPark', badge:'↓ 53% improvement',        up:true  },
            { label:'Rule Traps Active', num:'2',               col:'#f97316', sub:'clearway or time-limited',   badge:'⚠ Check before parking',   up:false },
            { label:'Free Spots Now',    num:totalFreeSpots,    col:G,         sub:'across available bays',      badge:'Live sensor count',         up:true  },
          ].map((d,i) => (
            <div key={i} style={{ background:'white', borderRadius:14, padding:20, border:'1px solid rgba(0,0,0,0.08)' }}>
              <div style={{ fontSize:11, color:'#9ca3af', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:8 }}>{d.label}</div>
              <div style={{ fontSize:30, fontWeight:800, color:d.col, letterSpacing:'-0.02em' }}>{d.num}</div>
              <div style={{ fontSize:12, color:'#6b7280', marginTop:4 }}>{d.sub}</div>
              <div style={{ display:'inline-flex', alignItems:'center', gap:4, fontSize:11, fontWeight:600, marginTop:10, padding:'3px 8px', borderRadius:100, background:d.up?'#dcfce7':'#fef3c7', color:d.up?'#16a34a':'#d97706' }}>{d.badge}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Fact Cards */}
      <div style={{ padding:'0 24px 56px', maxWidth:1100, margin:'0 auto' }}>
        <SectionLabel>Did You Know?</SectionLabel>
        <h2 style={{ fontSize:'clamp(22px,3.5vw,34px)', fontWeight:800, color:'#111827', marginBottom:28, letterSpacing:'-0.02em' }}>The parking facts that matter</h2>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(240px,1fr))', gap:16 }}>
          {FACT_CARDS.map((f,i) => (
            <HoverCard key={i} extraStyle={{ borderLeft:`4px solid ${FACT_COLORS[f.color]}`, borderRadius:16, padding:24 }}>
              <div style={{ fontSize:36, fontWeight:800, color:'#111827', lineHeight:1, letterSpacing:'-0.02em' }}>
                {f.num}<span style={{ fontSize:18, color:FACT_COLORS[f.color] }}>{f.unit}</span>
              </div>
              <div style={{ fontSize:13, color:'#6b7280', marginTop:8, lineHeight:1.6 }}>{f.desc}</div>
              <div style={{ fontSize:11, color:'#9ca3af', marginTop:10 }}>Source: {f.source}</div>
            </HoverCard>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div style={{ background:G, padding:'56px 24px', textAlign:'center' }}>
        <div style={{ maxWidth:480, margin:'0 auto' }}>
          <h2 style={{ color:'white', fontSize:'clamp(22px,3.5vw,32px)', fontWeight:800, letterSpacing:'-0.02em', marginBottom:12 }}>Ready to find your spot?</h2>
          <p style={{ color:'rgba(255,255,255,0.85)', fontSize:15, marginBottom:24, lineHeight:1.7 }}>Open the live map and see exactly where you can park in Melbourne right now.</p>
          <button onClick={() => onNavigate('map')} style={{ background:'white', color:G, border:'none', borderRadius:10, padding:'12px 28px', fontSize:14, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
            Open Live Map →
          </button>
        </div>
      </div>

      {/* Footer */}
      <footer style={{ background:'#111827', color:'rgba(255,255,255,0.5)', textAlign:'center', padding:'32px 24px', fontSize:13, lineHeight:1.8 }}>
        <div style={{ fontSize:18, fontWeight:700, color:'white', marginBottom:4 }}>Melo<span style={{ color:G }}>Park</span></div>
        <div>Smarter Parking · Cleaner City · Reducing Emissions</div>
        <div style={{ marginTop:6 }}>© 2026 MeloPark · Melbourne, Victoria, Australia</div>
      </footer>
    </div>
  );
}

// ── Helper sub-components ─────────────────────────────────────────────────────
function SectionLabel({ children }) {
  return (
    <div style={{ display:'inline-block', fontSize:11, fontWeight:600, letterSpacing:'0.08em', textTransform:'uppercase', color:'#2a7a2a', background:'#edf7ed', padding:'4px 12px', borderRadius:100, marginBottom:12 }}>
      {children}
    </div>
  );
}

function HoverCard({ children, extraStyle = {} }) {
  const [hovered, setHovered] = React.useState(false);
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ background:'white', borderRadius:16, padding:28, border:'1px solid rgba(0,0,0,0.08)', transition:'all 0.2s', transform:hovered?'translateY(-2px)':'none', boxShadow:hovered?'0 8px 32px rgba(0,0,0,0.10)':'none', ...extraStyle }}
    >
      {children}
    </div>
  );
}
