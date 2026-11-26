import React, { useEffect, useState } from "react";
import { errorMessage } from '../types/api';
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import PageHeader from "../components/PageHeader";
import AlertModal from "../components/AlertModal";

const AboutUs: React.FC = () => {
  const { t } = useTranslation();
  const [alertOpen, setAlertOpen] = useState(false);
  const [alertMessage, setAlertMessage] = useState("");
  const navigate = useNavigate();

  const handleBecomeVolunteer = () => {
    const token = localStorage.getItem("jwtToken");
    if (token) {
      // User is logged in, go to volunteering page
      navigate("/volunteering");
    } else {
      // User is not logged in, open signup modal
      window.dispatchEvent(new CustomEvent("openAuthModal", { detail: { mode: "signup" } }));
    }
  };

  useEffect(() => {
    if (window.location.hash) {
      const element = document.querySelector(window.location.hash);
      if (element) {
        setTimeout(() => {
          element.scrollIntoView({ behavior: "smooth" });
        }, 100);
      }
    }
  }, []);

  const field =
    "w-full rounded-xl border border-gray-300 bg-[var(--card-bg)] px-3.5 py-2.5 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/25";
  const label = "mb-1.5 block text-sm font-medium text-gray-700";

  return (
    <div className="min-h-[80vh]">
      <PageHeader eyebrow={t('nav.aboutUs')} title={t('aboutUs.headerTitle')} subtitle={t('home.aboutUsDescription')} />

      <main className="max-w-6xl mx-auto px-4 md:px-6 py-12 md:py-16 space-y-16 md:space-y-24">
        {/* About Us */}
        <section className="grid items-center gap-8 md:grid-cols-2 md:gap-14">
          <div>
            <span className="text-xs font-semibold uppercase tracking-widest text-brand-text">{t('aboutUs.whoEyebrow')}</span>
            <h2 className="mt-2 text-3xl md:text-4xl font-bold tracking-tight">{t('aboutUs.title')}</h2>
            <p className="mt-5 text-left leading-relaxed text-gray-700">{t('aboutUs.description1')}</p>
            <p className="mt-4 text-left leading-relaxed text-gray-700">{t('aboutUs.description2')}</p>
          </div>
          <img
            src="/aboutUs/aboutUs.jpg"
            alt="About AWTC"
            className="h-72 md:h-96 w-full rounded-3xl object-cover shadow-lg"
            style={{ objectPosition: "center 20%" }}
          />
        </section>

        {/* Our mission */}
        <section className="grid items-center gap-8 md:grid-cols-2 md:gap-14">
          <img
            src="/aboutUs/mision.jpg"
            alt="Our mission"
            className="order-2 md:order-1 h-72 md:h-96 w-full rounded-3xl object-cover shadow-lg"
          />
          <div className="order-1 md:order-2">
            <span className="text-xs font-semibold uppercase tracking-widest text-brand-text">{t('aboutUs.missionEyebrow')}</span>
            <h2 className="mt-2 text-3xl md:text-4xl font-bold tracking-tight">{t('aboutUs.missionTitle')}</h2>
            <p className="mt-5 text-left leading-relaxed text-gray-700">{t('aboutUs.missionDescription1')}</p>
            <p className="mt-4 text-left leading-relaxed text-gray-700">{t('aboutUs.missionDescription2')}</p>
          </div>
        </section>

        {/* Join the team */}
        <section className="relative isolate overflow-hidden rounded-3xl bg-gradient-to-br from-brand-700 to-gray-950 px-6 py-12 md:px-14 md:py-16 text-center">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight !text-white">{t('aboutUs.joinTeamTitle')}</h2>
          <p className="mx-auto mt-4 max-w-2xl text-center !text-white/85">{t('aboutUs.joinTeamDescription')}</p>
          <button
            onClick={handleBecomeVolunteer}
            className="mt-8 inline-flex rounded-full bg-brand px-7 py-3 font-semibold text-on-brand shadow-lg transition-colors hover:bg-brand-hover"
          >
            {t('aboutUs.becomeVolunteer')}
          </button>
        </section>

        {/* Contact us */}
        <section id="contact-section" className="grid gap-8 md:grid-cols-[1fr_1.4fr] md:gap-14">
          <div>
            <span className="text-xs font-semibold uppercase tracking-widest text-brand-text">{t('footer.contact')}</span>
            <h2 className="mt-2 text-3xl md:text-4xl font-bold tracking-tight">{t('aboutUs.contactTitle')}</h2>
            <p className="mt-4 text-left leading-relaxed text-gray-600">{t('aboutUs.contactDescription')}</p>
          </div>

          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const form = e.target as HTMLFormElement;
              const formData = new FormData(form);
              const body = Object.fromEntries(Array.from(formData.entries(), ([key, value]) => [key, String(value)]));

              try {
                const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:8080';
                const res = await fetch(`${apiBase}/api/contacts`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(body),
                });

                if (!res.ok) {
                  const text = await res.text();
                  throw new Error(text || res.statusText || 'Network error');
                }
                setAlertMessage(t('aboutUs.messageSent'));
                setAlertOpen(true);
                form.reset();
              } catch (err) {
                setAlertMessage(t('aboutUs.messageFailed') + errorMessage(err, String(err)));
                setAlertOpen(true);
              }
            }}
            className="grid grid-cols-1 gap-4 rounded-3xl border border-gray-200 bg-[var(--card-bg)] p-6 md:p-8 shadow-sm sm:grid-cols-2"
          >
            <div>
              <label htmlFor="contact-name" className={label}>{t('aboutUs.namePlaceholder')}</label>
              <input id="contact-name" name="name" autoComplete="name" className={field} required />
            </div>
            <div>
              <label htmlFor="contact-email" className={label}>{t('aboutUs.emailPlaceholder')}</label>
              <input id="contact-email" name="email" type="email" autoComplete="email" className={field} required />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="contact-subject" className={label}>{t('aboutUs.subjectPlaceholder')}</label>
              <input id="contact-subject" name="subject" className={field} />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="contact-message" className={label}>{t('aboutUs.messagePlaceholder')}</label>
              <textarea id="contact-message" name="message" className={`${field} h-36 resize-y`} required />
            </div>
            <div className="sm:col-span-2 flex justify-end">
              <button
                type="submit"
                className="inline-flex rounded-full bg-brand px-6 py-2.5 font-semibold text-on-brand shadow-sm transition-colors hover:bg-brand-hover"
              >
                {t('aboutUs.sendMessage')}
              </button>
            </div>
          </form>
        </section>
      </main>

      <AlertModal open={alertOpen} message={alertMessage} onAccept={() => setAlertOpen(false)} />
    </div>
  );
};

export default AboutUs;
