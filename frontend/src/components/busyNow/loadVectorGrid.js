// Side-effect module: must run BEFORE `import 'leaflet.vectorgrid'`.
// leaflet.vectorgrid is a classic-script plugin that mutates global `L`,
// so Vite ESM users must expose L on window first.
import L from 'leaflet'

if (typeof window !== 'undefined') {
  window.L = window.L || L
}
