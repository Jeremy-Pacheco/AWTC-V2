import React, { useState, useEffect } from "react";
import AuthModal from "../components/AuthModal";
import AlertModal from "../components/AlertModal";
import ProjectCarousel from "../components/ProjectCarousel";
import logo4 from "../../../frontend/public/home/aboutUs-image.png";
import { NavLink } from "react-router-dom";
import { io, Socket } from "socket.io-client";
import { useTranslation } from "react-i18next";
import { handleAuthFetch } from "../utils/auth";
import { imageUrl } from '../utils/images';

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8080";

// --- SECTION HEADING ---
function SectionHeading({ eyebrow, title, subtitle }: { eyebrow: string; title: string; subtitle: string }) {
  return (
    <div>
      <span className="text-xs font-semibold uppercase tracking-widest text-brand-text">{eyebrow}</span>
      <h2 className="mt-2 text-3xl md:text-4xl font-bold tracking-tight">{title}</h2>
      <p className="mt-2 text-left text-base md:text-lg text-gray-600">{subtitle}</p>
    </div>
  );
}

// --- ABOUT SECTION ---
function AboutSection() {
  const { t } = useTranslation();
  return (
    <section className="mt-6 grid items-center gap-8 md:grid-cols-2 md:gap-12 rounded-3xl bg-surface p-5 md:p-10">
      <img
        src={logo4}
        alt="Volunteers"
        className="w-full h-64 md:h-80 object-cover rounded-2xl shadow-md"
      />
      <div>
        <p className="mb-6 text-left text-gray-700 leading-relaxed">
          {t('home.aboutSection.description')}
        </p>
        <NavLink
          to="/aboutus"
          className="inline-flex w-full md:w-auto justify-center items-center gap-2 rounded-full bg-brand px-6 py-2.5 font-semibold text-on-brand shadow transition-colors hover:bg-brand-hover"
        >
          {t('home.aboutSection.readMore')}
        </NavLink>
      </div>
    </section>
  );
}

// --- REVIEWS SECTION ---
interface ReviewsSectionProps {
  onOpenSignup: () => void;
  refreshTrigger: number;
}

interface Review {
  id: number;
  content: string;
  date: string;
  image?: string | null;
  userId: number;
  user?: { email?: string; name?: string; profileImage?: string | null };
}

