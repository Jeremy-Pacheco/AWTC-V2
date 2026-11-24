const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:8080').replace(/\/+$/, '');

/**
 * Builds the URL of a stored image. The backend may return:
 * - an absolute URL (Cloudinary, STORAGE_PROVIDER=cloudinary) -> used as is
 * - a path such as "/images/x.png" (reviews)                 -> prefixed with the API URL
 * - a bare file name such as "x.png" (projects, profiles)    -> served from /images
 */
export function imageUrl(value?: string | null): string {
  if (!value) return '';
  if (/^https?:\/\//i.test(value)) return value;
  if (value.startsWith('/')) return `${API_URL}${value}`;
  return `${API_URL}/images/${value}`;
}
