import React from "react";
import { useTranslation } from "react-i18next";
import LegalPage, { type LegalSection } from "../components/LegalPage";

const Privacy: React.FC = () => {
  const { t } = useTranslation();
  const sections: LegalSection[] = [
    { id: 'introduction', title: t('privacy.introductionTitle'), content: <><p>{t('privacy.introductionContent')}</p></> },
    { id: 'informationCollect', title: t('privacy.informationCollectTitle'), content: <><p>{t('privacy.informationCollectContent')}</p></> },
    { id: 'howWeUse', title: t('privacy.howWeUseTitle'), content: <><p>{t('privacy.howWeUseContent')}</p></> },
    { id: 'cookies', title: t('privacy.cookiesTitle'), content: <><p>{t('privacy.cookiesContent')}</p></> },
    { id: 'thirdParty', title: t('privacy.thirdPartyTitle'), content: <><p>{t('privacy.thirdPartyContent')}</p></> },
    { id: 'security', title: t('privacy.securityTitle'), content: <><p>{t('privacy.securityContent')}</p></> },
    { id: 'yourRights', title: t('privacy.yourRightsTitle'), content: <><p>{t('privacy.yourRightsContent')}</p></> },
    { id: 'changes', title: t('privacy.changesTitle'), content: <><p>{t('privacy.changesContent')}</p></> },
    { id: 'contact', title: t('privacy.contactTitle'), content: <><p>{t('privacy.contactContent')} <a href="mailto:info@awtc.es">info@awtc.es</a>.</p></> },
  ];
  return <LegalPage title={t('privacy.heroTitle')} subtitle={t('legal.privacySubtitle')} sections={sections} />;
};

export default Privacy;
