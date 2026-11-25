import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getDemoConfig } from '../utils/demo';

const DISMISS_KEY = 'demoBannerClosed';

/** "Test site" notice, only rendered when the backend runs with DEMO_MODE=true. */
const DemoBanner = () => {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let active = true;
    let dismissed = false;
    try { dismissed = sessionStorage.getItem(DISMISS_KEY) === 'true'; } catch { /* storage unavailable (private mode) */ }
    if (dismissed) return;
    getDemoConfig().then((config) => {
      if (active && config.enabled) setVisible(true);
    });
    return () => { active = false; };
  }, []);

  if (!visible) return null;

  const handleClose = () => {
    setVisible(false);
    // Per tab session only: the notice comes back on the next visit
    try { sessionStorage.setItem(DISMISS_KEY, 'true'); } catch { /* storage unavailable (private mode) */ }
  };

  return (
    <div role="status" className="w-full bg-ink text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2 flex items-center gap-3">
        <span className="shrink-0 rounded-full bg-brand text-black text-xs font-bold uppercase px-2 py-0.5">
          {t('demo.badge')}
        </span>
        <p className="flex-1 text-sm !text-white">{t('demo.bannerText')}</p>
        <button
          onClick={handleClose}
          className="shrink-0 p-1 rounded-md hover:bg-white/10 transition-colors"
          aria-label={t('demo.closeBanner')}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
};

export default DemoBanner;
