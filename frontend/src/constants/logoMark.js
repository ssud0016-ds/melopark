/** Base box for MelOPark PNG lockups (width scales from height). */
const LOGO_MARK_BASE =
  'block w-auto max-w-[min(300px,58vw)] object-contain object-left'

/**
 * Header: both assets are wide lockups after alpha-trim. Same height for light/dark so
 * `w-auto` yields similar on-screen width (the old light file was 2000×2000 square, which
 * rendered as a tiny square at fixed height).
 */
export const LOGO_HEADER_IMG_CLASS = `${LOGO_MARK_BASE} h-12`

/** Footer bar is always dark; stable size regardless of site theme toggle. */
export const LOGO_FOOTER_IMG_CLASS = `${LOGO_MARK_BASE} h-12`
