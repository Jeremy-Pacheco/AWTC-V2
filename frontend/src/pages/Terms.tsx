import React from "react";
import { useTranslation } from "react-i18next";
import LegalPage, { type LegalSection } from "../components/LegalPage";

const Terms: React.FC = () => {
  const { t } = useTranslation();
  const sections: LegalSection[] = [
    { id: 'acceptance', title: t('terms.acceptanceTitle'), content: <><p>{t('terms.acceptanceContent')}</p></> },
    { id: 'usingService', title: t('terms.usingServiceTitle'), content: <><p>{t('terms.usingServiceContent')}</p></> },
    { id: 'accounts', title: t('terms.accountsTitle'), content: <><p>{t('terms.accountsContent')}</p></> },
    { id: 'intellectualProperty', title: t('terms.intellectualPropertyTitle'), content: <><p>{t('terms.intellectualPropertyContent')}</p></> },
    { id: 'limitation', title: t('terms.limitationTitle'), content: <><p>{t('terms.limitationContent')}</p></> },
    { id: 'termination', title: t('terms.terminationTitle'), content: <><p>{t('terms.terminationContent')}</p></> },
    { id: 'governingLaw', title: t('terms.governingLawTitle'), content: <><p>{t('terms.governingLawContent')}</p></> },
    { id: 'contact', title: t('terms.contactTitle'), content: <><p>{t('terms.contactContent')} <a href="mailto:info@awtc.es">info@awtc.es</a>.</p></> },
  ];
  return <LegalPage title={t('terms.heroTitle')} subtitle={t('legal.termsSubtitle')} sections={sections} />;
};

export default Terms;
