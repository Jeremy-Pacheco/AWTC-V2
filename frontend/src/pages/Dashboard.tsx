import React, { useEffect, useState } from "react";
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import ConfirmModal from '../components/ConfirmModal';
import { handleAuthFetch } from '../utils/auth';
import type { AppUser, Category } from '../types/api';
import { API_URL, adminDashboardUrl, type DashboardUser, type StatusMessage, type TabProps } from './dashboard/shared';
import ProfileTab from './dashboard/ProfileTab';
import ProjectsTab from './dashboard/ProjectsTab';
import MyProjectsTab from './dashboard/MyProjectsTab';
import ReviewsTab from './dashboard/ReviewsTab';
import UsersTab from './dashboard/UsersTab';
import ContactsTab from './dashboard/ContactsTab';
import CategoriesTab from './dashboard/CategoriesTab';
import TabIcon from './dashboard/TabIcon';
import * as ui from './dashboard/ui';
import { imageUrl } from '../utils/images';

type Tab = "profile" | "myprojects" | "projects" | "users" | "contacts" | "categories" | "reviews";

/**
 * User dashboard shell: loads the signed-in user, renders the tab bar and the
 * active tab (pages/dashboard/*), and owns the shared pieces: status message,
 * confirmation dialog, and the categories / users lists used by several tabs.
 */
