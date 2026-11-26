import { NavLink } from "react-router-dom";
import { useTranslation } from "react-i18next";

// Served from public/ (a plain URL: importing public files breaks vitest).
// The footer is always dark, so it always uses the white logo.
const LogoWhite = "/awtc-logo-white.png";

const SOCIAL = [
  {
    label: "Facebook",
    path: "M22 12a10 10 0 10-11.5 9.9v-7h-2.2v-2.9h2.2V9.4c0-2.2 1.3-3.4 3.3-3.4.96 0 1.97.17 1.97.17v2.2h-1.13c-1.12 0-1.47.69-1.47 1.4v1.7h2.5l-.4 2.9h-2.1v7A10 10 0 0022 12z",
  },
  {
    label: "Twitter",
    path: "M22 5.92c-.63.28-1.3.47-2 .55a3.48 3.48 0 001.53-1.93 6.94 6.94 0 01-2.2.84 3.47 3.47 0 00-5.92 3.16A9.86 9.86 0 013 4.79a3.47 3.47 0 001.07 4.63c-.52-.02-1.02-.16-1.45-.4v.04a3.47 3.47 0 002.78 3.4c-.43.12-.88.12-1.33.05.38 1.18 1.48 2.04 2.78 2.06A6.96 6.96 0 012 19.54a9.84 9.84 0 005.33 1.56c6.4 0 9.9-5.3 9.9-9.9v-.45A7.07 7.07 0 0022 5.92z",
  },
  {
    label: "Instagram",
    path: "M7 2h10a5 5 0 015 5v10a5 5 0 01-5 5H7a5 5 0 01-5-5V7a5 5 0 015-5zm5 6.2A4.8 4.8 0 1016.8 13 4.8 4.8 0 0012 8.2zm6.5-2.7a1.2 1.2 0 11-1.2 1.2 1.2 1.2 0 011.2-1.2z",
  },
];

function Footer() {
  const { t } = useTranslation();

  const handleNavClick = () => {
    window.scrollTo(0, 0);
  };

  const handleContactClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    window.location.href = "/aboutus#contact-section";
  };

  const link = "text-sm !text-white/70 transition-colors hover:!text-white";
  const heading = "mb-4 text-xs font-semibold uppercase tracking-widest !text-white/50";

  return (
    <footer className="mt-16 bg-[var(--footer-bg)]">
      <div className="mx-auto max-w-7xl px-4 md:px-6 py-14">
        <div className="grid grid-cols-2 gap-10 md:grid-cols-[1.5fr_1fr_1fr_1fr]">
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2.5">
              <img src={LogoWhite} alt="AWTC Logo" className="h-10 w-10" />
              <span className="text-base font-bold tracking-tight !text-white">A Will To Change</span>
            </div>
            <p className="mt-4 max-w-xs text-left text-sm !text-white/70">{t('footer.tagline')}</p>
            <div className="mt-5 flex gap-2">
              {SOCIAL.map((s) => (
                <a
                  key={s.label}
                  href="#"
                  aria-label={s.label}
                  className="grid h-9 w-9 place-items-center rounded-full border border-white/15 !text-white/70 transition-colors hover:border-white/40 hover:!text-white"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true">
                    <path d={s.path} />
                  </svg>
                </a>
              ))}
            </div>
          </div>

          <div>
            <h3 className={heading}>{t('footer.explore')}</h3>
            <ul className="space-y-3">
              <li><NavLink to="/home" className={link} onClick={handleNavClick}>{t('nav.home')}</NavLink></li>
              <li><NavLink to="/volunteering" className={link} onClick={handleNavClick}>{t('nav.volunteering')}</NavLink></li>
              <li><NavLink to="/moreinfo" className={link} onClick={handleNavClick}>{t('nav.info')}</NavLink></li>
            </ul>
          </div>

          <div>
            <h3 className={heading}>{t('footer.company')}</h3>
            <ul className="space-y-3">
              <li><NavLink to="/aboutus" className={link} onClick={handleNavClick}>{t('nav.aboutUs')}</NavLink></li>
              <li><a href="/aboutus#contact-section" className={link} onClick={handleContactClick}>{t('footer.contact')}</a></li>
            </ul>
          </div>

          <div>
            <h3 className={heading}>{t('footer.legal')}</h3>
            <ul className="space-y-3">
              <li><NavLink to="/terms" className={link} onClick={handleNavClick}>{t('footer.terms')}</NavLink></li>
              <li><NavLink to="/privacy" className={link} onClick={handleNavClick}>{t('footer.privacy')}</NavLink></li>
            </ul>
          </div>
        </div>

        <div className="mt-12 border-t border-white/10 pt-6 text-xs !text-white/50">
          {t('footer.copyright', { year: new Date().getFullYear() })}
        </div>
      </div>
    </footer>
  );
}

export default Footer;
