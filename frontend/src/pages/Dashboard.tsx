import React, { useEffect, useState } from "react";
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import ConfirmModal from '../components/ConfirmModal';
import { handleAuthFetch } from '../utils/auth';
import type { AppUser, Category } from '../types/api';
import { API_URL, type DashboardUser, type StatusMessage, type TabProps } from './dashboard/shared';
import ProfileTab from './dashboard/ProfileTab';
import ProjectsTab from './dashboard/ProjectsTab';
import MyProjectsTab from './dashboard/MyProjectsTab';
import ReviewsTab from './dashboard/ReviewsTab';
import UsersTab from './dashboard/UsersTab';
import ContactsTab from './dashboard/ContactsTab';
import CategoriesTab from './dashboard/CategoriesTab';

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

  const openConfirm = (title: string, message: string, onConfirm: () => void, danger = false) => {
    setConfirmModal({ open: true, title, message, onConfirm, danger });
  };
  const closeConfirm = () => setConfirmModal({ open: false, title: '', message: '', onConfirm: null, danger: false });

  if (!user || !token) return <div className="p-6">{t('dashboard.loadingUser')}</div>;

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

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      <h2 className="text-2xl md:text-3xl font-bold mb-6 text-center">{t('dashboard.title')}</h2>
      {statusMessage && (
        <div className={`mb-4 p-3 rounded ${statusMessage.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
          {statusMessage.text}
        </div>
      )}

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 md:gap-4 mb-6 justify-center">
        {tabs.map((tab) => (
          <button
            key={tab}
            className={`px-3 md:px-4 py-2 rounded-3xl font-semibold transition text-sm md:text-base ${
              activeTab === tab ? "bg-brand text-black" : "bg-gray-200 hover:bg-ink hover:text-white"
            }`}
            onClick={() => {
              if (tab === "analytics") {
                // In development, use API_URL (localhost:8080), in production use Nginx /admin/ route
                const analyticsUrl = import.meta.env.DEV ? API_URL : `${window.location.origin}/admin/`;
                window.open(analyticsUrl, '_blank');
              } else {
                setActiveTab(tab as Tab);
              }
            }}
          >
            {tabLabel[tab]}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="bg-gray-100 p-4 md:p-6 rounded-lg shadow-md">
        {activeTab === "profile" && (
          <ProfileTab {...tabProps} setUser={(u) => setUser(u)} onAccountDeleted={() => navigate('/home')} />
        )}
        {activeTab === "myprojects" && <MyProjectsTab {...tabProps} />}
        {activeTab === "projects" && isStaff && <ProjectsTab {...tabProps} categories={categories} usersData={usersData} />}
        {activeTab === "categories" && isStaff && <CategoriesTab {...tabProps} categories={categories} setCategories={setCategories} />}
        {activeTab === "reviews" && isStaff && <ReviewsTab {...tabProps} />}
        {activeTab === "users" && isAdmin && <UsersTab {...tabProps} usersData={usersData} setUsersData={setUsersData} />}
        {activeTab === "contacts" && isAdmin && <ContactsTab {...tabProps} />}
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
