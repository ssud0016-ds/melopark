import React from 'react'
import { BAY_COLORS } from '../data/mapData'
import { metersBetweenBayAndDestination, walkingMinutesFromMeters } from '../utils/mapGeo'

export default function BayDetailPanel({
  bay,
  destination,
  onClose,
  isMobile,
  lastUpdated,
  reserveBottomPx = 280,
}) {
  if (!bay) return null

  const cols = BAY_COLORS[bay.type] || BAY_COLORS.available

  let badgeLabel = 'Occupied'
  if (bay.type === 'available') badgeLabel = 'Available'
  else if (bay.type === 'trap') badgeLabel = 'Rule Trap'

  let walkStr = bay.tags?.[2] || bay.tags?.[0] || ''
  if (destination) {
    const m = Math.round(metersBetweenBayAndDestination(bay, destination))
    walkStr = `${m} m from ${destination.name} - ${walkingMinutesFromMeters(m)} min walk`
  } else if (!walkStr) {
    walkStr = 'Select a destination to see walking distance'
  }

  const spotDotColor =
    bay.free === 0 ? '#ef4444' : bay.free <= (bay.spots ?? 1) * 0.3 ? '#f97316' : '#16a34a'

  const panelStyle = isMobile
    ? {
        position: 'fixed',
        top: 64,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 2000,
        overflowY: 'auto',
        WebkitOverflowScrolling: 'touch',
        overscrollBehavior: 'contain',
        background: 'white',
        display: 'flex',
        flexDirection: 'column',
      }
    : {
        position: 'absolute',
        right: 0,
        top: 0,
        bottom: reserveBottomPx,
        width: 380,
        maxWidth: 'min(420px, 44vw)',
        background: 'white',
        boxShadow: '-8px 0 40px rgba(0,0,0,0.12)',
        zIndex: 560,
        overflowY: 'auto',
        WebkitOverflowScrolling: 'touch',
        overscrollBehavior: 'contain',
        display: 'flex',
        flexDirection: 'column',
      }

  const feedUpdatedStr = lastUpdated
    ? lastUpdated.toLocaleTimeString('en-AU', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    : null

  const sensorStr = bay.sensorLastUpdated
    ? (() => {
        try {
          const d = new Date(bay.sensorLastUpdated)
          if (Number.isNaN(d.getTime())) return String(bay.sensorLastUpdated)
          return d.toLocaleString('en-AU', { dateStyle: 'short', timeStyle: 'medium' })
        } catch {
          return String(bay.sensorLastUpdated)
        }
      })()
    : null

  const spots = bay.spots ?? 1
  const free = bay.free ?? 0

  return (
    <div style={panelStyle}>
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        style={{
          position: 'sticky',
          top: 0,
          alignSelf: 'flex-end',
          marginTop: 14,
          marginRight: 14,
          width: 32,
          height: 32,
          borderRadius: '50%',
          background: '#f3f4f6',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 16,
          color: '#4b5563',
          zIndex: 3,
          flexShrink: 0,
        }}
      >
        x
      </button>

      <div
        style={{
          padding: '4px 20px 16px',
          borderBottom: '1px solid rgba(0,0,0,0.08)',
          flexShrink: 0,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 12,
            flexWrap: 'wrap',
          }}
        >
          <div style={{ flex: '1 1 200px', minWidth: 0 }}>
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                color: cols.border,
                marginBottom: 6,
              }}
            >
              {badgeLabel}
            </div>
            <div
              style={{
                fontSize: 22,
                fontWeight: 800,
                letterSpacing: '-0.02em',
                marginBottom: 4,
                color: '#111827',
              }}
            >
              {bay.name}
            </div>
            <div style={{ fontSize: 12, color: '#9ca3af' }}>
              Bay #{bay.id} - {walkStr}
            </div>
          </div>
          {feedUpdatedStr && (
            <div
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: '#2a7a2a',
                background: '#edf7ed',
                border: '1px solid rgba(63,167,63,0.25)',
                borderRadius: 100,
                padding: '6px 12px',
                whiteSpace: 'nowrap',
                alignSelf: 'flex-start',
              }}
            >
              Updated {feedUpdatedStr}
            </div>
          )}
        </div>
      </div>

      <div style={{ padding: '16px 20px 28px', flex: 1 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            background: '#f9fafb',
            borderRadius: 12,
            padding: '12px 14px',
            marginBottom: 16,
          }}
        >
          <div
            style={{
              width: 12,
              height: 12,
              borderRadius: '50%',
              background: spotDotColor,
              flexShrink: 0,
            }}
          />
          <span style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>
            {free}/{spots} spots free
          </span>
          <span style={{ fontSize: 12, color: '#9ca3af', marginLeft: 'auto' }}>
            {(bay.limitType || '').toUpperCase()}
          </span>
        </div>

        {sensorStr && (
          <div
            style={{
              fontSize: 11,
              color: '#6b7280',
              marginBottom: 14,
              padding: '8px 12px',
              background: '#f3f4f6',
              borderRadius: 8,
            }}
          >
            Sensor last reported: {sensorStr}
          </div>
        )}

        {[
          { label: 'Safe to Park', value: bay.safe, color: bay.type === 'trap' ? '#d97706' : '#16a34a' },
          { label: 'Time Limit', value: bay.limit, color: null },
          { label: 'Cost', value: bay.cost, color: '#d97706' },
          { label: 'Applies', value: bay.applies, color: null },
        ].map((row, i, arr) => (
          <div
            key={row.label}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 12,
              padding: '9px 0',
              borderBottom: i < arr.length - 1 ? '1px solid rgba(0,0,0,0.08)' : 'none',
              fontSize: 13,
            }}
          >
            <span style={{ color: '#9ca3af', flexShrink: 0 }}>{row.label}</span>
            <span
              style={{
                fontWeight: 600,
                color: row.color || '#111827',
                textAlign: 'right',
                wordBreak: 'break-word',
              }}
            >
              {row.value ?? '—'}
            </span>
          </div>
        ))}

        {bay.warn && (
          <div
            style={{
              margin: '14px 0',
              padding: '10px 14px',
              background: '#fff7ed',
              border: '1px solid #fed7aa',
              borderRadius: 10,
              fontSize: 12,
              color: '#c2410c',
              lineHeight: 1.5,
            }}
          >
            Warning: {bay.warn}
          </div>
        )}

        {bay.timeline && bay.timeline.length > 0 && (
          <div style={{ marginTop: 18 }}>
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                color: '#9ca3af',
                marginBottom: 12,
              }}
            >
              Rule timeline today
            </div>
            {bay.timeline.map((t, i) => (
              <div
                key={i}
                style={{ display: 'flex', gap: 12, marginBottom: 12, alignItems: 'flex-start' }}
              >
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    flexShrink: 0,
                  }}
                >
                  <div
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: '50%',
                      background: t.on ? '#3fa73f' : 'transparent',
                      border: t.on ? 'none' : '2px solid #e5e7eb',
                      flexShrink: 0,
                    }}
                  />
                  {i < bay.timeline.length - 1 && (
                    <div
                      style={{
                        width: 2,
                        flex: 1,
                        background: '#f3f4f6',
                        margin: '3px 0',
                        minHeight: 16,
                      }}
                    />
                  )}
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{t.time}</div>
                  <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 1 }}>{t.desc}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {bay.desc && (
          <p style={{ marginTop: 18, fontSize: 12, color: '#6b7280', lineHeight: 1.6 }}>{bay.desc}</p>
        )}
      </div>
    </div>
  )
}
