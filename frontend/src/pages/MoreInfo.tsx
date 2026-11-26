import { useTranslation } from "react-i18next";
import PageHeader from "../components/PageHeader";
import VolunteerList from "../components/VolunteerList";

function MoreInfo() {
  const { t } = useTranslation();

  return (
    <>
      <PageHeader hero="info" eyebrow={t('moreInfo.eyebrow')} title={t('moreInfo.heroTitle')} subtitle={t('moreInfo.exploreSubtitle')} />

      <main className="max-w-6xl mx-auto px-4 md:px-6 py-12 md:py-16">
        <div className="mb-8">
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight">{t('moreInfo.exploreTitle')}</h2>
          <p className="mt-1 text-left text-base text-gray-600">{t('moreInfo.externalNote')}</p>
        </div>
        <VolunteerList />
      </main>
    </>
  );
}

export default MoreInfo;
