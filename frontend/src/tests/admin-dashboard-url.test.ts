// The "Analytics" tab must open the EJS dashboard, not a blank SPA route
import { describe, it, expect } from 'vitest';
import { adminDashboardUrl } from '../pages/dashboard/shared';

describe('adminDashboardUrl', () => {
  it('opens the backend root when the API is on another origin (Vercel + Render)', () => {
    expect(adminDashboardUrl('https://awtc-backend.onrender.com', 'https://awtc-v2.vercel.app'))
      .toBe('https://awtc-backend.onrender.com/');
    expect(adminDashboardUrl('https://awtc-backend.onrender.com/', 'https://awtc-v2.vercel.app'))
      .toBe('https://awtc-backend.onrender.com/');
  });

  it('uses /admin/ when the API shares the origin (Nginx deploy)', () => {
    expect(adminDashboardUrl('https://app.example.com', 'https://app.example.com'))
      .toBe('https://app.example.com/admin/');
  });

  it('opens the local backend in development', () => {
    expect(adminDashboardUrl('http://localhost:8080', 'http://localhost:5173')).toBe('http://localhost:8080/');
  });
});
