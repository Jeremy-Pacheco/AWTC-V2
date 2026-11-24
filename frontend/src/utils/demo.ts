/**
 * Demo mode (public test site). The backend decides whether it is enabled
 * (DEMO_MODE=true) and exposes it at GET /api/demo.
 */

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

export type DemoRole = 'volunteer' | 'coordinator' | 'admin';

export interface DemoConfig {
  enabled: boolean;
  maxUploadMb?: number;
  accounts?: { role: DemoRole; name: string }[];
}

let configPromise: Promise<DemoConfig> | null = null;

/** Fetched once per page load and shared by every component. */
export function getDemoConfig(): Promise<DemoConfig> {
  if (!configPromise) {
    configPromise = fetch(`${API_URL}/api/demo`)
      .then((res) => (res.ok ? res.json() : { enabled: false }))
      .then((data) => ({ ...data, enabled: data?.enabled === true }))
      .catch(() => ({ enabled: false }));
  }
  return configPromise;
}

/** Signs in as a shared demo account and stores the session like a normal login. */
export async function loginAsDemo(role: DemoRole): Promise<void> {
  const res = await fetch(`${API_URL}/api/demo/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || 'Could not sign in to the demo account');

  localStorage.setItem('jwtToken', data.access_token);
  localStorage.setItem('userName', data.user.name);
  localStorage.setItem('userRole', data.user.role);

  window.dispatchEvent(new CustomEvent('authChanged', { detail: { loggedIn: true } }));
  try { localStorage.setItem('__auth_last_update', Date.now().toString()); } catch { /* storage unavailable (private mode) */ }
}
