import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import { imageUrl } from "../../utils/images";
import { clearAuth } from "../../utils/auth";
import { API_URL, modalVariants, type TabProps } from "./shared";

/** Profile: view, edit (name + photo) and delete own account. */
export default function ProfileTab({ token, user, setStatusMessage, openConfirm, closeConfirm, setUser, onAccountDeleted }: TabProps & { setUser: (u: TabProps["user"]) => void; onAccountDeleted: () => void }) {
  const { t } = useTranslation();
  const [showEditModal, setShowEditModal] = useState(false);
  const [editName, setEditName] = useState(user.name || "");
  const [editFile, setEditFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [imageVersion, setImageVersion] = useState<number>(Date.now());
  const profileImageUrl = user.profileImage
    ? `${imageUrl(user.profileImage)}?v=${imageVersion}`
    : "/images/default-avatar.png";

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selected = e.target.files[0];
      setEditFile(selected);
      setPreview(URL.createObjectURL(selected));
    }
  };

  const handleDeleteOwnProfile = async () => {
    if (!token) return setStatusMessage({ type: 'error', text: t('dashboard.loginRequired') });
    try {
      const res = await fetch(`${API_URL}/api/users/dashboard`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) { const err = await res.json(); return setStatusMessage({ type: 'error', text: err.message || t('dashboard.errorDeleting') }); }
      // The account no longer exists: clear the local session and go home
      clearAuth();
      setStatusMessage({ type: 'success', text: t('dashboard.profileDeleted') });
      onAccountDeleted();
    } catch (err) { console.error(err); setStatusMessage({ type: 'error', text: t('dashboard.errorDeleting') }); }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !token) return setStatusMessage({ type: 'error', text: t('dashboard.authRequired') });

    const formData = new FormData();
    formData.append("name", editName);
    if (editFile) formData.append("file", editFile);

    try {
      const res = await fetch(`${API_URL}/api/users/dashboard`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json();
        return setStatusMessage({ type: 'error', text: err.message || t('dashboard.errorSaving') });
      }

      const data = await res.json();

      setUser({
        ...user,
        name: data.user.name,
        profileImage: data.user.profileImage,
      });

      localStorage.setItem("userName", data.user.name);
      if (data.user.profileImage) {
        localStorage.setItem("userProfileImage", data.user.profileImage);
      }

      setPreview(null);
      setImageVersion(Date.now());
      setShowEditModal(false);
      setStatusMessage({ type: 'success', text: t('dashboard.profileUpdated') });

    } catch (err) {
      console.error(err);
      setStatusMessage({ type: 'error', text: t('dashboard.errorSaving') });
    }
  };

  return (
    <>
          <div className="flex flex-col items-center gap-4">
            <img
              src={preview || profileImageUrl}
              alt="Profile"
              className="w-32 h-32 rounded-full object-cover border"
            />
            <h3 className="text-xl font-bold">{user.name}</h3>
            <p>{user.email}</p>
            <button
              className="mt-3 border border-muted text-black px-4 py-2 rounded-3xl hover:bg-ink hover:text-white transition"
              onClick={() => setShowEditModal(true)}
            >
              {t('dashboard.editProfile')}
            </button>
            <button
              className="mt-3 bg-danger text-white px-4 py-2 rounded-3xl hover:bg-ink hover:text-white transition"
              onClick={() => openConfirm(t('dashboard.deleteProfile'), t('dashboard.deleteProfileConfirm'), async () => { closeConfirm(); await handleDeleteOwnProfile(); }, true)}
            >
              {t('dashboard.deleteProfile')}
            </button>
            
          </div>
      {/* Edit Profile Modal */}
      <AnimatePresence>
        {showEditModal && (
          <motion.div
            className="fixed inset-0 z-50 flex justify-center items-center bg-black/40 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={() => setShowEditModal(false)}
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
              <h2 className="text-xl md:text-2xl font-bold mb-4">{t('dashboard.editProfile')}</h2>
              <form
                onSubmit={handleUpdateProfile}
                className="flex flex-col gap-3"
              >
                <div className="flex flex-col items-center">
                  <img
                    src={preview || profileImageUrl}
                    alt="Profile"
                    className="w-24 md:w-32 h-24 md:h-32 rounded-full object-cover border"
                  />
                  <label className="mt-4 px-6 py-3 border-2 border-dashed border-brand rounded-lg bg-brand-50 hover:bg-brand-100 cursor-pointer transition-colors text-center">
                    <span className="text-sm font-semibold text-gray-700">{t('dashboard.uploadImage')}</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                  </label>
                </div>

                <div>
                  <label className="block font-semibold mb-1 text-sm">{t('dashboard.name')}:</label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-brand-400 outline-none text-sm"
                    required
                  />
                </div>

                <div className="flex gap-2 mt-2 flex-col sm:flex-row w-full sm:w-auto sm:ml-auto">
                  <button
                    type="button"
                    className="px-4 py-2 rounded-3xl border border-muted hover:bg-ink hover:text-white transition-colors duration-200 text-sm flex-1 sm:flex-none"
                    onClick={() => setShowEditModal(false)}
                  >
                    {t('common.cancel')}
                  </button>
                  <button
                    type="submit"
                    className="bg-brand text-black hover:bg-ink hover:text-white px-4 py-2 rounded-3xl font-semibold transition-colors text-sm flex-1 sm:flex-none"
                  >
                    {t('common.save')}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
