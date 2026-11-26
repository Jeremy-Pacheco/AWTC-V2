import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import PageHeader from "./PageHeader";

export interface LegalSection {
  id: string;
  title: string;
  content: ReactNode;
}

/**
 * Layout of the legal pages (privacy, terms): header, a sticky table of
 * contents on wide screens and numbered sections.
 */
export default function LegalPage({ title, subtitle, sections }: { title: string; subtitle?: string; sections: LegalSection[] }) {
  const { t } = useTranslation();
  return (
    <div className="min-h-[80vh]">
      <PageHeader eyebrow={t('legal.eyebrow')} title={title} subtitle={subtitle} />

      <div className="max-w-6xl mx-auto grid gap-10 px-4 md:px-6 py-12 md:py-16 lg:grid-cols-[220px_minmax(0,1fr)]">
        <nav aria-label={t('legal.onThisPage')} className="hidden lg:block">
          <div className="sticky top-24">
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-500">{t('legal.onThisPage')}</p>
            <ol className="mt-3 space-y-1 border-l border-gray-200">
              {sections.map((s) => (
                <li key={s.id}>
                  <a
                    href={`#${s.id}`}
                    className="-ml-px block border-l-2 border-transparent py-1 pl-4 text-sm text-gray-600 transition-colors hover:border-brand hover:text-brand-text"
                  >
                    {s.title}
                  </a>
                </li>
              ))}
            </ol>
          </div>
        </nav>

        <main className="max-w-3xl">
          {sections.map((s, i) => (
            <section key={s.id} id={s.id} className="scroll-mt-24 border-t border-gray-200 py-8 first:border-t-0 first:pt-0">
              <div className="flex items-baseline gap-4">
                <span className="text-sm font-semibold tabular-nums text-brand-text">{String(i + 1).padStart(2, "0")}</span>
                <h2 className="text-xl md:text-2xl font-bold tracking-tight">{s.title}</h2>
              </div>
              <div className="mt-3 pl-0 md:pl-9 text-left leading-relaxed text-gray-700 [&_p]:text-left [&_p]:text-base [&_a]:font-medium [&_a]:text-brand-text [&_a]:underline">
                {s.content}
              </div>
            </section>
          ))}
        </main>
      </div>
    </div>
  );
}
