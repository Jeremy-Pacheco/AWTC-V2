/**
 * Authentication utility functions.
 *
 * Sessions (SEC-18): the API returns a short-lived access token (15 min) and
 * sets an httpOnly refresh cookie that JavaScript cannot read. The access
 * token is renewed before it expires (startTokenRefresh) and after a 401
 * (authenticatedFetch / handleAuthFetch), so components can keep reading it
 * from localStorage. Logging out revokes the refresh token on the server.
 */

const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:8080').replace(/\/+$/, '');

/** Custom header required by /api/auth/* (CSRF protection on the cookie) */
const AUTH_HEADERS = { 'X-Requested-With': 'awtc' };

function notifyAuthChanged(loggedIn: boolean) {
  window.dispatchEvent(new CustomEvent('authChanged', { detail: { loggedIn } }));
  try {
    localStorage.setItem('__auth_last_update', Date.now().toString());
  } catch {
    /* storage unavailable (private mode) */
  }
}

/**
 * Clears all authentication data from localStorage
 */
export function clearAuth() {
  localStorage.removeItem('jwtToken');
  localStorage.removeItem('userName');
  localStorage.removeItem('userRole');
  localStorage.removeItem('userEmail');
  localStorage.removeItem('userProfileImage');
  notifyAuthChanged(false);
}

/** Seconds since epoch when the token expires, or null if unreadable */
function tokenExpiry(token: string): number | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    return typeof payload.exp === 'number' ? payload.exp : null;
  } catch {
    return null;
  }
}

/**
 * Checks if the JWT token is expired (or expires within a minute)
 */
export function isTokenExpired(token: string): boolean {
  const exp = tokenExpiry(token);
  if (exp === null) return true;
  return Date.now() >= exp * 1000 - 60000;
}

let refreshInFlight: Promise<string | null> | null = null;

/**
 * Renews the access token with the refresh cookie. Concurrent callers share
 * one request. Resolves to the new token, or null when the session is over.
 */
export function refreshAccessToken(): Promise<string | null> {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const res = await fetch(`${API_URL}/api/auth/refresh`, {
            method: 'POST',
            credentials: 'include',
            headers: AUTH_HEADERS,
          });
          if (res.ok) {
            const data = await res.json();
            localStorage.setItem('jwtToken', data.access_token);
            if (data.user) {
              localStorage.setItem('userName', data.user.name);
              localStorage.setItem('userRole', data.user.role);
            }
            return data.access_token as string;
          }
          const body = await res.json().catch(() => ({}));
          // Another tab rotated the cookie a moment ago: retry once with it
          if (res.status === 401 && /retry/i.test(body.message || '') && attempt === 0) {
            await new Promise((resolve) => setTimeout(resolve, 300));
            continue;
          }
          return null;
        } catch {
          return null; // network error: keep the current state
        }
      }
      return null;
    })().finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

/**
 * Validates the current authentication status
 * Returns true if valid, false if expired or invalid
 */
export function validateAuth(): boolean {
  const token = localStorage.getItem('jwtToken');
  if (!token || isTokenExpired(token)) {
    // The refresh cookie may still renew the session in the background
    void refreshAccessToken().then((fresh) => { if (!fresh) clearAuth(); });
    return false;
  }
  return true;
}

/** Returns a valid access token, renewing it if needed */
async function currentToken(): Promise<string | null> {
  const token = localStorage.getItem('jwtToken');
  if (token && !isTokenExpired(token)) return token;
  return refreshAccessToken();
}

/**
 * Makes an authenticated fetch request with automatic token renewal
 * and 401 handling (one retry after renewing the session)
 */
export async function authenticatedFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const send = (token: string) => {
    const headers = new Headers(options.headers);
    headers.set('Authorization', `Bearer ${token}`);
    return fetch(url, { ...options, headers });
  };

  const token = await currentToken();
  if (!token) {
    clearAuth();
    throw new Error('Session expired. Please log in again.');
  }

  let response = await send(token);
  if (response.status === 401) {
    const fresh = await refreshAccessToken();
    if (fresh) response = await send(fresh);
  }
  if (response.status === 401) {
    clearAuth();
    throw new Error('Session expired. Please log in again.');
  }
  return response;
}

/**
 * Handles fetch response and checks for 401 errors
 * Use this as a wrapper for any fetch call that uses Bearer token
 */
export async function handleAuthFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  let response = await fetch(url, options);

  if (response.status === 401) {
    const fresh = await refreshAccessToken();
    const headers = new Headers(options.headers);
    if (fresh && headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${fresh}`);
      response = await fetch(url, { ...options, headers });
    }
  }

  if (response.status === 401) {
    console.warn('Received 401 Unauthorized. Session expired. Clearing authentication.');
    clearAuth();

    // Redirect to home after a short delay to allow state updates
    setTimeout(() => {
      if (window.location.pathname !== '/' && window.location.pathname !== '/home') {
        window.location.href = '/';
      }
    }, 100);
  }

  return response;
}

/**
 * Logs out on the server (revokes the refresh token) and locally.
 * Local data is cleared even if the server cannot be reached.
 */
export async function logoutOnServer(): Promise<void> {
  try {
    await fetch(`${API_URL}/api/auth/logout`, {
      method: 'POST',
      credentials: 'include',
      headers: AUTH_HEADERS,
    });
  } catch {
    /* offline: the refresh token will expire on its own */
  } finally {
    clearAuth();
  }
}

let refreshTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Keeps the access token fresh while the app is open: renews it about a
 * minute before it expires. Call once at startup; it follows logins/logouts.
 */
export function startTokenRefresh(): () => void {
  const schedule = () => {
    if (refreshTimer) clearTimeout(refreshTimer);
    refreshTimer = null;
    const token = localStorage.getItem('jwtToken');
    if (!token) return;
    const exp = tokenExpiry(token);
    if (exp === null) return;
    const delay = Math.max(exp * 1000 - Date.now() - 60000, 5000);
    refreshTimer = setTimeout(async () => {
      const fresh = await refreshAccessToken();
      if (fresh) schedule();
      else if (isTokenExpired(localStorage.getItem('jwtToken') || '')) clearAuth();
    }, delay);
  };

  schedule();
  window.addEventListener('authChanged', schedule);
  return () => {
    window.removeEventListener('authChanged', schedule);
    if (refreshTimer) clearTimeout(refreshTimer);
  };
}

/**
 * Initializes authentication check on page load
 * Call this once when the app starts
 */
export async function initAuthCheck(): Promise<void> {
  const token = localStorage.getItem('jwtToken');
  if (token && isTokenExpired(token)) {
    // Try to renew with the refresh cookie before giving up
    const fresh = await refreshAccessToken();
    if (fresh) notifyAuthChanged(true);
    else clearAuth();
  }
}
