import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Project } from "../../types/api";
import * as ui from "./ui";
import { API_URL, ITEMS_PER_PAGE, getTotalPages, paginate, type TabProps } from "./shared";
import PaginationControls from "./Pagination";

/** Projects the user is registered in (unregister). */
export default function MyProjectsTab({ token, setStatusMessage, openConfirm, closeConfirm }: TabProps) {
  const { t } = useTranslation();
  const [myProjects, setMyProjects] = useState<Project[]>([]);
  const [myProjectsPage, setMyProjectsPage] = useState(1);

  useEffect(() => {
    fetch(`${API_URL}/api/users/dashboard/projects`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => (r.ok ? r.json() : { projects: [] }))
      .then(d => setMyProjects(d.projects || []))
      .catch(console.error);
  }, [token]);

  const unregisterFromProject = async (projectId: number) => {
    if (!token) return setStatusMessage({ type: 'error', text: t('dashboard.loginRequired') });
    try {
      const res = await fetch(`${API_URL}/api/projects/${projectId}/unregister`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) { const err = await res.json(); return setStatusMessage({ type: 'error', text: err.message || t('dashboard.errorSaving') }); }
      // refresh my projects
      const d = await fetch(`${API_URL}/api/users/dashboard/projects`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json());
      setMyProjects(d.projects || []);
      setStatusMessage({ type: 'success', text: t('dashboard.unregistered') });
    } catch (err) { console.error(err); setStatusMessage({ type: 'error', text: t('dashboard.networkError') }); }
  };

  return (
    <>
          <div>
            <div>
              {paginate(myProjects, myProjectsPage, ITEMS_PER_PAGE.myProjects).map(p => (
                <div key={p.id} className={`${ui.card} flex flex-col md:flex-row justify-between md:items-start gap-3`}>
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2"><strong className="text-base">{p.name}</strong>{p.status && <span className={ui.badge(p.status)}>{t(`dashboard.${p.status}`, { defaultValue: p.status })}</span>}</div>
                    <div className="mt-1 text-sm text-gray-600">{p.description}</div>
                  </div>
                  <div className="flex gap-2 flex-wrap md:flex-nowrap">
                    <button className={ui.btnDanger} onClick={() => openConfirm(t('dashboard.unregister'), t('dashboard.unregisterConfirm'), async () => { closeConfirm(); await unregisterFromProject(p.id); }, true)}>{t('dashboard.unregister')}</button>
                  </div>
                </div>
              ))}
            </div>
            <PaginationControls
              currentPage={myProjectsPage}
              totalPages={getTotalPages(myProjects.length, ITEMS_PER_PAGE.myProjects)}
              onPageChange={setMyProjectsPage}
            />
          </div>

    </>
  );
}
