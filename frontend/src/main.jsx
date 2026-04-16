import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

// #region agent log
window.addEventListener('error', (e) => {
  fetch('http://127.0.0.1:7821/ingest/e1842ad7-9c21-486e-8c1a-76c861137f8d', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '2e2407' },
    body: JSON.stringify({
      sessionId: '2e2407',
      runId: 'post-fix',
      hypothesisId: 'H_global',
      location: 'frontend/src/main.jsx:global-error',
      message: 'window.error',
      data: {
        message: e?.message,
        filename: e?.filename,
        lineno: e?.lineno,
        colno: e?.colno,
        errorName: e?.error?.name,
      },
      timestamp: Date.now(),
    }),
  }).catch(() => {})
})

window.addEventListener('unhandledrejection', (e) => {
  const r = e?.reason
  fetch('http://127.0.0.1:7821/ingest/e1842ad7-9c21-486e-8c1a-76c861137f8d', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '2e2407' },
    body: JSON.stringify({
      sessionId: '2e2407',
      runId: 'post-fix',
      hypothesisId: 'H_global',
      location: 'frontend/src/main.jsx:unhandledrejection',
      message: 'window.unhandledrejection',
      data: {
        reasonType: typeof r,
        reasonName: r?.name,
        reasonMessage: r?.message,
        code: r?.code,
      },
      timestamp: Date.now(),
    }),
  }).catch(() => {})
})
// #endregion agent log

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
