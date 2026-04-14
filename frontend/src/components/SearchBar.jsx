// src/components/SearchBar.jsx
// ─────────────────────────────────────────────────────────────────────────────
// US2 AC1: Sofia types an address/landmark → autocomplete shows → she selects
//          → map recentres with a pin.
// US2 AC1 (no results): friendly "No results" message with prompt to refine.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useState, useRef, useEffect } from 'react';
import { LANDMARKS } from '../data/mapData';

function highlight(text, q) {
  const i = text.toLowerCase().indexOf(q.toLowerCase());
  if (i < 0) return text;
  return (
    <>
      {text.slice(0, i)}
      <strong style={{ color: '#111827' }}>{text.slice(i, i + q.length)}</strong>
      {text.slice(i + q.length)}
    </>
  );
}

export default function SearchBar({ destination, onPick, onClear }) {
  const [query, setQuery]               = useState('');
  const [showDrop, setShowDrop]         = useState(false);
  const [noResults, setNoResults]       = useState(false);
  const inputRef                        = useRef(null);
  const noResTimerRef                   = useRef(null);

  // Keep input in sync if destination is cleared externally
  useEffect(() => {
    if (!destination) setQuery('');
  }, [destination]);

  const matches = query && !destination
    ? LANDMARKS.filter(l =>
        l.name.toLowerCase().includes(query.toLowerCase()) ||
        l.sub.toLowerCase().includes(query.toLowerCase())
      ).slice(0, 6)
    : [];

  const pick = lm => {
    setQuery(lm.name);
    setShowDrop(false);
    setNoResults(false);
    onPick(lm);
  };

  const handleChange = e => {
    const val = e.target.value;
    setQuery(val);
    setShowDrop(true);
    setNoResults(false);
    // If user edits after picking, clear the destination
    if (destination && val !== destination.name) onClear();
  };

  const handleKeyDown = e => {
    if (e.key === 'Enter') {
      const q = query.trim().toLowerCase();
      const m = LANDMARKS.find(l =>
        l.name.toLowerCase().includes(q) || l.sub.toLowerCase().includes(q)
      );
      if (m) { pick(m); return; }
      if (q) {
        setShowDrop(false);
        setNoResults(true);
        clearTimeout(noResTimerRef.current);
        noResTimerRef.current = setTimeout(() => setNoResults(false), 4500);
      }
    }
    if (e.key === 'Escape') {
      setShowDrop(false);
      setNoResults(false);
      onClear();
    }
  };

  const clear = () => {
    setQuery('');
    setShowDrop(false);
    setNoResults(false);
    onClear();
    inputRef.current?.focus();
  };

  return (
    <div style={{ position: 'relative', flex: 1 }}>
      {/* Search input pill */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        background: 'white', borderRadius: 14, padding: '11px 16px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
        border: '1px solid rgba(0,0,0,0.08)',
      }}>
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
          <circle cx="6.5" cy="6.5" r="4.5" stroke="#9ca3af" strokeWidth="1.5"/>
          <line x1="10" y1="10" x2="14" y2="14" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
        <input
          ref={inputRef}
          value={query}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={() => setShowDrop(true)}
          onBlur={() => setTimeout(() => setShowDrop(false), 150)}
          placeholder="Search address or landmark…"
          style={{
            flex: 1, border: 'none', background: 'none', outline: 'none',
            fontFamily: 'inherit', fontSize: 14, color: '#111827',
          }}
        />
        {query && (
          <button onMouseDown={e => { e.preventDefault(); clear(); }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: 18, lineHeight: 1, padding: '0 2px' }}>
            ×
          </button>
        )}
      </div>

      {/* Autocomplete dropdown */}
      {showDrop && matches.length > 0 && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0,
          background: 'white', borderRadius: 14, overflow: 'hidden', zIndex: 50,
          boxShadow: '0 8px 32px rgba(0,0,0,0.14)',
          border: '1px solid rgba(0,0,0,0.08)',
        }}>
          {matches.map((lm, i) => (
            <div
              key={i}
              onMouseDown={e => { e.preventDefault(); pick(lm); }}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '11px 16px', cursor: 'pointer', fontSize: 14,
                borderBottom: i < matches.length - 1 ? '1px solid rgba(0,0,0,0.06)' : 'none',
                transition: 'background 0.12s',
              }}
              onMouseEnter={e => e.currentTarget.style.background = '#edf7ed'}
              onMouseLeave={e => e.currentTarget.style.background = 'white'}
            >
              <span style={{ fontSize: 18, flexShrink: 0 }}>{lm.icon}</span>
              <div>
                <div style={{ fontWeight: 600, color: '#111827' }}>{highlight(lm.name, query)}</div>
                <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 1 }}>{lm.sub}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* US2 AC1 no-results: "No matching places" in dropdown */}
      {showDrop && query && !destination && matches.length === 0 && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0,
          background: 'white', borderRadius: 14, overflow: 'hidden', zIndex: 50,
          boxShadow: '0 8px 32px rgba(0,0,0,0.14)',
          border: '1px solid rgba(0,0,0,0.08)',
          padding: '14px 16px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#9ca3af', fontSize: 14 }}>
            <span>🔍</span>
            <div>
              <div style={{ fontWeight: 600 }}>No matching places</div>
              <div style={{ fontSize: 12, marginTop: 2 }}>Try "Flinders", "RMIT", or a street name</div>
            </div>
          </div>
        </div>
      )}

      {/* US2 AC1: full no-results toast (after pressing Enter with no match) */}
      {noResults && (
        <div style={{
          position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
          zIndex: 200, background: 'white', borderRadius: 20, padding: '28px 32px',
          textAlign: 'center', boxShadow: '0 12px 48px rgba(0,0,0,0.15)', maxWidth: 280, width: '90%',
        }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🔍</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#111827', marginBottom: 8 }}>No results found</div>
          <div style={{ fontSize: 13, color: '#6b7280', lineHeight: 1.6, marginBottom: 18 }}>
            We couldn't find "{query}". Try a landmark like "Melbourne Central" or a street name.
          </div>
          <button onClick={() => { setNoResults(false); clear(); }}
            style={{ background: '#3fa73f', color: 'white', border: 'none', borderRadius: 10, padding: '9px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
            Clear & Try Again
          </button>
        </div>
      )}
    </div>
  );
}
