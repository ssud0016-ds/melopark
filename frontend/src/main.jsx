import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import SiteGate from './components/SiteGate'
import 'leaflet/dist/leaflet.css'
import './index.css'

// #region agent log
try {
  const runId = 'pre-fix'
  const endpoint = 'http://127.0.0.1:7803/ingest/fe5101a3-be05-44f1-821d-9a39dfa234b6'
  const send = (hypothesisId, message, data) => {
    const payload = {
      sessionId: '9e70fa',
      runId,
      hypothesisId,
      location: 'frontend/src/main.jsx:main',
      message,
      data,
      timestamp: Date.now(),
    }
    // Prefer normal CORS request; fallback to no-cors and beacon so the request still gets sent.
    fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '9e70fa' },
      body: JSON.stringify(payload),
    }).catch(() => {
      fetch(endpoint, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify(payload),
      }).catch(() => {})
    })
    try {
      navigator.sendBeacon(endpoint, JSON.stringify(payload))
    } catch {
      // ignore
    }
  }

  const leafletLinks = Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
    .map((l) => l.getAttribute('href') || '')
    .filter((href) => /leaflet/i.test(href) || /unpkg\.com/i.test(href) || /jsdelivr/i.test(href))

  send('H1', 'Page bootstrap info', {
    url: String(window.location.href),
    origin: String(window.location.origin),
    hasServiceWorker: 'serviceWorker' in navigator,
    leafletLinks,
  })

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker
      .getRegistrations()
      .then((regs) => {
        send('H2', 'Service worker registrations', {
          count: regs.length,
          scopes: regs.map((r) => r.scope),
        })
      })
      .catch(() => {})
  }
  window.addEventListener('load', () => {
    const allStylesheets = Array.from(document.querySelectorAll('link[rel="stylesheet"]')).map(
      (l) => l.getAttribute('href') || '',
    )
    send('H3', 'Stylesheets after window.load', { allStylesheets })
  })
} catch {
  // ignore
}
// #endregion agent log


ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <SiteGate>
      <App />
    </SiteGate>
  </React.StrictMode>,
)
