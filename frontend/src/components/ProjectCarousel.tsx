import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { Project } from "../types/api";
import { imageUrl } from "../utils/images";

const API_URL = (import.meta.env.VITE_API_URL || "http://localhost:8080").replace(/\/+$/, "");
const MAX_SLIDES = 5;
/** Time each slide stays before moving to the next one */
export const AUTOPLAY_MS = 5000;

function Chevron({ dir }: { dir: "left" | "right" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d={dir === "left" ? "M15 18l-6-6 6-6" : "M9 6l6 6-6 6"} />
    </svg>
  );
}

/**
 * Featured projects on the home page: one large slide at a time with the
 * project photo, its category, place and dates, and a link to it.
 * Moves on by itself every AUTOPLAY_MS (a manual move restarts the count),
 * with a pause/play button (WCAG 2.2.2) and paused while the tab is hidden.
 * With reduced motion it still advances, without the slide animation.
 * Supports arrows, dots, keyboard and swipe.
 */
export default function ProjectCarousel() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [current, setCurrent] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [tabHidden, setTabHidden] = useState(() => typeof document !== "undefined" && document.hidden);
  const touchX = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_URL}/api/projects`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data: Project[]) => {
        if (cancelled || !Array.isArray(data)) return;
        const active = data.filter((p) => !p.status || p.status === "active");
        // Projects with a photo first
        active.sort((a, b) => Number(!!b.filename) - Number(!!a.filename));
        setProjects(active.slice(0, MAX_SLIDES));
      })
      .catch(() => !cancelled && setProjects([]));
    return () => {
      cancelled = true;
    };
  }, []);

  const count = projects?.length ?? 0;
  const go = useCallback((i: number) => setCurrent(count ? (i + count) % count : 0), [count]);
  const prev = () => go(current - 1);
  const next = useCallback(() => go(current + 1), [go, current]);

  useEffect(() => {
    const onVisibility = () => setTabHidden(document.hidden);
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  // One timer per slide: moving by hand (arrows, dots, swipe) restarts it
  useEffect(() => {
    if (!playing || tabHidden || count < 2) return;
    const id = window.setTimeout(next, AUTOPLAY_MS);
    return () => window.clearTimeout(id);
  }, [playing, tabHidden, count, next, current]);

  const formatDate = (value?: string | null) =>
    value ? new Date(value).toLocaleDateString(i18n.language, { day: "numeric", month: "short" }) : null;

  if (projects === null) {
    return <div className="mt-6 h-[340px] md:h-[440px] rounded-3xl bg-gray-100 animate-pulse" aria-hidden="true" />;
  }

  if (count === 0) {
    return (
      <div className="mt-6 rounded-3xl border border-dashed border-gray-300 py-16 text-center text-gray-500">
        {t("home.carousel.empty")}
      </div>
    );
  }

  return (
    <section
      className="mt-6"
      aria-roledescription="carousel"
      aria-label={t("home.newestProjects")}
      onKeyDown={(e) => {
        if (e.key === "ArrowLeft") prev();
        if (e.key === "ArrowRight") next();
      }}
    >
      <div
        className="relative overflow-hidden rounded-3xl bg-gray-900 shadow-xl"
        onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
        onTouchEnd={(e) => {
          if (touchX.current === null) return;
          const dx = e.changedTouches[0].clientX - touchX.current;
          if (Math.abs(dx) > 40) (dx > 0 ? prev : next)();
          touchX.current = null;
        }}
      >
        <div
          className="flex transition-transform duration-700 ease-out motion-reduce:transition-none"
          style={{ transform: `translateX(-${current * 100}%)` }}
        >
          {projects.map((p, i) => {
            const start = formatDate(p.start_date);
            const end = formatDate(p.end_date);
            return (
              <article
                key={p.id}
                className="relative w-full shrink-0 h-[340px] md:h-[440px]"
                aria-roledescription="slide"
                aria-label={t("home.carousel.slide", { n: i + 1, total: count })}
                aria-hidden={i !== current}
              >
                {p.filename ? (
                  <img
                    src={imageUrl(p.filename)}
                    alt=""
                    className="absolute inset-0 h-full w-full object-cover"
                    loading={i === 0 ? "eager" : "lazy"}
                  />
                ) : (
                  <div className="absolute inset-0 bg-gradient-to-br from-brand-700 via-brand-800 to-gray-900" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-black/0" />

                <div className="absolute inset-x-0 bottom-0 p-6 md:p-10 max-w-3xl">
                  {p.category?.name && (
                    <span className="inline-block rounded-full bg-brand px-3 py-1 text-xs font-semibold uppercase tracking-wide text-on-brand">
                      {p.category.name}
                    </span>
                  )}
                  <h3 className="mt-3 text-2xl md:text-4xl font-bold leading-tight !text-white">{p.name}</h3>
                  {p.description && (
                    <p className="mt-2 text-sm md:text-base !text-white/85 text-left line-clamp-2">{p.description}</p>
                  )}
                  <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm !text-white/80">
                    {p.location && (
                      <span className="inline-flex items-center gap-1.5">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4" aria-hidden="true">
                          <path d="M12 21s-7-6.2-7-11a7 7 0 1114 0c0 4.8-7 11-7 11z" />
                          <circle cx="12" cy="10" r="2.5" />
                        </svg>
                        {p.location}
                      </span>
                    )}
                    {start && (
                      <span className="inline-flex items-center gap-1.5">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4" aria-hidden="true">
                          <rect x="3" y="5" width="18" height="16" rx="2" />
                          <path d="M16 3v4M8 3v4M3 11h18" />
                        </svg>
                        {end && end !== start ? `${start} – ${end}` : start}
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    tabIndex={i === current ? 0 : -1}
                    onClick={() => navigate(`/volunteering?project=${p.id}`)}
                    className="mt-5 inline-flex items-center gap-2 rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-on-brand shadow-lg transition hover:bg-brand-hover hover:gap-3"
                  >
                    {t("home.carousel.viewProject")}
                    <Chevron dir="right" />
                  </button>
                </div>
              </article>
            );
          })}
        </div>

        {count > 1 && (
          <div className="absolute right-4 top-4 md:top-auto md:bottom-8 md:right-8 flex gap-2">
            <button
              type="button"
              onClick={() => setPlaying((p) => !p)}
              aria-label={playing ? t("home.carousel.pause") : t("home.carousel.play")}
              aria-pressed={!playing}
              className="grid h-11 w-11 place-items-center rounded-full border border-white/25 bg-black/35 !text-white backdrop-blur-sm transition hover:bg-black/60"
            >
              {playing ? (
                <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4" aria-hidden="true"><path d="M8 5.5v13a1 1 0 001.5.86l10.5-6.5a1 1 0 000-1.72L9.5 4.64A1 1 0 008 5.5z" /></svg>
              )}
            </button>
            <button
              type="button"
              onClick={prev}
              aria-label={t("home.carousel.previous")}
              className="grid h-11 w-11 place-items-center rounded-full border border-white/25 bg-black/35 !text-white backdrop-blur-sm transition hover:bg-black/60"
            >
              <Chevron dir="left" />
            </button>
            <button
              type="button"
              onClick={next}
              aria-label={t("home.carousel.next")}
              className="grid h-11 w-11 place-items-center rounded-full border border-white/25 bg-black/35 !text-white backdrop-blur-sm transition hover:bg-black/60"
            >
              <Chevron dir="right" />
            </button>
          </div>
        )}
      </div>

      {count > 1 && (
        <div className="mt-4 flex justify-center gap-2">
          {projects.map((p, i) => (
            <button
              key={p.id}
              type="button"
              onClick={() => go(i)}
              aria-label={t("home.carousel.goTo", { name: p.name })}
              aria-current={i === current}
              className={`h-2 rounded-full transition-all duration-300 ${
                i === current ? "w-8 bg-brand" : "w-2 bg-gray-300 hover:bg-gray-400"
              }`}
            />
          ))}
        </div>
      )}
    </section>
  );
}
