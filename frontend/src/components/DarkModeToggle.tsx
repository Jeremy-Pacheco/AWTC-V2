import { useState, useEffect, useId } from "react";
import { useTranslation } from "react-i18next";
import { VENOM_MASK, VENOM_CORE } from "./venomMask";
import "./DarkModeToggle.css";

type ViewTransitionDoc = Document & {
  startViewTransition?: (update: () => void) => { ready: Promise<void> };
};

function readInitialTheme() {
  try {
    const saved = localStorage.getItem("darkMode");
    if (saved !== null) return saved === "true";
  } catch {
    /* storage blocked: fall back to the system preference */
  }
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
}

function DarkModeToggle() {
  const { t } = useTranslation();
  const [isDark, setIsDark] = useState(readInitialTheme);
  const maskId = `theme-toggle-moon-${useId().replace(/:/g, "")}`;

  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark);
    try {
      localStorage.setItem("darkMode", String(isDark));
    } catch {
      /* ignore */
    }
  }, [isDark]);

  // Keep every toggle instance (desktop + mobile menu) in sync
  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains("dark"));
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  const handleToggle = (e: React.MouseEvent<HTMLButtonElement>) => {
    const next = !isDark;
    const apply = () => {
      document.documentElement.classList.toggle("dark", next);
      setIsDark(next);
    };

    const doc = document as ViewTransitionDoc;
    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (!doc.startViewTransition || reduceMotion) {
      apply();
      return;
    }

    // The new theme spreads from the button like a venom splat: an organic
    // mask with tendrils that grows until its solid core covers the screen.
    const rect = e.currentTarget.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const farthest = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
    const size = ((farthest * 2) / VENOM_CORE) * 1.05;

    const root = document.documentElement;
    root.style.setProperty("--venom-mask", VENOM_MASK);
    const transition = doc.startViewTransition(apply);
    transition.ready
      .then(() => {
        root.animate(
          {
            maskSize: ["0px 0px", `${size * 0.35}px ${size * 0.35}px`, `${size}px ${size}px`],
            maskPosition: [
              `${x}px ${y}px`,
              `${x - (size * 0.35) / 2}px ${y - (size * 0.35) / 2}px`,
              `${x - size / 2}px ${y - size / 2}px`,
            ],
          },
          {
            duration: 1500,
            fill: "both",
            easing: "cubic-bezier(0.7, 0, 0.3, 1)",
            pseudoElement: "::view-transition-new(root)",
          },
        );
      })
      .catch(() => {
        /* transition skipped: the theme is already applied */
      });
  };

  return (
    <button
      type="button"
      onClick={handleToggle}
      className="theme-toggle"
      aria-label={isDark ? t("common.themeLight") : t("common.themeDark")}
      aria-pressed={isDark}
      title={isDark ? t("common.themeLight") : t("common.themeDark")}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true" className={`theme-toggle__icon ${isDark ? "is-dark" : ""}`}>
        <mask id={maskId}>
          <rect width="24" height="24" fill="#fff" />
          <circle className="theme-toggle__cut" cx="24" cy="2" r="7" fill="#000" />
        </mask>
        <circle className="theme-toggle__core" cx="12" cy="12" r="5" mask={`url(#${maskId})`} fill="currentColor" />
        <g className="theme-toggle__rays" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <line x1="12" y1="1.5" x2="12" y2="3.5" />
          <line x1="12" y1="20.5" x2="12" y2="22.5" />
          <line x1="1.5" y1="12" x2="3.5" y2="12" />
          <line x1="20.5" y1="12" x2="22.5" y2="12" />
          <line x1="4.6" y1="4.6" x2="6" y2="6" />
          <line x1="18" y1="18" x2="19.4" y2="19.4" />
          <line x1="4.6" y1="19.4" x2="6" y2="18" />
          <line x1="18" y1="6" x2="19.4" y2="4.6" />
        </g>
      </svg>
    </button>
  );
}

export default DarkModeToggle;
