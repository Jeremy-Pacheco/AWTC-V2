import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AuthContext, type AuthState } from './auth-context';
import { logoutOnServer } from '../utils/auth';

function readSession(): AuthState['user'] {
  try {
    const token = localStorage.getItem('jwtToken');
    if (!token) return null;
    return {
      name: localStorage.getItem('userName') || '',
      role: localStorage.getItem('userRole') || '',
    };
  } catch {
    return null; // storage unavailable (private mode)
  }
}

/**
 * Single source of the session state for the whole app (audit task 3.8).
 * Follows logins, logouts and token renewals made anywhere: the "authChanged"
 * event in this tab and the "storage" event from other tabs.
 */
export default function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthState['user']>(readSession);

  useEffect(() => {
    const sync = () => setUser(readSession());
    const onStorage = (e: StorageEvent) => {
      if (e.key === null || ['jwtToken', 'userName', 'userRole', '__auth_last_update'].includes(e.key)) sync();
    };
    window.addEventListener('authChanged', sync);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener('authChanged', sync);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  const logout = useCallback(() => logoutOnServer(), []);
  const openAuthModal = useCallback((mode: 'login' | 'signup' = 'login') => {
    window.dispatchEvent(new CustomEvent('openAuthModal', { detail: { mode } }));
  }, []);

  const value = useMemo<AuthState>(
    () => ({ isLoggedIn: user !== null, user, logout, openAuthModal }),
    [user, logout, openAuthModal]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
