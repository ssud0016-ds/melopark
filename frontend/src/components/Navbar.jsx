// src/components/Navbar.jsx
import React from 'react';
import { useClock } from '../hooks/useClock';

const G = '#3fa73f';

export default function Navbar({ activePage, onNavigate }) {
  const time = useClock();

  return (
    <>
      <style>{`
        @keyframes mp-pulse { 0%,100%{opacity:1} 50%{opacity:0.35} }
        .mp-navlink { text-decoration:none; font-size:14px; font-weight:500; padding:6px 16px; border-radius:8px; transition:all 0.18s; display:block; }
        .mp-navlink:hover { background:#f3f4f6; color:#111827; }
        .mp-navlink.active { background:#edf7ed; color:${G}; }
        .mp-navlink.inactive { color:#4b5563; }
      `}</style>
      <nav style={{
        position:'fixed', top:0, left:0, right:0, zIndex:100,
        background:'white', borderBottom:'1px solid rgba(0,0,0,0.08)',
        height:64, padding:'0 24px',
        display:'grid', gridTemplateColumns:'1fr auto 1fr',
        alignItems:'center',
        boxShadow:'0 1px 8px rgba(0,0,0,0.06)',
      }}>
        {/* Logo */}
        <a href="#" onClick={e=>{ e.preventDefault(); onNavigate('home'); }}
          style={{ display:'flex', alignItems:'center', gap:10, textDecoration:'none', justifySelf:'start' }}>
          <div style={{ width:34,height:34,background:G,borderRadius:8,display:'flex',alignItems:'center',justifyContent:'center',fontWeight:800,fontSize:15,color:'white' }}>P</div>
          <span style={{ fontWeight:700, fontSize:18, color:'#111827' }}>
            Melo<span style={{ color:G }}>Park</span>
          </span>
        </a>

        {/* Centre nav links */}
        <ul style={{ display:'flex', alignItems:'center', gap:2, listStyle:'none', justifySelf:'center', margin:0, padding:0 }}>
          {[['home','Home'],['map','Live Map']].map(([pg,label]) => (
            <li key={pg}>
              <a href="#" className={`mp-navlink ${activePage===pg?'active':'inactive'}`}
                onClick={e=>{ e.preventDefault(); onNavigate(pg); }}>
                {label}
              </a>
            </li>
          ))}
        </ul>

        {/* Right — live badge */}
        <div style={{ justifySelf:'end', display:'flex', alignItems:'center', gap:7, background:'#edf7ed', border:'1px solid rgba(63,167,63,0.2)', borderRadius:100, padding:'6px 14px', fontSize:13, fontWeight:500, color:'#2a7a2a' }}>
          <span style={{ width:7,height:7,background:G,borderRadius:'50%',display:'inline-block',animation:'mp-pulse 2s infinite' }}/>
          Live CBD&nbsp;{time}
        </div>
      </nav>
    </>
  );
}
