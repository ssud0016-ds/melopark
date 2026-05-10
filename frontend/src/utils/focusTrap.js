/**
 * Focus utilities shared between BayDetailSheet and modal dialogs.
 */

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), a[href], input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/** @param {HTMLElement | null} root */
export function listFocusable(root) {
  if (typeof document === 'undefined' || !root) return []
  return Array.from(root.querySelectorAll(FOCUSABLE_SELECTOR)).filter((el) => {
    if (!(el instanceof HTMLElement)) return false
    const r = el.getBoundingClientRect()
    if (r.width === 0 && r.height === 0) return false
    const st = window.getComputedStyle(el)
    if (st.visibility === 'hidden' || st.display === 'none') return false
    return true
  })
}
