// Smoke test of the split dashboard (audit task 3.8): every tab renders its data
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Dashboard from '../pages/Dashboard';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const admin = { id: 1, name: 'Ada Admin', email: 'ada@example.com', role: 'admin' };
const coordinator = { id: 2, name: 'Coco Coordinator', email: 'coco@example.com', role: 'coordinator' };
const API: Record<string, unknown> = {
  '/api/users/dashboard': { user: admin },
  '/api/users/dashboard/projects': { projects: [{ id: 7, name: 'My Beach Day', description: 'mine' }] },
  '/api/categories': [{ id: 3, name: 'Environment', description: 'Green things' }],
  '/api/users': [admin, coordinator],
  '/api/projects': [{ id: 5, name: 'Planting trees', description: 'Trees', ownerId: 2, categoryId: 3, status: 'active' }],
  '/api/reviews': [{ id: 9, content: 'Lovely day', date: '2026-11-20', user: { id: 4, name: 'Vera' } }],
  '/api/contacts': [{ id: 11, name: 'Jordan', email: 'jordan@example.com', message: 'Group question', read: false }],
};

beforeEach(() => {
  localStorage.setItem('jwtToken', 'token');
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const path = new URL(String(input), 'http://api.test').pathname;
    const body = API[path];
    return { ok: body !== undefined, status: body !== undefined ? 200 : 404, json: async () => body } as Response;
  });
});
afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

describe('Dashboard', () => {
  it('shows every tab of an admin with its data', async () => {
    render(<MemoryRouter><Dashboard /></MemoryRouter>);

    // Profile (default tab): name in the sidebar and in the profile card
    expect((await screen.findAllByText('Ada Admin')).length).toBe(2);
    // Role badge in the sidebar
    expect(screen.getAllByText('dashboard.admin').length).toBeGreaterThan(0);

    // The other tabs are preloaded in the background, hidden until opened
    await waitFor(() => expect(screen.getByText('coco@example.com').closest('[hidden]')).not.toBeNull());

    // Preloaded tabs stay in the DOM, so only look at the visible one
    const visible = (text: string | RegExp) =>
      screen.queryAllByText(text).filter((el) => !el.closest('[hidden]'));

    const open = async (tab: string, text: string) => {
      fireEvent.click(screen.getByRole('button', { name: tab }));
      expect(screen.getByRole('heading', { level: 1, name: tab })).toBeTruthy();
      await waitFor(() => expect(visible(text)).toHaveLength(1));
    };
    await open('dashboard.myProjects', 'My Beach Day');
    await open('dashboard.projects', 'Planting trees');
    // admins see the responsible coordinator of each project
    expect(visible(/Coco Coordinator/).length).toBeGreaterThan(0);
    await open('dashboard.categories', 'Green things');
    await open('dashboard.reviews', 'Lovely day');
    await open('dashboard.users', 'coco@example.com');
    await open('dashboard.incidents', 'Group question');
  });

  it('hides staff tabs from volunteers', async () => {
    API['/api/users/dashboard'] = { user: { id: 4, name: 'Vera', role: 'volunteer' } };
    render(<MemoryRouter><Dashboard /></MemoryRouter>);
    expect((await screen.findAllByText('Vera')).length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: 'dashboard.projects' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'dashboard.users' })).toBeNull();
    API['/api/users/dashboard'] = { user: admin };
  });
});
