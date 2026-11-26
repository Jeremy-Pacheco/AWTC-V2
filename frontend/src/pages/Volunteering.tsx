import React, { useEffect, useState, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { useTranslation } from "react-i18next";
import PageHeader from "../components/PageHeader";
import AuthModal from "../components/AuthModal";
import AlertModal from "../components/AlertModal";
import { useSearchParams } from "react-router-dom";
import { handleAuthFetch } from "../utils/auth";
import { imageUrl } from '../utils/images';

type Project = {
  id: number;
  name: string;
  description: string;
  start_date: string;
  end_date: string;
  location: string;
  capacity: number;
  status: string;
  filename?: string;
  categoryId?: number | null;
  category?: { id: number; name: string } | null;
  volunteerCount?: number;
};

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

const Volunteering: React.FC = () => {
  const { t, i18n } = useTranslation();
  const [projects, setProjects] = useState<Project[]>([]);
  const [searchParams] = useSearchParams();
  const projectRefs = useRef<{ [key: number]: HTMLElement | null }>({});
  const socketRef = useRef<Socket | null>(null);

  const [categories, setCategories] = useState<{ id: number; name: string }[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  
  // Alert Modal state
  const [alertOpen, setAlertOpen] = useState(false);
  const [alertMessage, setAlertMessage] = useState("");
  
  // Auth modal state
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [enrolledProjectIds, setEnrolledProjectIds] = useState<number[]>([]);
  const [bannedProjectIds, setBannedProjectIds] = useState<number[]>([]);
  
  // Volunteer count state: Map of projectId -> { enrolled: number, capacity: number }
  const [volunteerCounts, setVolunteerCounts] = useState<{ [key: number]: { enrolled: number; capacity: number } }>({});

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 6;

  // Initialize WebSocket connection
  useEffect(() => {
    const socket = io(`${API_URL}/volunteering`, {
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5
    });

    socket.on('connected', (data) => {
      console.log('Connected to volunteering WebSocket:', data);
    });

    // Listen for volunteer count updates
    socket.on('volunteer_count_updated', (data) => {
      const { projectId, enrolled, capacity } = data;
      setVolunteerCounts((prev) => ({
        ...prev,
        [projectId]: { enrolled, capacity }
      }));
      console.log(`Volunteer count updated for project ${projectId}: ${enrolled}/${capacity}`);
    });

    socket.on('disconnect', () => {
      console.log('Disconnected from volunteering WebSocket');
    });

    socketRef.current = socket;

    return () => {
      socket.disconnect();
    };
  }, []);

  const fetchEnrolledProjects = async () => {
    const token = localStorage.getItem("jwtToken");
    if (!token) {
      setEnrolledProjectIds([]);
      setBannedProjectIds([]);
      return;
    }

    try {
      // Fetch enrolled projects
      const resProjects = await handleAuthFetch(`${API_URL}/api/users/dashboard/projects`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (resProjects.ok) {
        const data = await resProjects.json();
        const projectIds = data.projects?.map((p: Project) => p.id) || [];
        setEnrolledProjectIds(projectIds);
      }

      // Fetch banned projects
      const resBans = await handleAuthFetch(`${API_URL}/api/users/dashboard/bans`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (resBans.ok) {
        const data = await resBans.json();
        const bannedIds = data.projects?.map((p: { id: number }) => p.id) || [];
        setBannedProjectIds(bannedIds);
      }
    } catch (err) {
      console.error("Error fetching enrolled projects:", err);
    }
  };

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const res = await fetch(`${API_URL}/api/projects`);
        const data = await res.json();
        setProjects(data);
        
        // Initialize volunteer counts from project data
        const initialCounts: { [key: number]: { enrolled: number; capacity: number } } = {};
        data.forEach((p: Project) => {
          initialCounts[p.id] = {
            enrolled: p.volunteerCount || 0,
            capacity: p.capacity
          };
        });
        setVolunteerCounts(initialCounts);
        
        // Scroll to specific project if ID in URL
        const projectId = searchParams.get("project");
        if (projectId) {
          // Clear any category filter and open the page that holds the project
          setSelectedCategory("");
          const index = (data as Project[]).findIndex((p) => p.id === Number(projectId));
          if (index >= 0) setTimeout(() => setCurrentPage(Math.floor(index / ITEMS_PER_PAGE) + 1), 0);
          
          setTimeout(() => {
            const element = projectRefs.current[Number(projectId)];
            if (element) {
              element.scrollIntoView({ behavior: "smooth", block: "center" });
              // Add highlight effect
              element.classList.add("ring-4", "ring-brand-400");
              setTimeout(() => {
                element.classList.remove("ring-4", "ring-brand-400");
              }, 2000);
            }
          }, 300);
        }
      } catch (err) {
        console.error("Error fetching projects:", err);
      }
    };

    fetchProjects();

    // Fetch categories for filter
    fetch(`${API_URL}/api/categories`)
      .then(res => res.json())
      .then((cats: { id: number; name: string }[]) => setCategories(cats || []))
      .catch(err => console.error('Error fetching categories:', err));

    // Fetch enrolled projects if logged in
    fetchEnrolledProjects();
  }, [searchParams]);

  const handleEnroll = async (projectId: number) => {
    // Check if user is logged in
    const token = localStorage.getItem("jwtToken");
    
    if (!token) {
      // User is not logged in, open auth modal
      setAuthMode("login");
      setAuthOpen(true);
      return;
    }

    // User is logged in, proceed with enrollment
    try {
      const res = await fetch(`${API_URL}/api/projects/${projectId}/register`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 409) {
          setAlertMessage(t('volunteering.alreadyEnrolled'));
          setAlertOpen(true);
        } else if (res.status === 403) {
          setAlertMessage(t('volunteering.cannotEnroll'));
          setAlertOpen(true);
        } else if (res.status === 400) {
          setAlertMessage(data.message || t('volunteering.fullCapacity'));
          setAlertOpen(true);
        } else {
          setAlertMessage(data.message || t('volunteering.errorEnrolling'));
          setAlertOpen(true);
        }
        return;
      }

      setAlertMessage(t('volunteering.enrollSuccess'));
      setAlertOpen(true);
      // Refresh enrolled projects
      await fetchEnrolledProjects();
    } catch (err) {
      console.error(err);
      setAlertMessage(t('volunteering.networkError'));
      setAlertOpen(true);
    }
  };

  // Check if a project is at full capacity
  const isProjectFull = (projectId: number): boolean => {
    const count = volunteerCounts[projectId];
    if (!count) return false;
    return count.enrolled >= count.capacity;
  };

  const filteredProjects = selectedCategory
    ? projects.filter(p => p.categoryId === Number(selectedCategory))
    : projects;

  // Reset to page 1 when category changes
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedCategory]);

  // Pagination logic
  const totalPages = Math.ceil(filteredProjects.length / ITEMS_PER_PAGE);
  const paginatedProjects = filteredProjects.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  // Generate page numbers to display
  const getPageNumbers = (): (number | string)[] => {
    const pages: (number | string)[] = [];
    const maxVisible = 5;
    
    if (totalPages <= maxVisible + 2) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      pages.push(1);
      
      if (currentPage > 3) {
        pages.push('...');
      }
      
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);
      
      for (let i = start; i <= end; i++) {
        pages.push(i);
      }
      
      if (currentPage < totalPages - 2) {
        pages.push('...');
      }
      
      pages.push(totalPages);
    }
    
    return pages;
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    // Scroll to top of projects section
    window.scrollTo({ top: 280, behavior: 'smooth' });
  };

  const formatDate = (value?: string) =>
    value ? new Date(value).toLocaleDateString(i18n.language, { day: "numeric", month: "short" }) : "";

  const chip = (active: boolean) =>
    `rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${
      active
        ? "border-transparent bg-ink !text-white"
        : "border-gray-300 text-gray-700 hover:border-gray-400 hover:bg-gray-100"
    }`;

  return (
    <>
      <PageHeader
        hero="volunteering"
        eyebrow={t('nav.volunteering')}
        title={t('volunteering.headerTitle')}
        subtitle={t('volunteering.subtitle')}
      />

      <main className="max-w-6xl mx-auto px-4 md:px-6 py-10 md:py-14">
        <div className="mb-8 flex flex-col gap-4">
          <div>
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight">{t('volunteering.activeProjects')}</h2>
            <p className="mt-1 text-left text-base text-gray-600">
              {t('volunteering.projectCount', { count: filteredProjects.length })}
            </p>
          </div>
          <div className="flex flex-wrap gap-2" role="group" aria-label={t('volunteering.filterByCategory')}>
            <button type="button" className={chip(selectedCategory === "")} aria-pressed={selectedCategory === ""} onClick={() => setSelectedCategory("")}>
              {t('volunteering.allCategories')}
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                className={chip(selectedCategory === String(cat.id))}
                aria-pressed={selectedCategory === String(cat.id)}
                onClick={() => setSelectedCategory(String(cat.id))}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>

        {paginatedProjects.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-300 py-16 text-center text-gray-500">
            {t('volunteering.noProjects')}
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {paginatedProjects.map((proj) => {
              const isFull = isProjectFull(proj.id);
              const count = volunteerCounts[proj.id];
              const enrolled = count ? count.enrolled : 0;
              const capacity = count ? count.capacity : proj.capacity;
              const fill = capacity ? Math.min(100, Math.round((enrolled / capacity) * 100)) : 0;
              const start = formatDate(proj.start_date);
              const end = formatDate(proj.end_date);
              const banned = bannedProjectIds.includes(proj.id);
              const isEnrolled = enrolledProjectIds.includes(proj.id);

              return (
                <article
                  key={proj.id}
                  ref={(el) => {
                    if (el) projectRefs.current[proj.id] = el;
                  }}
                  className="group flex flex-col overflow-hidden rounded-2xl border border-gray-200 bg-[var(--card-bg)] shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-xl"
                >
                  <div className="relative aspect-[16/10] overflow-hidden bg-gray-100">
                    {proj.filename ? (
                      <img
                        src={imageUrl(proj.filename)}
                        alt={proj.name}
                        loading="lazy"
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    ) : (
                      <div className="h-full w-full bg-gradient-to-br from-brand-600 to-brand-900" />
                    )}
                    {proj.category && (
                      <span className="absolute left-3 top-3 rounded-full bg-black/55 px-3 py-1 text-xs font-semibold !text-white backdrop-blur-sm">
                        {proj.category.name}
                      </span>
                    )}
                  </div>

                  <div className="flex flex-1 flex-col p-5">
                    <h3 className="text-xl font-bold leading-snug">{proj.name}</h3>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-500">
                      {proj.location && (
                        <span className="inline-flex items-center gap-1.5">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4" aria-hidden="true">
                            <path d="M12 21s-7-6.2-7-11a7 7 0 1114 0c0 4.8-7 11-7 11z" />
                            <circle cx="12" cy="10" r="2.5" />
                          </svg>
                          {proj.location}
                        </span>
                      )}
                      {start && (
                        <span className="inline-flex items-center gap-1.5">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4" aria-hidden="true">
                            <rect x="3" y="5" width="18" height="16" rx="2" />
                            <path d="M16 3v4M8 3v4M3 11h18" />
                          </svg>
                          {end && end !== start ? `${start} – ${end}` : start}
                        </span>
                      )}
                    </div>
                    <p className="mt-3 flex-1 text-left text-sm leading-relaxed text-gray-700 line-clamp-3">{proj.description}</p>

                    <div className="mt-5">
                      <div className="mb-1.5 flex justify-between text-xs font-medium">
                        <span className="text-gray-500">{t('volunteering.volunteers')}</span>
                        <span className={isFull ? "text-danger" : "text-brand-text"}>
                          {enrolled}/{capacity}
                        </span>
                      </div>
                      <div
                        className="h-1.5 overflow-hidden rounded-full bg-gray-200"
                        role="progressbar"
                        aria-valuemin={0}
                        aria-valuemax={capacity}
                        aria-valuenow={enrolled}
                        aria-label={t('volunteering.volunteers')}
                      >
                        <div className={`h-full rounded-full ${isFull ? "bg-danger" : "bg-brand"}`} style={{ width: `${fill}%` }} />
                      </div>
                    </div>

                    <div className="mt-5">
                      {banned ? (
                        <button disabled className="w-full rounded-full border border-danger/40 px-4 py-2.5 text-sm font-semibold text-danger cursor-not-allowed">
                          {t('volunteering.notAvailable')}
                        </button>
                      ) : isEnrolled ? (
                        <button disabled className="w-full rounded-full bg-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-600 cursor-not-allowed">
                          ✓ {t('volunteering.alreadyEnrolledBtn')}
                        </button>
                      ) : isFull ? (
                        <button disabled className="w-full rounded-full bg-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-500 cursor-not-allowed">
                          {t('volunteering.full')}
                        </button>
                      ) : (
                        <button
                          onClick={() => handleEnroll(proj.id)}
                          className="w-full rounded-full bg-brand px-4 py-2.5 text-sm font-semibold text-on-brand shadow-sm transition-colors hover:bg-brand-hover"
                        >
                          {t('volunteering.enroll')}
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="mt-10 flex flex-wrap items-center justify-center gap-1.5">
            <button
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className="rounded-full border border-gray-300 px-3.5 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {t('dashboard.previous')}
            </button>
            {getPageNumbers().map((page, index) =>
              typeof page === 'number' ? (
                <button
                  key={index}
                  onClick={() => handlePageChange(page)}
                  aria-current={currentPage === page ? 'page' : undefined}
                  className={`grid h-9 min-w-9 place-items-center rounded-full px-2 text-sm font-medium transition-colors ${
                    currentPage === page ? 'bg-brand text-on-brand font-semibold' : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  {page}
                </button>
              ) : (
                <span key={index} className="px-2 py-1 text-gray-500">{page}</span>
              )
            )}
            <button
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="rounded-full border border-gray-300 px-3.5 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {t('dashboard.next')}
            </button>
          </div>
        )}
      </main>

      {/* Auth Modal */}
      <AuthModal
        open={authOpen}
        onClose={() => {
          setAuthOpen(false);
          // Refresh enrolled projects
          fetchEnrolledProjects();
        }}
        mode={authMode}
      />

      <AlertModal open={alertOpen} message={alertMessage} onAccept={() => setAlertOpen(false)} />
    </>
  );
};

export default Volunteering;