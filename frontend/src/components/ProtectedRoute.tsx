import { useEffect, type ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/auth-context';

interface ProtectedRouteProps {
  children: ReactNode;
  /** Roles allowed; omitted = any signed-in user */
  roles?: string[];
}

/**
 * Client-side guard for private pages (audit task 3.8). It only improves the
 * experience: the API still checks every request on the server.
 * Logged out -> home + login modal; wrong role -> home.
 */
export default function ProtectedRoute({ children, roles }: ProtectedRouteProps) {
  const { isLoggedIn, user, openAuthModal } = useAuth();
  const allowed = isLoggedIn && (!roles || (user !== null && roles.includes(user.role)));

  useEffect(() => {
    if (!isLoggedIn) openAuthModal('login');
  }, [isLoggedIn, openAuthModal]);

  if (!allowed) return <Navigate to="/" replace />;
  return <>{children}</>;
}
