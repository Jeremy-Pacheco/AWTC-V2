import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import AuthProvider from '../context/AuthProvider';
import ProtectedRoute from '../components/ProtectedRoute';
import { useAuth } from '../context/auth-context';

function login(role: string) {
  localStorage.setItem('jwtToken', 'token');
  localStorage.setItem('userName', 'Ana');
  localStorage.setItem('userRole', role);
}

function renderAt(path: string, roles?: string[]) {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/" element={<p>home page</p>} />
          <Route path="/private" element={<ProtectedRoute roles={roles}><p>private page</p></ProtectedRoute>} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>
  );
}

describe('ProtectedRoute', () => {
  beforeEach(() => localStorage.clear());

  it('shows the page to a signed-in user with an allowed role', () => {
    login('coordinator');
    renderAt('/private', ['admin', 'coordinator']);
    expect(screen.getByText('private page')).toBeTruthy();
  });

  it('sends logged-out visitors home and opens the login modal', () => {
    const opened = vi.fn();
    window.addEventListener('openAuthModal', opened);
    renderAt('/private');
    expect(screen.getByText('home page')).toBeTruthy();
    expect(opened).toHaveBeenCalled();
    window.removeEventListener('openAuthModal', opened);
  });

  it('sends users with another role home', () => {
    login('volunteer');
    renderAt('/private', ['admin', 'coordinator']);
    expect(screen.getByText('home page')).toBeTruthy();
  });
});

describe('AuthProvider', () => {
  beforeEach(() => localStorage.clear());

  function Status() {
    const { isLoggedIn, user } = useAuth();
    return <p>{isLoggedIn ? `in as ${user?.name} (${user?.role})` : 'out'}</p>;
  }

  it('follows logins and logouts made anywhere in the app', () => {
    render(<AuthProvider><Status /></AuthProvider>);
    expect(screen.getByText('out')).toBeTruthy();

    act(() => {
      login('admin');
      window.dispatchEvent(new CustomEvent('authChanged', { detail: { loggedIn: true } }));
    });
    expect(screen.getByText('in as Ana (admin)')).toBeTruthy();

    act(() => {
      localStorage.clear();
      window.dispatchEvent(new CustomEvent('authChanged', { detail: { loggedIn: false } }));
    });
    expect(screen.getByText('out')).toBeTruthy();
  });

  it('throws a clear error when used outside the provider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Status />)).toThrow(/inside <AuthProvider>/);
    spy.mockRestore();
  });
});
