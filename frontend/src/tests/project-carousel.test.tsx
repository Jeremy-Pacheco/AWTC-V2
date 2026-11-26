// Home carousel: slides from the API, navigation and empty state
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ProjectCarousel from '../components/ProjectCarousel';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'es' } }),
}));

const mockProjects = (data: unknown[]) =>
  vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true, json: async () => data } as Response);

afterEach(() => vi.restoreAllMocks());

describe('ProjectCarousel', () => {
  it('shows active projects, photo first, and moves with the arrows', async () => {
    mockProjects([
      { id: 1, name: 'No photo', status: 'active' },
      { id: 2, name: 'Beach Clean-Up', status: 'active', filename: 'beach.jpg', location: 'Las Canteras', category: { id: 1, name: 'Environment' } },
      { id: 3, name: 'Finished one', status: 'finished', filename: 'old.jpg' },
    ]);
    render(<MemoryRouter><ProjectCarousel /></MemoryRouter>);

    expect(await screen.findByText('Beach Clean-Up')).toBeTruthy();
    expect(screen.getByText('Environment')).toBeTruthy();
    expect(screen.getByText('Las Canteras')).toBeTruthy();
    expect(screen.queryByText('Finished one')).toBeNull();

    const slides = screen.getAllByRole('article', { hidden: true });
    expect(slides).toHaveLength(2);
    expect(slides[0].getAttribute('aria-hidden')).toBe('false');

    fireEvent.click(screen.getByRole('button', { name: 'home.carousel.next' }));
    expect(slides[1].getAttribute('aria-hidden')).toBe('false');
    expect(slides[0].getAttribute('aria-hidden')).toBe('true');
  });

  it('shows an empty state without projects', async () => {
    mockProjects([]);
    render(<MemoryRouter><ProjectCarousel /></MemoryRouter>);
    expect(await screen.findByText('home.carousel.empty')).toBeTruthy();
  });
});
