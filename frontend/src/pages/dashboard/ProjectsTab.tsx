import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import type { AppUser, Category, Project, ProjectForm } from "../../types/api";
import { API_URL, ITEMS_PER_PAGE, getTotalPages, modalVariants, paginate, type TabProps } from "./shared";
import PaginationControls from "./Pagination";

/** Projects the user manages (admins: all, coordinators: their own) + project form. */
export default function ProjectsTab({ token, user, setStatusMessage, openConfirm, closeConfirm, categories, usersData }: TabProps & { categories: Category[]; usersData: AppUser[] }) {
  const { t } = useTranslation();
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectsFilter, setProjectsFilter] = useState<number | "">("");
  const [projectModalOpen, setProjectModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [projectForm, setProjectForm] = useState<ProjectForm>({ name: '', description: '', start_date: '', end_date: '', location: '', capacity: 1, status: 'active', categoryId: '', ownerId: '' });
  const [projectFile, setProjectFile] = useState<File | null>(null);
  const [projectFileName, setProjectFileName] = useState<string>("");
  const [projectsPage, setProjectsPage] = useState(1);

  useEffect(() => {
    fetch(`${API_URL}/api/projects`).then(r => r.json()).then(setProjects).catch(console.error);
  }, []);

  const handleProjectFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setProjectFile(e.target.files[0]);
      setProjectFileName(e.target.files[0].name);
    }
  };

  // Projects this user can manage: admins all, coordinators only their own (SEC-17)
  const manageableProjects = (projects || []).filter(p => user?.role === 'admin' || (p.ownerId != null && p.ownerId === user?.id));
  const coordinators = usersData.filter(u => u.role === 'coordinator');
  const ownerName = (ownerId: number | null | undefined) => {
    if (ownerId == null) return t('dashboard.noResponsible');
    const owner = usersData.find(u => u.id === ownerId);
    return owner ? owner.name || owner.email : `#${ownerId}`;
  };

  const handleSubmitProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return setStatusMessage({ type: 'error', text: t('dashboard.loginRequired') });
    try {
      const fd = new FormData();
      fd.append('name', projectForm.name);
      fd.append('description', projectForm.description);
      fd.append('start_date', projectForm.start_date);
      fd.append('end_date', projectForm.end_date);
      fd.append('location', projectForm.location);
      fd.append('capacity', String(projectForm.capacity));
      fd.append('status', projectForm.status);
      if (projectForm.categoryId !== '') fd.append('categoryId', String(projectForm.categoryId));
      if (user?.role === 'admin') fd.append('ownerId', projectForm.ownerId === '' ? 'null' : String(projectForm.ownerId));
      if (projectFile) fd.append('file', projectFile);
      let url = `${API_URL}/api/projects`;
      let method = 'POST';
      if (editingProject) { url = `${API_URL}/api/projects/${editingProject.id}`; method = 'PUT'; }
      const res = await fetch(url, { method, headers: { Authorization: `Bearer ${token}` }, body: fd });
      if (!res.ok) { const err = await res.json(); return setStatusMessage({ type: 'error', text: err.message || t('dashboard.errorSaving') }); }
      await res.json();
      // reload projects
      const all = await fetch(`${API_URL}/api/projects`).then(r => r.json());
      setProjects(all);
      setProjectModalOpen(false);
      setEditingProject(null);
    } catch (err) { console.error(err); setStatusMessage({ type: 'error', text: t('dashboard.errorSaving') }); }
  };

  return (
    <>
          <div>
            <div className="mb-6 flex flex-col md:flex-row justify-between md:items-center gap-3">
              <h3 className="font-bold mb-2 md:mb-0">{t('dashboard.projects')}</h3>
              <div className="flex flex-col md:flex-row items-stretch md:items-center gap-2">
                <select className="border rounded p-2 text-sm" value={projectsFilter} onChange={(e) => setProjectsFilter(e.target.value === '' ? '' : Number(e.target.value))}>
                  <option value="">{t('dashboard.allCategories')}</option>
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                <button className="bg-brand text-black hover:bg-ink hover:text-white px-4 py-2 rounded-3xl font-semibold shadow text-sm" onClick={() => { setProjectModalOpen(true); setEditingProject(null); setProjectForm({ name: '', description: '', start_date: '', end_date: '', location: '', capacity: 1, status: 'active', categoryId: '', ownerId: '' }); setProjectFile(null); setProjectFileName(''); }}>
                  {t('dashboard.addProject')}
                </button>
              </div>
            </div>

            <div className="mb-4">
              {manageableProjects.length === 0 && (
                <p className="text-gray-500 text-center py-4">{t('dashboard.noOwnedProjects')}</p>
              )}
              {paginate(manageableProjects.filter(p => projectsFilter === '' ? true : p.categoryId === projectsFilter), projectsPage, ITEMS_PER_PAGE.projects).map(p => (
                <div key={p.id} className="border p-3 mb-2 rounded">
                  <div className="flex flex-col md:flex-row justify-between md:items-start gap-3">
                    <div className="flex-1">
                      <strong className="text-sm md:text-base">{p.name}</strong> {p.status && <span className="text-gray-500 text-sm">({p.status})</span>}<br />
                      <div className="text-sm">{p.description}</div>
                      {user?.role === 'admin' && (
                        <div className="text-xs text-gray-500 mt-1">{t('dashboard.responsible')}: {ownerName(p.ownerId)}</div>
                      )}
                    </div>
                    <div className="flex gap-2 flex-wrap md:flex-nowrap">
                      <button className="border border-muted text-black hover:bg-ink hover:text-white transition px-3 py-1 rounded-3xl text-sm" onClick={() => { setEditingProject(p); setProjectModalOpen(true); setProjectForm({ name: p.name, description: p.description || '', start_date: p.start_date?.split('T')[0] || '', end_date: p.end_date?.split('T')[0] || '', location: p.location || '', capacity: p.capacity || 1, status: p.status || 'active', categoryId: p.categoryId || '', ownerId: p.ownerId ?? '' }); setProjectFile(null); setProjectFileName(''); }}>{t('common.edit')}</button>
                      <button className="bg-danger text-white hover:bg-ink hover:text-white transition px-3 py-1 rounded-3xl text-sm" onClick={() => openConfirm(t('dashboard.deleteProject'), t('dashboard.deleteProjectConfirm'), async () => { closeConfirm(); try { const res = await fetch(`${API_URL}/api/projects/${p.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }); if (!res.ok) { const err = await res.json(); setStatusMessage({ type: 'error', text: err.message || t('dashboard.errorDeleting') }); return; } setProjects(prev => prev.filter(x => x.id !== p.id)); setStatusMessage({ type: 'success', text: t('dashboard.projectDeleted') }); } catch (err) { console.error(err); setStatusMessage({ type: 'error', text: t('dashboard.errorDeleting') }); } }, true)}>{t('common.delete')}</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {projects && projects.length > 0 && (
              <PaginationControls
                currentPage={projectsPage}
                totalPages={getTotalPages(manageableProjects.filter(p => projectsFilter === '' ? true : p.categoryId === projectsFilter).length, ITEMS_PER_PAGE.projects)}
                onPageChange={setProjectsPage}
              />
            )}
          </div>
      {/* Project Modal (Admin/Coordinator) */}
      <AnimatePresence>
        {projectModalOpen && (
          <motion.div
            className="fixed inset-0 z-50 flex justify-center items-center bg-black/10 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            onClick={() => { setProjectModalOpen(false); setEditingProject(null); }}
          >
            <motion.div
              className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-2xl"
              variants={modalVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              transition={{ duration: 0.3, type: "spring", stiffness: 120 }}
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-2xl font-bold mb-4">{editingProject ? t('dashboard.editProject') : t('dashboard.createProject')}</h2>
              <form onSubmit={handleSubmitProject} className="flex flex-col gap-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input className="border rounded-lg p-2 focus:ring-2 focus:ring-brand-400 outline-none text-sm" placeholder={t('dashboard.name')} value={projectForm.name} onChange={(e)=>setProjectForm({...projectForm, name: e.target.value})} required />
                  <input type="date" className="border rounded-lg p-2 focus:ring-2 focus:ring-brand-400 outline-none text-sm" value={projectForm.start_date} onChange={(e)=>setProjectForm({...projectForm, start_date: e.target.value})} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input type="date" className="border rounded-lg p-2 focus:ring-2 focus:ring-brand-400 outline-none text-sm" value={projectForm.end_date} onChange={(e)=>setProjectForm({...projectForm, end_date: e.target.value})} />
                  <input className="border rounded-lg p-2 focus:ring-2 focus:ring-brand-400 outline-none text-sm" placeholder={t('dashboard.location')} value={projectForm.location} onChange={(e)=>setProjectForm({...projectForm, location: e.target.value})} />
                </div>
                <textarea className="border rounded-lg p-2 focus:ring-2 focus:ring-brand-400 outline-none text-sm" placeholder={t('dashboard.description')} value={projectForm.description} onChange={(e)=>setProjectForm({...projectForm, description: e.target.value})} />
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <input type="number" className="border rounded-lg p-2 focus:ring-2 focus:ring-brand-400 outline-none text-sm" value={projectForm.capacity} onChange={(e)=>setProjectForm({...projectForm, capacity: Number(e.target.value)})} />
                  <select className="border rounded-lg p-2 focus:ring-2 focus:ring-brand-400 outline-none text-sm" value={projectForm.status} onChange={(e)=>setProjectForm({...projectForm, status: e.target.value})}>
                    <option value="active">{t('dashboard.active')}</option>
                    <option value="cancelled">{t('dashboard.cancelled')}</option>
                    <option value="finished">{t('dashboard.finished')}</option>
                  </select>
                  <select className="border rounded-lg p-2 focus:ring-2 focus:ring-brand-400 outline-none text-sm" value={projectForm.categoryId} onChange={(e)=>setProjectForm({...projectForm, categoryId: e.target.value === '' ? '' : Number(e.target.value)})}>
                    <option value="">{t('dashboard.noCategory')}</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                {user?.role === 'admin' && (
                  <label className="flex flex-col gap-1 text-sm">
                    <span className="font-medium">{t('dashboard.responsible')}</span>
                    <select className="border rounded-lg p-2 focus:ring-2 focus:ring-brand-400 outline-none text-sm" value={projectForm.ownerId} onChange={(e)=>setProjectForm({...projectForm, ownerId: e.target.value === '' ? '' : Number(e.target.value)})}>
                      <option value="">{t('dashboard.noResponsible')}</option>
                      {coordinators.map(c => <option key={c.id} value={c.id}>{c.name || c.email}</option>)}
                    </select>
                  </label>
                )}
                <div className="flex flex-col gap-3">
                  <label className="px-4 py-3 border-2 border-dashed border-brand rounded-lg bg-brand-50 hover:bg-brand-100 cursor-pointer transition-colors text-center">
                    <span className="text-sm font-semibold text-gray-700">{t('dashboard.uploadFile')}</span>
                    <input type="file" onChange={handleProjectFileChange} className="hidden" />
                  </label>
                  {projectFileName && <p className="text-xs text-gray-600 text-center">📄 {projectFileName}</p>}
                  <div className="flex gap-2 flex-col sm:flex-row w-full sm:w-auto sm:ml-auto">
                    <button type="button" className="px-4 py-2 rounded-3xl border border-muted hover:bg-ink hover:text-white transition-colors duration-200 text-sm flex-1 sm:flex-none" onClick={() => { setProjectModalOpen(false); setEditingProject(null); }}>{t('common.cancel')}</button>
                    <button type="submit" className="bg-brand text-black hover:bg-ink hover:text-white px-4 py-2 rounded-3xl font-semibold transition-colors text-sm flex-1 sm:flex-none">{editingProject ? t('common.save') : t('dashboard.createProject')}</button>
                  </div>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
