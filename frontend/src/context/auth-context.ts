import { createContext, useContext } from 'react';

export interface AuthState {
  isLoggedIn: boolean;
  /** Display name and role of the signed-in user (null when logged out) */
  user: { name: string; role: string } | null;
  /** Logs out on the server (revokes the refresh token) and locally */
  logout: () => Promise<void>;
  /** Opens the login / sign-up modal (handled by NavBar) */
  openAuthModal: (mode?: 'login' | 'signup') => void;
}

export const AuthContext = createContext<AuthState | null>(null);

/** Current session; must be used inside <AuthProvider> */
export function useAuth(): AuthState {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside <AuthProvider>');
  return value;
}
