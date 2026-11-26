import type { ReactNode } from "react";

interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  /** Background photo; omit for a plain brand gradient */
  image?: string;
  children?: ReactNode;
}

/**
 * Header of the inner pages: photo with a dark overlay (same look as the
 * home hero, shorter), eyebrow, title and subtitle.
 */
export default function PageHeader({ eyebrow, title, subtitle, image = "/hero-img.jpg", children }: PageHeaderProps) {
  return (
    <header className="relative isolate overflow-hidden">
      {image ? (
        <img src={image} alt="" className="absolute inset-0 -z-10 h-full w-full object-cover" />
      ) : null}
      <div
        className={`absolute inset-0 -z-10 ${
          image ? "bg-gradient-to-r from-black/80 via-black/60 to-black/35" : "bg-gradient-to-br from-brand-800 to-gray-950"
        }`}
      />
      <div className="max-w-6xl mx-auto px-4 md:px-6 py-14 md:py-20">
        {eyebrow && (
          <span className="inline-block rounded-full border border-brand-300/50 bg-brand-900/40 px-3 py-1 text-xs font-semibold uppercase tracking-widest !text-brand-200">
            {eyebrow}
          </span>
        )}
        <h1 className="mt-4 max-w-3xl text-3xl md:text-5xl font-bold leading-tight tracking-tight !text-white">{title}</h1>
        {subtitle && <p className="mt-3 max-w-2xl text-left text-base md:text-lg !text-white/85">{subtitle}</p>}
        {children}
      </div>
    </header>
  );
}
