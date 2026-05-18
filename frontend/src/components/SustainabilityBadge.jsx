/**
 * SustainabilityBadge.jsx — Epic 8.0 AC 8.1.1 + AC 8.1.3
 * Design 1 — Activity ring (Apple Fitness style)
 * Three independent rings: CO₂ saved, cruise avoided, carbon score
 * NTC 2024: 193.7g/km · baseline 2.0km = 387g
 */
import { useEffect, useRef, useState } from 'react';

const BASELINE_G = 387;

function useCountUp(target, duration = 1000) {
  const [val, setVal] = useState(0);
  const raf = useRef(null);
  const t0  = useRef(null);
  useEffect(() => {
    if (target == null) return;
    cancelAnimationFrame(raf.current);
    t0.current = null;
    const run = ts => {
      if (!t0.current) t0.current = ts;
      const p = Math.min((ts - t0.current) / duration, 1);
      setVal(Math.round((1 - Math.pow(1 - p, 3)) * target));
      if (p < 1) raf.current = requestAnimationFrame(run);
    };
    raf.current = requestAnimationFrame(run);
    return () => cancelAnimationFrame(raf.current);
  }, [target, duration]);
  return val;
}

function Ring({ pct, color, trackColor, size = 64, strokeWidth = 6, children }) {
  const r     = size / 2 - strokeWidth;
  const circ  = 2 * Math.PI * r;
  const dash  = (Math.min(pct, 100) / 100) * circ;
  return (
    <div style={{ position: 'relative', width: size, height: size, margin: '0 auto' }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none" stroke={trackColor} strokeWidth={strokeWidth} strokeLinecap="round"
        />
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none" stroke={color} strokeWidth={strokeWidth}
          strokeDasharray={`${dash.toFixed(1)} ${circ.toFixed(1)}`}
          strokeDashoffset={(circ / 4).toFixed(1)}
          strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 0.9s cubic-bezier(0.16,1,0.3,1)' }}
        />
      </svg>
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
      }}>
        {children}
      </div>
    </div>
  );
}