function ReviewsSection({
  onOpenSignup,
  refreshTrigger,
}: ReviewsSectionProps) {
  const { t } = useTranslation();
  const [reviews, setReviews] = useState<Review[]>([]);

  const [showReviewModal, setShowReviewModal] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editContent, setEditContent] = useState("");
  const [editSelectedFile, setEditSelectedFile] = useState<File | null>(null);
  const [editRemoveImage, setEditRemoveImage] = useState(false);

  const [alertOpen, setAlertOpen] = useState(false);
  const [alertMessage, setAlertMessage] = useState("");

  const [token, setToken] = useState<string | null>(() =>
    localStorage.getItem("jwtToken")
  );
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const isLoggedIn = !!token;

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === "jwtToken") {
        setToken(e.newValue);
      }
    };

    const onAuthChanged = () => {
      setToken(localStorage.getItem("jwtToken"));
    };

    window.addEventListener("storage", onStorage);
    window.addEventListener("authChanged", onAuthChanged);

    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("authChanged", onAuthChanged);
    };
  }, []);

  useEffect(() => {
    if (!token) {
      setCurrentUserId(null);
      return;
    }
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      setCurrentUserId(payload.id ?? null);
    } catch (e) {
      console.error("Error decoding token", e);
      setCurrentUserId(null);
    }
  }, [token]);

  // Fetch reviews
  useEffect(() => {
    fetch(`${API_BASE_URL}/api/reviews`)
      .then((res) => {
        if (!res.ok) throw new Error("Error fetching reviews");
        return res.json();
      })
      .then((data) => {
        if (Array.isArray(data)) {
          const validReviews = data.filter(
            (review) => review.user && (review.user.name || review.user.email)
          );
          setReviews(validReviews);
        }
      })
      .catch((err) => console.error(err));
  }, [refreshTrigger]);

  // Reviews WebSocket: listen on public namespace '/reviews'
  useEffect(() => {
    let reviewsSocket: Socket | null = null;
    try {
      reviewsSocket = io(`${API_BASE_URL}/reviews`, {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionAttempts: 5
      });

      reviewsSocket.on('connected', () => {
        console.log('Connected to reviews socket namespace');
      });

      reviewsSocket.on('review_created', (data: { id: number; content: string; date: string; image?: string | null; userId: number; user?: { email?: string; name?: string }; }) => {
        console.log('review_created:', data);
        setReviews(prev => {
          // Avoid duplicates
          if (prev.some(r => r.id === data.id)) return prev;
          return [data as Review, ...prev];
        });
      });

      reviewsSocket.on('review_updated', (data: { id: number; content: string; date: string; image?: string | null; }) => {
        console.log('review_updated:', data);
        setReviews(prev => prev.map(r => r.id === data.id ? { ...r, content: data.content, image: data.image ?? null, date: data.date } : r));
      });

      reviewsSocket.on('review_deleted', (data: { reviewId: number; userId?: number }) => {
        console.log('review_deleted:', data);
        setReviews(prev => prev.filter(r => r.id !== data.reviewId));
      });

      reviewsSocket.on('connect_error', (error) => {
        console.error('Reviews socket connection error:', error);
      });
    } catch (error) {
      console.error('Error setting up reviews socket:', error);
    }

    return () => {
      if (reviewsSocket) {
        reviewsSocket.disconnect();
        console.log('Reviews socket disconnected');
      }
    };
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    try {
      const formData = new FormData();
      formData.append("content", newComment);
      if (selectedFile) {
        formData.append("image", selectedFile);
      }

      const res = await handleAuthFetch(`${API_BASE_URL}/api/reviews`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (res.ok) {
        const savedReview = await res.json();
        setReviews([savedReview, ...reviews]);
        setNewComment("");
        setSelectedFile(null);
        setShowReviewModal(false);
      } else {
        setAlertMessage("Error creating review");
        setAlertOpen(true);
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm(t('reviews.confirmDelete'))) return;
    try {
      const res = await handleAuthFetch(`${API_BASE_URL}/api/reviews/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setReviews(reviews.filter((r) => r.id !== id));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const saveEdit = async (id: number) => {
    try {
      let res;
      if (editSelectedFile || editRemoveImage) {
        const formData = new FormData();
        formData.append("content", editContent);
        if (editSelectedFile) formData.append("image", editSelectedFile);
        if (editRemoveImage) formData.append("removeImage", "true");

        res = await handleAuthFetch(`${API_BASE_URL}/api/reviews/${id}`, {
          method: "PUT",
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        });
      } else {
        res = await handleAuthFetch(`${API_BASE_URL}/api/reviews/${id}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ content: editContent }),
        });
      }

      if (res.ok) {
        const updatedReview = await res.json();
        setReviews(
          reviews.map((r) =>
            r.id === id
              ? { ...r, content: updatedReview.content, image: updatedReview.image ?? null }
              : r
          )
        );
        setEditingId(null);
        setEditSelectedFile(null);
        setEditRemoveImage(false);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const getUserDisplayName = (user?: { email?: string; name?: string }) => {
    if (user?.name) return user.name;
    if (user?.email) return user.email.split("@")[0];
    return "User";
  };

  return (
    <>
      <section>
      <div className="flex flex-col gap-6 items-start w-full">
        <div className="flex w-full flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <span className="text-xs font-semibold uppercase tracking-widest text-brand-text">{t('reviews.eyebrow')}</span>
            <h2 className="mt-2 text-3xl md:text-4xl font-bold tracking-tight">{t('reviews.title')}</h2>
            <span className="mt-3 inline-block rounded-full bg-surface px-3 py-1 text-xs font-medium text-gray-600">
              {t('reviews.comments', { count: reviews.length })}
            </span>
          </div>
          {isLoggedIn && (
            <button
              onClick={() => setShowReviewModal(true)}
              className="rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-on-brand shadow transition-colors hover:bg-brand-hover w-full sm:w-auto"
            >
              {t('reviews.writeReview')}
            </button>
          )}
        </div>

        <div className="w-full columns-1 md:columns-2 gap-4">
          {reviews.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-300 py-10 text-center text-gray-500">
              {t('reviews.noReviews')}
            </div>
          ) : (
            reviews.map((review) => (
              <div
                key={review.id}
                className="mb-4 break-inside-avoid flex flex-col rounded-2xl border border-gray-200 bg-[var(--card-bg)] p-6 shadow-sm transition-shadow hover:shadow-md"
              >
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-center gap-3">
                    {/* Profile Image */}
                    {review.user?.profileImage ? (
                      <img
                        src={imageUrl(review.user.profileImage)}
                        alt={getUserDisplayName(review.user)}
                        className="w-10 h-10 rounded-full object-cover border border-gray-200"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                          (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
                        }}
                      />
                    ) : null}
                    <div 
                      className={`w-10 h-10 rounded-full bg-brand flex items-center justify-center text-on-brand font-bold text-lg ${review.user?.profileImage ? 'hidden' : ''}`}
                    >
                      {getUserDisplayName(review.user).charAt(0).toUpperCase()}
                    </div>
                    <div className="flex flex-col">
                      <span className="font-bold text-gray-900 text-base capitalize">
                        {getUserDisplayName(review.user)}
                      </span>
                      <span className="text-xs text-gray-400 mt-0.5">
                        {new Date(review.date).toLocaleDateString(undefined, {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                    </div>
                  </div>

                  {currentUserId === review.userId && !editingId && (
                    <div className="flex gap-3 text-sm font-medium">
                      <button
                        onClick={() => {
                          setEditingId(review.id);
                          setEditContent(review.content);
                        }}
                        className="text-green-600 hover:text-green-800 transition-colors"
                      >
                        {t('common.edit')}
                      </button>
                      <button
                        onClick={() => handleDelete(review.id)}
                        className="text-red-500 hover:text-red-700 transition-colors"
                      >
                        {t('common.delete')}
                      </button>
                    </div>
                  )}
                </div>

                {review.image && (
                  <div className="mb-4">
                    <img
                      src={imageUrl(review.image)}
                      alt="Attached"
                      className="h-40 w-full object-cover rounded-xl cursor-zoom-in hover:opacity-95"
                      onClick={() =>
                        window.open(
                          imageUrl(review.image),
                          "_blank"
                        )
                      }
                    />
                  </div>
                )}

                {editingId === review.id ? (
                  <div className="mt-2 animate-fade-in">
                    <textarea
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      className="w-full border border-gray-200 p-3 rounded-xl text-sm focus:ring-2 focus:ring-brand-400 outline-none resize-none bg-gray-50"
                    />

                    {review.image && !editRemoveImage && !editSelectedFile && (
                      <div className="mt-3 mb-2">
                        <img
                          src={imageUrl(review.image)}
                          alt="Current"
                          className="h-24 w-auto object-cover rounded-lg"
                        />
                      </div>
                    )}

                    {editSelectedFile && (
                      <div className="mt-3 mb-2">
                        <img
                          src={URL.createObjectURL(editSelectedFile)}
                          alt="New preview"
                          className="h-24 w-auto object-cover rounded-lg"
                        />
                      </div>
                    )}

                    <div className="flex items-center justify-between gap-4 mt-3">
                      <div>
                        <input
                          id={`editFileInput-${review.id}`}
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            const f = e.target.files && e.target.files[0];
                            setEditSelectedFile(f ?? null);
                            if (f) setEditRemoveImage(false);
                          }}
                          className="hidden"
                        />
                        <label
                          htmlFor={`editFileInput-${review.id}`}
                          className="cursor-pointer flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-black transition-colors"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                            strokeWidth={1.5}
                            stroke="currentColor"
                            className="w-5 h-5"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M4.5 12.75l6 6 9-13.5"
                            />
                          </svg>
                          {editSelectedFile
                            ? editSelectedFile.name
                            : t('reviews.addReplaceImage')}
                        </label>
                      </div>

                      {review.image && (
                        <button
                          type="button"
                          onClick={() => {
                            setEditRemoveImage((prev) => {
                              const next = !prev;
                              if (next) setEditSelectedFile(null);
                              return next;
                            });
                          }}
                          className={`text-sm px-3 py-1 rounded-full border ${
                            editRemoveImage
                              ? "bg-red-50 text-red-600 border-red-200"
                              : "bg-gray-100 text-gray-700 border-gray-200"
                          }`}
                        >
                          {editRemoveImage
                            ? t('reviews.imageWillBeRemoved')
                            : t('reviews.removeImage')}
                        </button>
                      )}
                    </div>

                    <div className="flex gap-2 mt-3 justify-end">
                      <button
                        onClick={() => {
                          setEditingId(null);
                          setEditSelectedFile(null);
                          setEditRemoveImage(false);
                        }}
                        className="px-4 py-1.5 rounded-full text-xs font-medium bg-gray-100 hover:bg-gray-200"
                      >
                        {t('common.cancel')}
                      </button>
                      <button
                        onClick={() => saveEdit(review.id)}
                        className="px-4 py-1.5 rounded-full text-xs font-medium bg-brand text-black hover:bg-ink hover:text-white"
                      >
                        {t('common.save')}
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="text-left text-gray-700 leading-relaxed text-base">
                    “{review.content}”
                  </p>
                )}
              </div>
            ))
          )}
        </div>

        {!isLoggedIn && (
          <div className="w-full flex flex-col items-center gap-4 rounded-3xl border border-brand-100 bg-brand-50 p-8 md:p-10 text-center">
            <h3 className="text-xl md:text-2xl font-bold text-gray-800">
              {t('reviews.joinConversation')}
            </h3>
            <p className="text-center text-sm md:text-base text-gray-600">
              {t('reviews.shareExperience')}
            </p>

            <button
              onClick={onOpenSignup}
              className="rounded-full bg-brand px-6 py-2.5 font-semibold text-on-brand shadow transition-colors hover:bg-brand-hover"
            >
              {t('reviews.addReview')}
            </button>
          </div>
        )}
      </div>

      {showReviewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg p-8 relative">
            <button
              onClick={() => setShowReviewModal(false)}
              className="absolute top-4 right-5 text-gray-400 hover:text-black text-xl font-light"
            >
              ✕
            </button>

            <h3 className="text-2xl font-bold mb-1 text-gray-900">
              {t('reviews.newReview')}
            </h3>
            <p className="text-sm text-gray-500 mb-6">
              {t('reviews.howWasExperience')}
            </p>

            <form onSubmit={handleCreate}>
              <textarea
                className="w-full bg-gray-50 border border-gray-200 rounded-xl p-4 h-40 resize-none mb-4 focus:ring-2 focus:ring-brand focus:bg-white outline-none transition-all placeholder-gray-400"
                placeholder={t('reviews.placeholder')}
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                autoFocus
              />

              <div className="flex items-center justify-between mb-8">
                <div>
                  <input
                    id="fileInputModal"
                    type="file"
                    accept="image/*"
                    onChange={(e) =>
                      e.target.files && setSelectedFile(e.target.files[0])
                    }
                    className="hidden"
                  />
                  <label
                    htmlFor="fileInputModal"
                    className="cursor-pointer flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-black transition-colors"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={1.5}
                      stroke="currentColor"
                      className="w-5 h-5"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z"
                      />
                    </svg>
                    {selectedFile ? (
                      <span className="text-green-600">
                        {selectedFile.name}
                      </span>
                    ) : (
                      t('reviews.addPhoto')
                    )}
                  </label>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowReviewModal(false)}
                  className="flex-1 py-3 rounded-full font-semibold text-gray-500 hover:bg-gray-100 transition-colors"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-brand text-black hover:bg-ink hover:text-white font-bold py-3 rounded-full transition-all shadow-lg hover:shadow-xl"
                >
                  {t('reviews.postReview')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      </section>
      <AlertModal open={alertOpen} message={alertMessage} onAccept={() => setAlertOpen(false)} />
    </>
  );
}

// --- HOME PAGE ---
function Home() {
  const { t } = useTranslation();
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [refreshKey, setRefreshKey] = useState(0);

  const handleOpenSignup = () => {
    setAuthMode("signup");
    setAuthOpen(true);
  };

  const handleCloseAuth = () => {
    setAuthOpen(false);
    setRefreshKey((prev) => prev + 1);
  };

  return (
    <>
      <header className="relative isolate overflow-hidden">
        <img
          src="/hero-img.jpg"
          alt=""
          className="absolute inset-0 -z-10 h-full w-full object-cover"
        />
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-black/80 via-black/55 to-black/25" />
        <div className="max-w-6xl mx-auto px-4 md:px-6 py-20 md:py-32">
          <span className="inline-block rounded-full border border-brand-300/50 bg-brand-900/40 px-3 py-1 text-xs font-semibold uppercase tracking-widest !text-brand-200">
            {t('home.hero.eyebrow')}
          </span>
          <h1 className="mt-4 max-w-2xl text-4xl md:text-6xl font-bold leading-[1.05] tracking-tight !text-white">
            {t('common.appName')}
          </h1>
          <p className="mt-4 max-w-xl text-left text-lg md:text-xl !text-white/85">
            {t('home.hero.subtitle')}
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-3">
            <NavLink
              to="/volunteering"
              className="inline-flex justify-center rounded-full bg-brand px-6 py-3 font-semibold text-on-brand shadow-lg transition-colors hover:bg-brand-hover"
            >
              {t('home.hero.explore')}
            </NavLink>
            <NavLink
              to="/aboutus"
              className="inline-flex justify-center rounded-full border border-white/40 bg-black/20 px-6 py-3 font-semibold !text-white backdrop-blur-sm transition-colors hover:bg-black/40"
            >
              {t('home.aboutUs')}
            </NavLink>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 md:px-6 py-12 md:py-16 space-y-16 md:space-y-24">
        <div>
          <SectionHeading eyebrow={t('home.projectsEyebrow')} title={t('home.newestProjects')} subtitle={t('home.discoverProjects')} />
          <ProjectCarousel />
        </div>

        <div>
          <SectionHeading eyebrow={t('home.aboutEyebrow')} title={t('home.aboutUs')} subtitle={t('home.aboutUsDescription')} />
          <AboutSection />
        </div>
        <ReviewsSection
          onOpenSignup={handleOpenSignup}
          refreshTrigger={refreshKey}
        />
      </main>

      <AuthModal open={authOpen} mode={authMode} onClose={handleCloseAuth} />
    </>
  );
}

export default Home;