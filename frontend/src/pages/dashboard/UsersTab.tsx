import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import { imageUrl } from "../../utils/images";
import type { AppUser, UserProjectEntry } from "../../types/api";
import * as ui from "./ui";
import { API_URL, ITEMS_PER_PAGE, getTotalPages, modalVariants, paginate, type TabProps } from "./shared";
import PaginationControls from "./Pagination";

/** Admin: users, roles, deletion, their projects/bans and user creation. */
export default function UsersTab({ token, setStatusMessage, openConfirm, closeConfirm, usersData, setUsersData }: TabProps & { usersData: AppUser[]; setUsersData: React.Dispatch<React.SetStateAction<AppUser[]>> }) {
  const { t } = useTranslation();
  const [userRoleFilter, setUserRoleFilter] = useState<string | "">("");
  const [selectedUser, setSelectedUser] = useState<AppUser | null>(null);
  const [userProjects, setUserProjects] = useState<UserProjectEntry[]>([]);
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [newUserForm, setNewUserForm] = useState({ name: '', email: '', password: '', role: 'volunteer' });
  const [createUserModalOpen, setCreateUserModalOpen] = useState(false);
  const [usersPage, setUsersPage] = useState(1);
  const [userProjectsPage, setUserProjectsPage] = useState(1);

  const handleRejectUserFromProject = async (projectId: number, userId: number) => {
    if (!token) return setStatusMessage({ type: 'error', text: t('dashboard.loginRequired') });
    try {
      const res = await fetch(`${API_URL}/api/projects/${projectId}/volunteers/${userId}/reject`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) { const err = await res.json(); return setStatusMessage({ type: 'error', text: err.message || t('dashboard.networkError') }); }
      // reload user projects
      const d = await fetch(`${API_URL}/api/users/${userId}/projects`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json());
      setUserProjects(d.projects || []);
      setStatusMessage({ type: 'success', text: t('dashboard.userBanned') });
    } catch (err) { console.error(err); setStatusMessage({ type: 'error', text: t('dashboard.networkError') }); }
  };

  const handleUnbanUserFromProject = async (projectId: number, userId: number) => {
    if (!token) return setStatusMessage({ type: 'error', text: t('dashboard.loginRequired') });
    try {
      const res = await fetch(`${API_URL}/api/projects/${projectId}/volunteers/${userId}/unban`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) { const err = await res.json(); return setStatusMessage({ type: 'error', text: err.message || t('dashboard.networkError') }); }
      const d = await fetch(`${API_URL}/api/users/${userId}/projects`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json());
      setUserProjects(d.projects || []);
      setStatusMessage({ type: 'success', text: t('dashboard.userUnbanned') });
    } catch (err) { console.error(err); setStatusMessage({ type: 'error', text: t('dashboard.networkError') }); }
  };

  const createUser = async () => {
    if (!token) return setStatusMessage({ type: 'error', text: t('dashboard.loginRequired') });
    try {
      const res = await fetch(`${API_URL}/api/users/signup`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ name: newUserForm.name, email: newUserForm.email, password: newUserForm.password }) });
      if (!res.ok) { const err = await res.json(); return setStatusMessage({ type: 'error', text: err.message || t('dashboard.errorSaving') }); }
      const data = await res.json();
      if (newUserForm.role && newUserForm.role !== 'volunteer') {
        const res2 = await fetch(`${API_URL}/api/users/${data.user.id}/role`, { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ role: newUserForm.role }) });
        if (!res2.ok) { const err = await res2.json(); return setStatusMessage({ type: 'error', text: err.message || t('dashboard.errorSaving') }); }
      }
      const users = await fetch(`${API_URL}/api/users`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json());
      setUsersData(users);
      setNewUserForm({ name: '', email: '', password: '', role: 'volunteer' });
      setCreateUserModalOpen(false);
      setStatusMessage({ type: 'success', text: t('dashboard.userCreated') });
    } catch (err) {
      console.error(err);
      setStatusMessage({ type: 'error', text: t('dashboard.errorSaving') });
    }
  };

  return (
    <>
                  <div>
                    <div className="mb-4 flex flex-col md:flex-row gap-2 md:items-center">
                      <select className={`${ui.field} md:w-56`} value={userRoleFilter} onChange={(e)=>setUserRoleFilter(e.target.value === '' ? '' : e.target.value)}>
                        <option value="">{t('dashboard.allRoles')}</option>
                        <option value="admin">{t('dashboard.admin')}</option>
                        <option value="coordinator">{t('dashboard.coordinator')}</option>
                        <option value="volunteer">{t('dashboard.volunteer')}</option>
                      </select>
                      <div className="md:ml-auto">
                        <button className={`${ui.btnPrimary} w-full md:w-auto`} onClick={() => setCreateUserModalOpen(true)}>{t('dashboard.createUser')}</button>
                      </div>
                    </div>
                    <div>
                      {paginate(usersData.filter(u => userRoleFilter === '' ? true : u.role === userRoleFilter), usersPage, ITEMS_PER_PAGE.users).map(u => (
                        <div key={u.id} className={`${ui.card} flex flex-col md:flex-row justify-between md:items-start gap-3`}>
                          <div className="flex items-start gap-3 flex-1 min-w-0">
                            {u.profileImage ? (
                              <img
                                src={imageUrl(u.profileImage)}
                                alt={u.name}
                                className="w-12 h-12 rounded-full object-cover flex-shrink-0"
                              />
                            ) : (
                              <div className="w-12 h-12 rounded-full bg-brand flex items-center justify-center flex-shrink-0">
                                <span className="text-black font-bold text-lg">
                                  {u.name.charAt(0).toUpperCase()}
                                </span>
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="flex flex-wrap items-center gap-2"><strong className="text-base">{u.name}</strong><span className={ui.badge(u.role)}>{t(`dashboard.${u.role}`, { defaultValue: u.role })}</span></div><small className="text-gray-500 text-xs md:text-sm block truncate">{u.email}</small>
                              <div className="mt-2 flex flex-col sm:flex-row gap-2 items-start sm:items-center">
                                <label className="text-sm">{t('dashboard.role')}:</label>
                                <select defaultValue={u.role} onChange={async (e)=>{ const newRole = e.target.value; try { const res = await fetch(`${API_URL}/api/users/${u.id}/role`, { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ role: newRole }) }); if (!res.ok) { const err = await res.json(); return setStatusMessage({ type: 'error', text: err.message || t('dashboard.errorSaving') }); } const updated = await res.json(); setUsersData(prev => prev.map(x => x.id === u.id ? { ...x, role: updated.user.role } : x)); setStatusMessage({ type: 'success', text: t('dashboard.roleUpdated') }); } catch (err) { console.error(err); setStatusMessage({ type: 'error', text: t('dashboard.networkError') }); } }} className={`${ui.field} !w-auto !py-1`}>
                                  <option value="volunteer">{t('dashboard.volunteer')}</option>
                                  <option value="coordinator">{t('dashboard.coordinator')}</option>
                                  <option value="admin">{t('dashboard.admin')}</option>
                                </select>
                              </div>
                            </div>
                          </div>
                          <div className="flex gap-2 flex-wrap md:flex-nowrap md:justify-end">
                            <button className={ui.btnSecondary} onClick={async ()=>{
                              try {
                                const res = await fetch(`${API_URL}/api/users/${u.id}/projects`, { headers: { Authorization: `Bearer ${token}` } });
                                if (!res.ok) { const err = await res.json(); return setStatusMessage({ type: 'error', text: err.message || 'Error' }); }
                                const d = await res.json();
                                const res2 = await fetch(`${API_URL}/api/users/${u.id}/bans`, { headers: { Authorization: `Bearer ${token}` } });
                                const b = res2.ok ? await res2.json() : { projects: [] };
                                // combine projects and bans
                                const bannedProjects: UserProjectEntry[] = b.projects || [];
                                const projectsWithBanFlag: UserProjectEntry[] = ((d.projects || []) as UserProjectEntry[]).map((p) => ({ ...p, banned: bannedProjects.some((bp) => bp.id === p.id) }));
                                // for bans that are not in projects, add them
                                bannedProjects.forEach((bp) => {
                                  if (!projectsWithBanFlag.some((pp) => pp.id === bp.id)) {
                                    projectsWithBanFlag.push({ id: bp.id, name: bp.name || '', description: '', banned: true });
                                  }
                                });
                                setSelectedUser(u); setUserProjects(projectsWithBanFlag); setUserModalOpen(true);
                              } catch (err) { console.error(err); setStatusMessage({ type: 'error', text: 'Error fetching user projects' }); }
                            }}>{t('dashboard.viewProjects')}</button>
                            <button className={ui.btnDanger} onClick={() => openConfirm(t('dashboard.deleteUser'), t('dashboard.deleteUserConfirm'), async () => { closeConfirm(); try { const res = await fetch(`${API_URL}/api/users/${u.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }); if (!res.ok) { const err = await res.json(); setStatusMessage({ type: 'error', text: err.message || t('dashboard.errorDeleting') }); return; } setUsersData(prev => prev.filter(x => x.id !== u.id)); setStatusMessage({ type: 'success', text: t('dashboard.userDeleted') }); } catch (err) { console.error(err); setStatusMessage({ type: 'error', text: t('dashboard.errorDeleting') }); } }, true)}>{t('common.delete')}</button>
                          </div>
                        </div>
                      ))}
                    </div>
                    {usersData && usersData.length > 0 && (
                      <PaginationControls
                        currentPage={usersPage}
                        totalPages={getTotalPages(usersData.filter(u => userRoleFilter === '' ? true : u.role === userRoleFilter).length, ITEMS_PER_PAGE.users)}
                        onPageChange={setUsersPage}
                      />
                    )}
                  </div>
      {/* User Projects Modal */}
      <AnimatePresence>
        {userModalOpen && selectedUser && (
          <motion.div className={ui.overlay} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => { setUserModalOpen(false); setSelectedUser(null); setUserProjectsPage(1); }}>
          <motion.div className={`${ui.modal} max-w-2xl max-h-[90vh] overflow-y-auto`} variants={modalVariants} initial="hidden" animate="visible" exit="exit" transition={{ duration: 0.3, type: "spring", stiffness: 120 }} onClick={(e)=>e.stopPropagation()}>
            <h2 className={ui.modalTitle}>{selectedUser.name} - {t('dashboard.projects')}</h2>
              <div className="mb-4">
                {userProjects.length === 0 ? (
                  <p className={ui.empty}>{t('dashboard.noProjects')}</p>
                ) : (
                  paginate(userProjects, userProjectsPage, ITEMS_PER_PAGE.userProjects).map((p) => (
                    <div key={p.id} className={`${ui.card} flex flex-col sm:flex-row justify-between sm:items-center gap-2`}>
                      <div className="flex-1 min-w-0">
                        <strong className="block truncate">{p.name}</strong>
                        <span className="text-sm text-gray-600 block truncate">{p.description}</span>
                      </div>
                      <div className="flex gap-2 flex-shrink-0">
                        {!p.banned ? (
                          <button className={ui.btnDanger} onClick={() => openConfirm(t('dashboard.removeBan'), t('dashboard.removeBanConfirm'), async () => { closeConfirm(); await handleRejectUserFromProject(p.id, selectedUser.id); }, true)}>{t('dashboard.removeBan')}</button>
                        ) : (
                          <button className={ui.btnSecondary} onClick={() => openConfirm(t('dashboard.unban'), t('dashboard.unbanConfirm'), async () => { closeConfirm(); await handleUnbanUserFromProject(p.id, selectedUser.id); }, false)}>{t('dashboard.unban')}</button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
              {userProjects.length > ITEMS_PER_PAGE.userProjects && (
                <PaginationControls
                  currentPage={userProjectsPage}
                  totalPages={getTotalPages(userProjects.length, ITEMS_PER_PAGE.userProjects)}
                  onPageChange={setUserProjectsPage}
                />
              )}
              <div className="flex justify-end mt-4">
                <button className={ui.btnSecondary} onClick={() => { setUserModalOpen(false); setSelectedUser(null); setUserProjectsPage(1); }}>{t('dashboard.close')}</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* Create User Modal */}
      <AnimatePresence>
        {createUserModalOpen && (
          <motion.div className={ui.overlay} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setCreateUserModalOpen(false)}>
            <motion.div className={`${ui.modal} max-w-md`} variants={modalVariants} initial="hidden" animate="visible" exit="exit" transition={{ duration: 0.3, type: "spring", stiffness: 120 }} onClick={(e)=>e.stopPropagation()}>
              <h2 className={ui.modalTitle}>{t('dashboard.createUser')}</h2>
              <form onSubmit={async (e)=>{ e.preventDefault(); await createUser(); }} className="flex flex-col gap-3">
                <input placeholder={t('dashboard.name')} className={ui.field} value={newUserForm.name} onChange={(e)=>setNewUserForm({...newUserForm, name: e.target.value})} required />
                <input placeholder={t('dashboard.email')} className={ui.field} value={newUserForm.email} onChange={(e)=>setNewUserForm({...newUserForm, email: e.target.value})} required />
                <input placeholder={t('dashboard.password')} type="password" className={ui.field} value={newUserForm.password} onChange={(e)=>setNewUserForm({...newUserForm, password: e.target.value})} required />
                <select className={ui.field} value={newUserForm.role} onChange={(e)=>setNewUserForm({...newUserForm, role: e.target.value})}>
                  <option value="volunteer">{t('dashboard.volunteer')}</option>
                  <option value="coordinator">{t('dashboard.coordinator')}</option>
                  <option value="admin">{t('dashboard.admin')}</option>
                </select>
                <div className="flex justify-end gap-2">
                  <button type="button" className={ui.btnSecondary} onClick={()=>setCreateUserModalOpen(false)}>{t('common.cancel')}</button>
                  <button type="submit" className={ui.btnPrimary}>{t('dashboard.createUser')}</button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
