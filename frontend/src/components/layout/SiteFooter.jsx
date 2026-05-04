import logoDarkMode from '../../assets/MelOParkLogoDarkMode.png'
import { LOGO_FOOTER_IMG_CLASS } from '../../constants/logoMark'

const GITHUB_REPO_URL = 'https://github.com/ssud0016-ds/melopark'

function FooterLabel({ children }) {
  return <h3 className="mb-2 text-[11px] font-medium text-white/50">{children}</h3>
}

function FooterLink({ href, children, external }) {
  return (
    <a
      href={href}
      className="block text-[12px] font-normal text-white/[0.55] transition-colors hover:text-white/80"
      {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
    >
      {children}
    </a>
  )
}

function FooterNavButton({ onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="block w-full text-left text-[12px] font-normal text-white/[0.55] transition-colors hover:text-white/80"
    >
      {children}
    </button>
  )
}

/**
 * @param {{ onNavigate?: (page: 'map' | 'about' | 'attribution' | 'terms') => void }} props
 */
export default function SiteFooter({ onNavigate }) {
  const go = (page) => () => onNavigate?.(page)

  return (
    <footer
      className="border-t border-white/[0.08] bg-[#0a1628] text-white/60"
      role="contentinfo"
    >
      <div className="mx-auto max-w-6xl px-10 pb-4 pt-5">
        <div className="grid grid-cols-1 items-start gap-6 md:grid-cols-[2fr_1fr_1fr_1fr] md:gap-6">
          {/* Brand: lockup only (wordmark + tagline in artwork). */}
          <div>
            <img
              src={logoDarkMode}
              alt="MelOPark - Smarter Parking, Cleaner City"
              className={LOGO_FOOTER_IMG_CLASS}
              decoding="async"
            />
          </div>

          {/* Product */}
          <div>
            <FooterLabel>Product</FooterLabel>
            <nav className="flex flex-col gap-1" aria-label="Product">
              <FooterNavButton onClick={go('map')}>Live map</FooterNavButton>
              <FooterNavButton onClick={go('about')}>About</FooterNavButton>
              <FooterLink href="https://data.melbourne.vic.gov.au/" external>
                Data sources
              </FooterLink>
            </nav>
          </div>

          {/* Resources */}
          <div>
            <FooterLabel>Resources</FooterLabel>
            <nav className="flex flex-col gap-1" aria-label="Resources">
              <FooterLink href={GITHUB_REPO_URL} external>
                GitHub
              </FooterLink>
              <FooterLink href="https://www.w3.org/WAI/fundamentals/accessibility-intro/" external>
                Accessibility
              </FooterLink>
              <FooterLink href="mailto:contact@melopark.app">Contact</FooterLink>
            </nav>
          </div>

          {/* Legal */}
          <div>
            <FooterLabel>Legal</FooterLabel>
            <nav className="flex flex-col gap-1" aria-label="Legal">
              <FooterNavButton onClick={go('about')}>Privacy</FooterNavButton>
              <FooterNavButton onClick={go('terms')}>Terms</FooterNavButton>
              <FooterNavButton onClick={go('attribution')}>Attribution</FooterNavButton>
            </nav>
          </div>
        </div>

        <div className="mt-4 border-t-[0.5px] border-[rgba(255,255,255,0.1)] pt-3.5">
          <div className="flex flex-col gap-1.5 text-[11px] leading-snug text-white/40 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <p className="shrink-0">
              &copy; {new Date().getFullYear()} MeloPark &middot; Melbourne, Australia
            </p>
            <p className="sm:text-right">
              Parking data &copy;{' '}
              <a
                href="https://data.melbourne.vic.gov.au/"
                className="text-white/[0.55] underline decoration-white/15 underline-offset-2 transition-colors hover:text-white/75"
                target="_blank"
                rel="noopener noreferrer"
              >
                City of Melbourne
              </a>
              ,{' '}
              <a
                href="https://creativecommons.org/licenses/by/4.0/"
                className="text-white/[0.55] underline decoration-white/15 underline-offset-2 transition-colors hover:text-white/75"
                target="_blank"
                rel="noopener noreferrer"
              >
                CC BY 4.0
              </a>
            </p>
          </div>
        </div>
      </div>
    </footer>
  )
}
