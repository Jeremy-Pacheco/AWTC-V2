import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { imageUrl } from "../../utils/images";
import type { Review } from "../../types/api";
import { API_URL, ITEMS_PER_PAGE, getTotalPages, paginate, type TabProps } from "./shared";
import PaginationControls from "./Pagination";

/** All reviews; admins (and the author) can delete them. */
export default function ReviewsTab({ token, user, setStatusMessage, openConfirm, closeConfirm }: TabProps) {
  const { t } = useTranslation();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [reviewsPage, setReviewsPage] = useState(1);

  useEffect(() => {
    fetch(`${API_URL}/api/reviews`).then(r => (r.ok ? r.json() : [])).then(d => setReviews(d || [])).catch(console.error);
  }, []);

  return (
    <>
          <div>
            <h3 className="font-bold mb-2">{t('dashboard.reviews')}</h3>
            <div>
              {reviews.length === 0 ? (
                <p className="text-gray-500 text-center py-4">{t('dashboard.noReviews')}</p>
              ) : (
                paginate(reviews, reviewsPage, ITEMS_PER_PAGE.reviews).map(r => (
                  <div key={r.id} className="border p-4 mb-3 rounded bg-white shadow-sm">
                    <div className="flex flex-col md:flex-row justify-between md:items-start gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <strong className="text-sm md:text-base">{r.user?.name || r.user?.email || 'Anonymous'}</strong>
                          <span className="text-xs text-gray-500">{new Date(r.date).toLocaleDateString()}</span>
                        </div>
                        <p className="text-sm text-gray-700 mb-2">{r.content}</p>
                        {r.image && (
                          <img 
                            src={imageUrl(r.image)} 
                            alt="Review" 
                            className="mt-2 max-w-xs rounded border"
                          />
                        )}
                      </div>
                      {(user.role === 'admin' || (r.user?.id != null && r.user.id === user.id)) && (
                        <div className="flex gap-2 flex-wrap md:flex-nowrap">
                          <button 
                            className="bg-danger text-white hover:bg-ink hover:text-white transition px-3 py-1 rounded-3xl text-sm" 
                            onClick={() => openConfirm(t('dashboard.deleteReview'), t('dashboard.deleteReviewConfirm'), async () => {
                              closeConfirm();
                              try {
                                const res = await fetch(`${API_URL}/api/reviews/${r.id}`, {
                                  method: 'DELETE',
                                  headers: { Authorization: `Bearer ${token}` }
                                });
                                if (!res.ok) {
                                  const err = await res.json();
                                  return setStatusMessage({ type: 'error', text: err.message || t('dashboard.errorDeleting') });
                                }
                                setReviews(prev => prev.filter(x => x.id !== r.id));
                                setStatusMessage({ type: 'success', text: t('dashboard.reviewDeleted') });
                              } catch (err) {
                                console.error(err);
                                setStatusMessage({ type: 'error', text: t('dashboard.errorDeleting') });
                              }
                            }, true)}
                          >
                            {t('common.delete')}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
            {reviews.length > 0 && (
              <PaginationControls
                currentPage={reviewsPage}
                totalPages={getTotalPages(reviews.length, ITEMS_PER_PAGE.reviews)}
                onPageChange={setReviewsPage}
              />
            )}
          </div>

    </>
  );
}