export default function SustainabilityBadge({ carbonData }) {
  const savedG     = carbonData?.saved_g      ?? 0;
  const pctAvoided = carbonData?.pct_avoided  ?? 0;
  const score      = carbonData?.score        ?? 0;

  const animG    = useCountUp(savedG,     1000);
  const animPct  = useCountUp(pctAvoided, 1200);
  const animScore= useCountUp(score,       800);

  const [pulse, setPulse] = useState(false);
  useEffect(() => {
    const id = setInterval(() => {
      setPulse(true);
      setTimeout(() => setPulse(false), 600);
    }, 5000);
    return () => clearInterval(id);
  }, []);

  const [isDark, setIsDark] = useState(
    () => typeof document !== 'undefined' && document.documentElement.classList.contains('dark')
  )
  useEffect(() => {
    const obs = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains('dark'))
    })
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => obs.disconnect()
  }, [])

  if (!carbonData) return null; // AC 8.1.3

  const tier = score >= 65 ? 'high' : score >= 35 ? 'mid' : 'low';
  const C = isDark ? {
    high: { bg: '#2E2A8A', border: '#2E2A8A', txt: '#ffffff', sub: 'rgba(255,255,255,0.75)', lbl: 'Efficient' },
    mid:  { bg: '#2E2A8A', border: '#2E2A8A', txt: '#ffffff', sub: 'rgba(255,255,255,0.75)', lbl: 'Moderate'  },
    low:  { bg: '#2E2A8A', border: '#2E2A8A', txt: '#ffffff', sub: 'rgba(255,255,255,0.75)', lbl: 'Low saving' },
  }[tier] : {
    high: { bg: '#EAF3DE', border: '#3B6D11', txt: '#27500A', sub: '#4D7C1A', lbl: 'Efficient' },
    mid:  { bg: '#FAEEDA', border: '#BA7517', txt: '#633806', sub: '#8A5210', lbl: 'Moderate'  },
    low:  { bg: '#F1EFE8', border: '#888780', txt: '#444441', sub: '#6B6A65', lbl: 'Low saving' },
  }[tier];

  const co2Pct   = Math.round(savedG / BASELINE_G * 100);

  return (
    <div
      className="rounded-2xl mt-3"
      style={{
        background: C.bg,
        border: `1.5px solid ${C.border}33`,
        padding: '14px 16px',
        boxShadow: pulse ? `0 0 0 3px ${C.border}18` : 'none',
        transition: 'box-shadow 0.4s ease',
      }}
      aria-label={`${pctAvoided}% of Melbourne CBD cruising avoided, ${savedG}g CO₂ saved, carbon score ${score} out of 100`}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 17, lineHeight: 1 }}>🌿</span>
          <span style={{ fontSize: 13, fontWeight: 500, color: C.txt }}>
            CO₂ saved by parking smart
          </span>
        </div>
        <span style={{
          fontSize: 11, fontWeight: 500, padding: '3px 9px',
          borderRadius: 20, background: `${C.border}22`, color: C.txt,
        }}>
          {C.lbl}
        </span>
      </div>

      {/* Three rings */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>

        {/* Ring 1 — CO₂ saved */}
        <div style={{ textAlign: 'center' }}>
          <Ring pct={co2Pct} color={isDark ? '#7DC843' : '#3B6D11'} trackColor={isDark ? 'rgba(255,255,255,0.2)' : '#C0DD97'} size={68} strokeWidth={6}>
            <span style={{ fontSize: 14, fontWeight: 500, color: isDark ? '#ffffff' : '#27500A', lineHeight: 1 }}>{animG}</span>
            <span style={{ fontSize: 9, color: isDark ? 'rgba(255,255,255,0.75)' : '#3B6D11', lineHeight: 1.4 }}>g</span>
          </Ring>
          <div style={{ fontSize: 11, color: C.sub, marginTop: 6 }}>CO₂ saved</div>
          <div style={{ fontSize: 10, color: C.sub, marginTop: 1 }}>of 387g baseline</div>
        </div>

        {/* Ring 2 — Cruise avoided */}
        <div style={{ textAlign: 'center' }}>
          <Ring pct={animPct} color={isDark ? '#4ECBA8' : '#0F6E56'} trackColor={isDark ? 'rgba(255,255,255,0.2)' : '#9FE1CB'} size={68} strokeWidth={6}>
            <span style={{ fontSize: 14, fontWeight: 500, color: isDark ? '#ffffff' : '#085041', lineHeight: 1 }}>{animPct}</span>
            <span style={{ fontSize: 9, color: isDark ? 'rgba(255,255,255,0.75)' : '#0F6E56', lineHeight: 1.4 }}>%</span>
          </Ring>
          <div style={{ fontSize: 11, color: C.sub, marginTop: 6 }}>cruise avoided</div>
          <div style={{ fontSize: 10, color: C.sub, marginTop: 1 }}>of 2.0 km</div>
        </div>

        {/* Ring 3 — Carbon score */}
        <div style={{ textAlign: 'center' }}>
          <Ring pct={animScore} color={isDark ? 'rgba(255,255,255,0.85)' : C.border} trackColor={isDark ? 'rgba(255,255,255,0.2)' : `${C.border}33`} size={68} strokeWidth={6}>
            <span style={{ fontSize: 14, fontWeight: 500, color: C.txt, lineHeight: 1 }}>{animScore}</span>
            <span style={{ fontSize: 9, color: C.sub, lineHeight: 1.4 }}>/100</span>
          </Ring>
          <div style={{ fontSize: 11, color: C.sub, marginTop: 6 }}>carbon score</div>
          <div style={{ fontSize: 10, color: C.sub, marginTop: 1 }}>live street data</div>
        </div>

      </div>

      {/* Footer inference */}
      <div style={{
        marginTop: 12, paddingTop: 10,
        borderTop: `0.5px solid ${C.border}33`,
        fontSize: 11, color: C.sub, lineHeight: 1.5,
      }}>
        {score >= 65
          ? `You avoided ${pctAvoided}% of typical Melbourne CBD cruising — great sustainability choice.`
          : score >= 35
          ? `You skipped ${pctAvoided}% of the typical 2.0 km Melbourne CBD search drive.`
          : `MeloPark helped you find this bay, saving ${savedG}g of search emissions.`
        }
      </div>
    </div>
  );
}
