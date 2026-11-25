import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import type { Category } from "../../types/api";
import { API_URL, ITEMS_PER_PAGE, getTotalPages, modalVariants, paginate, type TabProps } from "./shared";
import PaginationControls from "./Pagination";

/** Admin/coordinator: categories list and form. */
export default function CategoriesTab({ token, setStatusMessage, openConfirm, closeConfirm, categories, setCategories }: TabProps & { categories: Category[]; setCategories: React.Dispatch<React.SetStateAction<Category[]>> }) {
  const { t } = useTranslation();
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [categoryForm, setCategoryForm] = useState({ name: '', description: '' });
  const [categoriesPage, setCategoriesPage] = useState(1);

  return (
    <>
                  <div>
                    <div className="mb-6 flex flex-col md:flex-row justify-between md:items-center gap-3">
                      <h3 className="font-bold mb-2 md:mb-0">{t('dashboard.categories')}</h3>
                      <button className="bg-brand text-black hover:bg-ink hover:text-white px-4 py-2 rounded-2xl font-semibold shadow text-sm w-full md:w-auto" onClick={() => { setCategoryModalOpen(true); setEditingCategory(null); setCategoryForm({ name: '', description: '' }); }}>
                        {t('dashboard.addCategory')}
                      </button>
                    </div>
                    <div className="mb-4">
                      {paginate((categories || []), categoriesPage, ITEMS_PER_PAGE.categories).map(c => (
                        <div key={c.id} className="border p-3 mb-2 rounded">
                          <div className="flex flex-col md:flex-row justify-between md:items-start gap-3">
                            <div className="flex-1">
                              <strong className="text-sm md:text-base">{c.name}</strong><br />
                              <div className="text-xs md:text-sm text-gray-600">{c.description}</div>
                            </div>
                            <div className="flex gap-2 flex-wrap md:flex-nowrap">
                              <button className="border border-muted text-black hover:bg-ink hover:text-white transition px-3 py-1 rounded-3xl text-sm" onClick={() => { setEditingCategory(c); setCategoryModalOpen(true); setCategoryForm({ name: c.name, description: c.description || '' }); }}>{t('common.edit')}</button>
                              <button className="bg-danger text-white hover:bg-ink hover:text-white transition px-3 py-1 rounded-3xl text-sm" onClick={() => openConfirm(t('dashboard.deleteCategory'), t('dashboard.deleteCategoryConfirm'), async () => { closeConfirm(); try { const res = await fetch(`${API_URL}/api/categories/${c.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }); if (!res.ok) { const err = await res.json(); setStatusMessage({ type: 'error', text: err.message || t('dashboard.errorDeleting') }); return; } setCategories(prev => prev.filter(x => x.id !== c.id)); setStatusMessage({ type: 'success', text: t('dashboard.categoryDeleted') }); } catch (err) { console.error(err); setStatusMessage({ type: 'error', text: t('dashboard.errorDeleting') }); } }, true)}>{t('common.delete')}</button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    {categories && categories.length > 0 && (
                      <PaginationControls
                        currentPage={categoriesPage}
                        totalPages={getTotalPages(categories.length, ITEMS_PER_PAGE.categories)}
                        onPageChange={setCategoriesPage}
                      />
                    )}
                  </div>
      {/* Category Modal (Admin/Coordinator) */}
      <AnimatePresence>
        {categoryModalOpen && (
          <motion.div
            className="fixed inset-0 z-50 flex justify-center items-center bg-black/10 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            onClick={() => { setCategoryModalOpen(false); setEditingCategory(null); }}
          >
            <motion.div
              className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md"
              variants={modalVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              transition={{ duration: 0.3, type: "spring", stiffness: 120 }}
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-2xl font-bold mb-4">{editingCategory ? t('dashboard.editCategory') : t('dashboard.createCategory')}</h2>
              <form onSubmit={async (e) => {
                e.preventDefault();
                if (!token) return setStatusMessage({ type: 'error', text: t('dashboard.loginRequired') });
                try {
                  let url = `${API_URL}/api/categories`;
                  let method = 'POST';
                  if (editingCategory) { url = `${API_URL}/api/categories/${editingCategory.id}`; method = 'PUT'; }
                  const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(categoryForm) });
                  if (!res.ok) { const err = await res.json(); return setStatusMessage({ type: 'error', text: err.message || t('dashboard.errorSaving') }); }
                  await res.json();
                  // reload categories
                  const all = await fetch(`${API_URL}/api/categories`).then(r => r.json());
                  setCategories(all);
                  setCategoryModalOpen(false);
                  setEditingCategory(null);
                  setStatusMessage({ type: 'success', text: editingCategory ? t('dashboard.categoryUpdated') : t('dashboard.categoryCreated') });
                } catch (err) { console.error(err); setStatusMessage({ type: 'error', text: t('dashboard.errorSaving') }); }
              }} className="flex flex-col gap-3">
                <div>
                  <label className="block font-semibold mb-1">{t('dashboard.name')}:</label>
                  <input className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-brand-400 outline-none" placeholder={t('dashboard.categoryName')} value={categoryForm.name} onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })} required />
                </div>
                <div>
                  <label className="block font-semibold mb-1">{t('dashboard.description')}:</label>
                  <textarea className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-brand-400 outline-none" placeholder={t('dashboard.categoryDescription')} rows={4} value={categoryForm.description} onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })} />
                </div>
                <div className="flex gap-2 mt-2 flex-col sm:flex-row w-full sm:w-auto sm:ml-auto">
                  <button type="button" className="px-4 py-2 rounded-3xl border border-muted hover:bg-ink hover:text-white transition-colors duration-200 text-sm flex-1 sm:flex-none" onClick={() => { setCategoryModalOpen(false); setEditingCategory(null); }}>{t('common.cancel')}</button>
                  <button type="submit" className="bg-brand text-black hover:bg-ink hover:text-white px-4 py-2 rounded-3xl font-semibold transition-colors text-sm flex-1 sm:flex-none">{editingCategory ? t('common.save') : t('dashboard.createCategory')}</button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
