import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

type Opportunity = {
  id: number;
  title: string;
  description: string;
  url: string;
  organization: {
    name: string;
    url: string;
    logo?: string;
  };
  dates?: string;
};

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

function VolunteerList() {
  const { t } = useTranslation();
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_URL}/api/external/volunteering`)
      .then((response) => {
        if (!response.ok) throw new Error("HTTP error: " + response.status);
        return response.json();
      })
      .then((data) => {
        setOpportunities(data.results || []);
      })
      .catch((err) => {
        setError(err.message);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  if (loading)
    return (
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-64 animate-pulse rounded-2xl bg-gray-100" />
        ))}
      </div>
    );

  if (error)
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
        <p className="text-center font-semibold text-red-700">{t('moreInfo.loadError')}</p>
        <p className="mt-2 text-center text-sm text-red-600">{error}</p>
      </div>
    );

  if (!opportunities.length)
    return (
      <div className="rounded-2xl border border-dashed border-gray-300 p-10 text-center">
        <p className="text-center font-semibold text-gray-700">{t('moreInfo.empty')}</p>
        <p className="mt-2 text-center text-sm text-gray-500">{t('moreInfo.tryLater')}</p>
      </div>
    );

  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {opportunities.map((item) => (
        <article
          key={item.id}
          className="flex h-full flex-col rounded-2xl border border-gray-200 bg-[var(--card-bg)] p-5 shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-xl"
        >
          <a
            href={item.organization.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex w-fit items-center gap-2 rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-text hover:underline"
          >
            {item.organization.name}
          </a>
          <h3 className="mt-3 text-lg font-bold leading-snug line-clamp-2">{item.title}</h3>
          <p className="mt-2 flex-1 text-left text-sm leading-relaxed text-gray-700 line-clamp-4">{item.description}</p>
          {item.dates && (
            <p className="mt-4 inline-flex items-center gap-1.5 text-left text-xs text-gray-500">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4 shrink-0" aria-hidden="true">
                <rect x="3" y="5" width="18" height="16" rx="2" />
                <path d="M16 3v4M8 3v4M3 11h18" />
              </svg>
              {item.dates}
            </p>
          )}
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-5 inline-flex items-center justify-center gap-2 rounded-full border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-800 transition-colors hover:border-brand hover:bg-brand-50 hover:text-brand-text"
          >
            {t('moreInfo.viewDetails')}
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4" aria-hidden="true">
              <path d="M14 4h6v6M20 4l-9 9M18 14v6H4V6h6" />
            </svg>
          </a>
        </article>
      ))}
    </div>
  );
}

export default VolunteerList;
