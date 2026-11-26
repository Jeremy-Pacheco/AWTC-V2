import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Contact } from "../../types/api";
import * as ui from "./ui";
import { API_URL, ITEMS_PER_PAGE, getTotalPages, paginate, type TabProps } from "./shared";
import PaginationControls from "./Pagination";

/** Admin: contact messages (incidents), close and delete. */
export default function ContactsTab({ token, setStatusMessage, openConfirm, closeConfirm }: TabProps) {
  const { t } = useTranslation();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [contactsFilter, setContactsFilter] = useState<'open'|'closed'|'all'>('open');
  const [incidentsPage, setIncidentsPage] = useState(1);

  useEffect(() => {
    fetch(`${API_URL}/api/contacts`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => (r.ok ? r.json() : []))
      .then(setContacts)
      .catch(console.error);
  }, [token]);

  return (
    <>
                  <div>
                    <div className="mb-4 flex flex-col sm:flex-row gap-2 sm:items-center">
                      <label className="text-sm">{t('dashboard.filter')}:</label>
                      <select value={contactsFilter} onChange={(e) => setContactsFilter(e.target.value as 'open'|'closed'|'all')} className={`${ui.field} sm:w-48`}>
                        <option value="open">{t('dashboard.open')}</option>
                        <option value="closed">{t('dashboard.closed')}</option>
                        <option value="all">{t('dashboard.all')}</option>
                      </select>
                    </div>
                    <div>
                      {paginate(contacts.filter(c => contactsFilter === 'all' ? true : (contactsFilter === 'open' ? !c.read : c.read)), incidentsPage, ITEMS_PER_PAGE.incidents).map(c => (
                        <div key={c.id} className={ui.card}>
                          <div className="flex flex-col md:flex-row justify-between gap-2 md:items-start">
                            <div className="flex flex-wrap items-center gap-2"><strong className="text-base">{c.name}</strong><span className={ui.badge(c.read ? 'closed' : 'open')}>{c.read ? t('dashboard.closed') : t('dashboard.open')}</span><span className="w-full text-xs md:text-sm text-gray-500">{c.email}</span></div>
                            <div className="flex gap-2 flex-wrap md:justify-end">
                              { !c.read && <button className={ui.btnSecondary} onClick={async ()=>{
                                // mark as read/closed
                                try {
                                  const res = await fetch(`${API_URL}/api/contacts/${c.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ read: true }) });
                                  if (!res.ok) { const err = await res.json(); return setStatusMessage({ type: 'error', text: err.message || t('dashboard.networkError') }); }
                                  const updated = await res.json();
                                  setContacts(prev => prev.map(x => x.id === c.id ? updated : x));
                                } catch (err) { console.error(err); setStatusMessage({ type: 'error', text: t('dashboard.networkError') }); }
                              }}>{t('dashboard.close')}</button> }
                              <button className={ui.btnDanger} onClick={() => openConfirm(t('dashboard.deleteMessage'), t('dashboard.deleteMessageConfirm'), async () => { closeConfirm(); try { const res = await fetch(`${API_URL}/api/contacts/${c.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }); if (!res.ok) { const err = await res.json(); setStatusMessage({ type: 'error', text: err.message || t('dashboard.networkError') }); return; } setContacts(prev => prev.filter(x => x.id !== c.id)); setStatusMessage({ type: 'success', text: t('dashboard.messageDeleted') }); } catch (err) { console.error(err); setStatusMessage({ type: 'error', text: t('dashboard.errorDeleting') }); } }, true)}>{t('common.delete')}</button>
                            </div>
                          </div>
                          <div className="mt-2 text-sm">{c.message}</div>
                          <div className="mt-2 text-xs md:text-sm text-gray-500">{c.createdAt ? new Date(c.createdAt).toLocaleString() : ''}</div>
                        </div>
                      ))}
                    </div>
                    {contacts && contacts.length > 0 && (
                      <PaginationControls
                        currentPage={incidentsPage}
                        totalPages={getTotalPages(contacts.filter(c => contactsFilter === 'all' ? true : (contactsFilter === 'open' ? !c.read : c.read)).length, ITEMS_PER_PAGE.incidents)}
                        onPageChange={setIncidentsPage}
                      />
                    )}
                  </div>

    </>
  );
}
