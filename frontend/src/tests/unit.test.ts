import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getProjects, getCategories, getReviews } from '../api';
import { isNotificationSupported, getNotificationPermission } from '../services/notificationService';

// Typed fetch mock: tests return partial Response objects
type FetchMock = (...args: Parameters<typeof fetch>) => Promise<Partial<Response>>;
const fetchMock = vi.fn<FetchMock>();
// Browser globals replaced by the notification tests
const browserGlobals = globalThis as unknown as Record<string, unknown>;

describe('Unit Tests - API Functions', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Test 1: getProjects
  it('should fetch projects successfully', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => [
        { id: 1, name: 'Project 1', description: 'Test', categoryId: 1 },
        { id: 2, name: 'Project 2', description: 'Test 2', categoryId: 2 }
      ],
    });

    const projects = await getProjects();
    expect(projects).toHaveLength(2);
    expect(projects[0].name).toBe('Project 1');
  });

  // Test 2: getCategories
  it('should fetch categories successfully', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => [
        { id: 1, name: 'Environment' },
        { id: 2, name: 'Education' }
      ],
    });

    const categories = await getCategories();
    expect(categories).toHaveLength(2);
    expect(categories[0].name).toBe('Environment');
  });

  // Test 3: getReviews
  it('should fetch reviews successfully', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => [
        { id: 1, rating: 5, comment: 'Great!', userId: 1 }
      ],
    });

    const reviews = await getReviews();
    expect(reviews).toHaveLength(1);
    expect(reviews[0].rating).toBe(5);
  });

  // Test 4: API error handling
  it('should handle API errors correctly', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 500,
    });

    await expect(getProjects()).rejects.toThrow('Error al obtener proyectos');
  });
});

describe('Unit Tests - Notification Service', () => {
  beforeEach(() => {
    browserGlobals.Notification = { permission: 'default' };
    browserGlobals.navigator = { serviceWorker: {} };
    browserGlobals.PushManager = {};
  });

  // Test 5: isNotificationSupported
  it('should check if notifications are supported', () => {
    expect(isNotificationSupported()).toBe(true);

    delete browserGlobals.Notification;
    expect(isNotificationSupported()).toBe(false);
  });

  // Test 6: getNotificationPermission
  it('should get notification permission status', () => {
    browserGlobals.Notification = { permission: 'granted' };
    browserGlobals.navigator = { serviceWorker: {} };
    browserGlobals.PushManager = {};

    expect(getNotificationPermission()).toBe('granted');

    (browserGlobals.Notification as { permission: string }).permission = 'denied';
    expect(getNotificationPermission()).toBe('denied');

    (browserGlobals.Notification as { permission: string }).permission = 'default';
    expect(getNotificationPermission()).toBe('default');
  });
});