const Dashboard: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [user, setUser] = useState<DashboardUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("profile");
  // Tabs stay mounted once opened (hidden when inactive), so switching back
  // is instant instead of fetching everything again (the API is far away).
  const [mountedTabs, setMountedTabs] = useState<ReadonlySet<Tab>>(() => new Set<Tab>(["profile"]));
  const [statusMessage, setStatusMessage] = useState<StatusMessage>(null);
  const [confirmModal, setConfirmModal] = useState<{ open: boolean; title?: string; message?: string; onConfirm?: (() => void) | null; danger?: boolean }>({ open: false, title: '', message: '', onConfirm: null, danger: false });
  // Shared by several tabs (projects use categories and the coordinators list)
  const [categories, setCategories] = useState<Category[]>([]);
  const [usersData, setUsersData] = useState<AppUser[]>([]);

  // Load the signed-in user from the API (falls back to the stored profile)
  useEffect(() => {
    const storedToken = localStorage.getItem("jwtToken");
    if (!storedToken) return;
    setToken(storedToken);

    const fetchUser = async () => {
      try {
        const res = await handleAuthFetch(`${API_URL}/api/users/dashboard`, {
          headers: { Authorization: `Bearer ${storedToken}` },
        });
        if (!res.ok) throw new Error("Failed to fetch user data");
        const data = await res.json();
        setUser(data.user);
        localStorage.setItem("userName", data.user.name);
        localStorage.setItem("userRole", data.user.role);
        localStorage.setItem("userEmail", data.user.email || "");
        if (data.user.profileImage) localStorage.setItem("userProfileImage", data.user.profileImage);
      } catch (err) {
        console.error("Error fetching user:", err);
        const storedName = localStorage.getItem("userName");
        const storedRole = localStorage.getItem("userRole");
        if (storedName && storedRole) {
          setUser({
            id: 0,
            name: storedName,
            role: storedRole,
            email: localStorage.getItem("userEmail") || "",
            profileImage: localStorage.getItem("userProfileImage") || undefined,
          });
        }
      }
    };
    fetchUser();
  }, []);

  // Clear status messages automatically after 4 seconds
  useEffect(() => {
    if (!statusMessage) return;
    const id = setTimeout(() => setStatusMessage(null), 4000);
    return () => clearTimeout(id);
  }, [statusMessage]);

  // Shared lists
  useEffect(() => {
    if (!token || !user) return;
    fetch(`${API_URL}/api/categories`).then(r => r.json()).then(setCategories).catch(console.error);
    if (user.role === 'admin') {
      fetch(`${API_URL}/api/users`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()).then(setUsersData).catch(console.error);
    }
  }, [token, user]);

  // Shortly after the user is loaded, mount the rest of the role's tabs in the
  // background: their requests run in parallel while the profile is shown.
  useEffect(() => {
    if (!user) return;
    const staff = user.role === 'admin' || user.role === 'coordinator';
    const preload: Tab[] = [
      "myprojects",
      ...(staff ? (["projects", "categories", "reviews"] as Tab[]) : []),
      ...(user.role === 'admin' ? (["users", "contacts"] as Tab[]) : []),
    ];
    const id = setTimeout(() => setMountedTabs((prev) => new Set([...prev, ...preload])), 300);
    return () => clearTimeout(id);
  }, [user]);

  const showTab = (tab: Tab) => {
    setActiveTab(tab);
    setMountedTabs((prev) => (prev.has(tab) ? prev : new Set([...prev, tab])));
  };

  const openConfirm = (title: string, message: string, onConfirm: () => void, danger = false) => {
    setConfirmModal({ open: true, title, message, onConfirm, danger });
  };
  const closeConfirm = () => setConfirmModal({ open: false, title: '', message: '', onConfirm: null, danger: false });

  if (!user || !token) {
    return (
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-10">
        <div className="h-24 w-full max-w-xs animate-pulse rounded-2xl bg-gray-100" aria-label={t('dashboard.loadingUser')} />
      </div>
    );
  }

  const isStaff = user.role === 'admin' || user.role === 'coordinator';
  const isAdmin = user.role === 'admin';
  const tabProps: TabProps = { token, user, setStatusMessage, openConfirm, closeConfirm };

  const tabs = [
    "profile",
    "myprojects",
    ...(isStaff ? ["projects", "categories", "reviews"] : []),
    ...(isAdmin ? ["users", "contacts", "analytics"] : []),
  ] as const;
  const tabLabel: Record<string, string> = {
    profile: t('dashboard.profile'),
    myprojects: t('dashboard.myProjects'),
    reviews: t('dashboard.reviews'),
    projects: t('dashboard.projects'),
    contacts: t('dashboard.incidents'),
    users: t('dashboard.users'),
    categories: t('dashboard.categories'),
    analytics: t('dashboard.analytics'),
  };

  // Mounted tabs are kept in the DOM; only the active one is visible
  const panel = (tab: Tab, node: React.ReactNode) =>
    mountedTabs.has(tab) ? (
      <div key={tab} hidden={activeTab !== tab}>
        {node}
      </div>
    ) : null;

  const roleLabel = t(`dashboard.${user.role}`, { defaultValue: user.role });
  const avatar = user.profileImage ? imageUrl(user.profileImage) : null;

  return (
    <div className="w-full max-w-7xl mx-auto px-4 md:px-6 py-6 md:py-10">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[260px_minmax(0,1fr)] lg:gap-8">
        {/* Sidebar: who is signed in + navigation */}
        <aside className="min-w-0 lg:sticky lg:top-24 lg:self-start">
          <div className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-[var(--card-bg)] p-4">
            {avatar ? (
              <img src={avatar} alt="" className="h-12 w-12 shrink-0 rounded-full object-cover ring-2 ring-brand/40" />
            ) : (
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-brand text-lg font-bold text-on-brand">
                {user.name.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <div className="truncate font-semibold">{user.name}</div>
              <span className={`mt-1 ${ui.badge(user.role)}`}>{roleLabel}</span>
            </div>
          </div>

          <nav
            aria-label={t('dashboard.title')}
            className="mt-4 -mx-4 flex gap-1 overflow-x-auto px-4 pb-1 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0"
          >
            {tabs.map((tab) => {
              const active = activeTab === tab;
              return (
                <button
                  key={tab}
                  type="button"
                  aria-current={active ? 'page' : undefined}
                  className={`flex shrink-0 items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors ${
                    active
                      ? 'bg-brand-50 font-semibold text-brand-text'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  }`}
                  onClick={() => {
                    if (tab === "analytics") {
                      window.open(adminDashboardUrl(), '_blank', 'noopener');
                    } else {
                      showTab(tab as Tab);
                    }
                  }}
                >
                  <TabIcon tab={tab} />
                  <span className="whitespace-nowrap">{tabLabel[tab]}</span>
                  {tab === 'analytics' && <TabIcon tab="external" className="ml-auto h-3.5 w-3.5 opacity-60" />}
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Active tab */}
        <section className="min-w-0">
          <header className="mb-5">
            <span className="text-xs font-semibold uppercase tracking-widest text-brand-text">{t('dashboard.title')}</span>
            <h1 className="mt-1 text-2xl md:text-3xl font-bold tracking-tight">{tabLabel[activeTab]}</h1>
          </header>

          {statusMessage && (
            <div
              role="status"
              className={`mb-4 flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-medium ${
                statusMessage.type === 'success'
                  ? 'border-brand-200 bg-brand-50 text-brand-700'
                  : 'border-red-200 bg-red-50 text-red-700'
              }`}
            >
              <span aria-hidden="true">{statusMessage.type === 'success' ? '✓' : '!'}</span>
              {statusMessage.text}
            </div>
          )}

          <div className="rounded-2xl border border-gray-200 bg-[var(--card-bg)] p-4 md:p-6 shadow-sm">
            {panel("profile", <ProfileTab {...tabProps} setUser={(u) => setUser(u)} onAccountDeleted={() => navigate('/home')} />)}
            {panel("myprojects", <MyProjectsTab {...tabProps} />)}
            {isStaff && panel("projects", <ProjectsTab {...tabProps} categories={categories} usersData={usersData} />)}
            {isStaff && panel("categories", <CategoriesTab {...tabProps} categories={categories} setCategories={setCategories} />)}
            {isStaff && panel("reviews", <ReviewsTab {...tabProps} />)}
            {isAdmin && panel("users", <UsersTab {...tabProps} usersData={usersData} setUsersData={setUsersData} />)}
            {isAdmin && panel("contacts", <ContactsTab {...tabProps} />)}
          </div>
        </section>
      </div>

      <ConfirmModal
        open={confirmModal.open}
        title={confirmModal.title}
        message={confirmModal.message}
        danger={confirmModal.danger}
        onCancel={() => { closeConfirm(); }}
        onConfirm={() => { if (confirmModal.onConfirm) { confirmModal.onConfirm(); } closeConfirm(); }}
      />
    </div>
  );
};

export default Dashboard;
