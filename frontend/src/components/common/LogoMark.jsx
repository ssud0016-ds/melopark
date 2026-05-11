import logoLight from '../../assets/logo/mobile-light.png'
import logoDark from '../../assets/logo/mobile-dark.png'

/**
 * 24px icon mark for the search bar chrome (no wordmark).
 * Source PNGs are 2000×2000 — rendered at 24px or 32px via the size prop,
 * effectively @83x density. SVG conversion not feasible from this source;
 * PNG sharpness is acceptable at these display sizes (known tradeoff: OQ-1).
 * Light/dark switching uses Tailwind dark: class variant — no prop needed.
 */
export default function LogoMark({ size = 24, className = '' }) {
  const dim = `${size}px`
  return (
    <span
      className={`flex items-center justify-center shrink-0 ${className}`}
      style={{ width: dim, height: dim }}
    >
      <img
        src={logoLight}
        alt="MelOPark"
        width={size}
        height={size}
        className="block dark:hidden object-contain"
        style={{ width: dim, height: dim }}
        draggable={false}
      />
      <img
        src={logoDark}
        alt="MelOPark"
        width={size}
        height={size}
        className="hidden dark:block object-contain"
        style={{ width: dim, height: dim }}
        draggable={false}
      />
    </span>
  )
}
