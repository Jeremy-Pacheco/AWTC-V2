import { useState, useEffect } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import Logo from "../assets/awtc-logo.png";
// Served from public/ (a plain URL: importing public files breaks vitest)
const LogoWhite = "/awtc-logo-white.png";
import User from "../assets/user-solid-full.svg";
import UserWhite from "../assets/user-solid-white.svg";
import Hamburger from "hamburger-react";
import AuthModal from "./AuthModal";
import DarkModeToggle from "./DarkModeToggle";
import LanguageSelector from "./LanguageSelector";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/auth-context";

function NavBar() {
  const { t } = useTranslation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  // Session state comes from AuthProvider (single source for the app)
  const { isLoggedIn, logout } = useAuth();
  const [isDarkMode, setIsDarkMode] = useState(() => {
    return document.documentElement.classList.contains("dark");
  });

  const navigate = useNavigate();

  // listen for global requests to open the auth modal (from other pages/components)
  useEffect(() => {
    const handler = (e: Event) => {
      const custom = e as CustomEvent;
      const detail = custom.detail as { mode?: "login" | "signup" } | undefined;
      const mode = detail?.mode || "signup";
      openAuth(mode);
    };
    window.addEventListener("openAuthModal", handler as EventListener);
    return () => window.removeEventListener("openAuthModal", handler as EventListener);
  }, []);

  // Track dark mode changes
  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDarkMode(document.documentElement.classList.contains("dark"));
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  const openAuth = (mode: "login" | "signup") => {
    setAuthMode(mode);
    setAuthOpen(true);
  };

  const handleLogout = () => {
    // Single logout path: revokes the refresh token on the server (SEC-18),
    // then removes every stored auth item (BUG-09) and notifies the app
    void logout();
    navigate("/");
  };

  const links = [
    { to: "/home", label: t('nav.home') },
    { to: "/volunteering", label: t('nav.volunteering') },
    { to: "/moreinfo", label: t('nav.info') },
    { to: "/aboutus", label: t('nav.aboutUs') },
  ];
  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `rounded-full px-3.5 py-2 text-sm font-medium transition-colors ${
      isActive ? "bg-gray-100 text-gray-900 font-semibold" : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
    }`;
  const btnGhost = "rounded-full px-4 py-2 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-100";
  const btnOutline = "rounded-full border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-800 transition-colors hover:bg-gray-100";
  const btnPrimary = "rounded-full bg-brand px-4 py-2 text-sm font-semibold text-on-brand shadow-sm transition-colors hover:bg-brand-hover";

  return (
    <nav className="sticky top-0 z-30 border-b border-gray-200 bg-white dark:bg-[var(--nav-bg)]">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 md:px-6">
        <NavLink to="/home" className="flex shrink-0 items-center gap-2.5">
          <img src={isDarkMode ? LogoWhite : Logo} alt="Logo AWTC" className="h-9 w-9" />
          <span className="hidden text-base font-bold tracking-tight text-gray-900 lg:inline">A Will To Change</span>
        </NavLink>

        {/* desktop/tablet */}
        <div className="hidden md:flex items-center gap-1">
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} className={linkClass}>
              {l.label}
            </NavLink>
          ))}
        </div>

        <div className="hidden md:flex items-center gap-2">
          <DarkModeToggle />
          <LanguageSelector />
          <span className="mx-1 h-6 w-px bg-gray-200" aria-hidden="true" />
          {isLoggedIn ? (
            <>
              <button onClick={() => navigate("/dashboard")} className={btnOutline}>
                {t('common.profile')}
              </button>
              <button onClick={handleLogout} className={btnGhost}>
                {t('common.logout')}
              </button>
            </>
          ) : (
            <>
              <button onClick={() => openAuth("login")} className={btnGhost}>
                {t('common.login')}
              </button>
              <button onClick={() => openAuth("signup")} className={btnPrimary}>
                {t('common.signup')}
              </button>
            </>
          )}
        </div>

        {/* phone */}
        <div className="flex items-center gap-1 md:hidden">
          <button
            type="button"
            aria-label={isLoggedIn ? t('common.profile') : t('common.login')}
            onClick={() => (isLoggedIn ? navigate("/dashboard") : openAuth("login"))}
            className="grid h-10 w-10 place-items-center rounded-full hover:bg-gray-100"
          >
            <img src={isDarkMode ? UserWhite : User} alt="User Icon" className="h-6 w-6" />
          </button>
          <Hamburger toggled={menuOpen} toggle={setMenuOpen} size={22} color={isDarkMode ? "#ffffff" : "#16201b"} label="Menu" />
        </div>
      </div>

      {/* Phone drawer */}
      {menuOpen && (
        <div className="fixed inset-0 z-40 bg-black/40 md:hidden" onClick={() => setMenuOpen(false)} aria-hidden="true" />
      )}

      <div
        className={`fixed inset-y-0 right-0 z-50 flex w-80 max-w-[85vw] flex-col bg-[var(--card-bg)] p-6 shadow-2xl
        transform transition-transform duration-300 ease-in-out md:hidden
        ${menuOpen ? "translate-x-0" : "translate-x-full"}`}
      >
        <div className="flex items-center justify-between">
          <img src={isDarkMode ? LogoWhite : Logo} alt="" className="h-9 w-9" />
          <button
            className="grid h-10 w-10 place-items-center rounded-full text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900"
            onClick={() => setMenuOpen(false)}
            aria-label="Close menu"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="mt-8 flex flex-col gap-1">
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              onClick={() => setMenuOpen(false)}
              className={({ isActive }) =>
                `rounded-xl px-4 py-3 text-base font-medium transition-colors ${
                  isActive ? "bg-gray-100 font-semibold text-gray-900" : "text-gray-700 hover:bg-gray-100"
                }`
              }
            >
              {l.label}
            </NavLink>
          ))}
        </div>

        <div className="mt-6 flex items-center gap-2 px-1">
          <DarkModeToggle />
          <LanguageSelector />
        </div>

        <div className="mt-auto flex flex-col gap-3 border-t border-gray-200 pt-6">
          {isLoggedIn ? (
            <>
              <button onClick={() => { navigate("/dashboard"); setMenuOpen(false); }} className={`${btnOutline} w-full py-2.5`}>
                {t('common.profile')}
              </button>
              <button onClick={() => { handleLogout(); setMenuOpen(false); }} className={`${btnGhost} w-full py-2.5`}>
                {t('common.logout')}
              </button>
            </>
          ) : (
            <>
              <button onClick={() => { openAuth("login"); setMenuOpen(false); }} className={`${btnOutline} w-full py-2.5`}>
                {t('common.login')}
              </button>
              <button onClick={() => { openAuth("signup"); setMenuOpen(false); }} className={`${btnPrimary} w-full py-2.5`}>
                {t('common.signup')}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Popup Auth */}
      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} mode={authMode} />
    </nav>
  );
}

export default NavBar;
