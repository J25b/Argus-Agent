import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { Organization, UserProfile } from '../types/argus';

interface AuthContextValue {
  token: string | null;
  user: UserProfile | null;
  organization: Organization | null;
  loading: boolean;
  setSession: (data: { token: string; user: UserProfile; organization: Organization }) => void;
  refreshSession: () => Promise<void>;
  logout: () => void;
  apiFetch: <T = unknown>(url: string, options?: RequestInit) => Promise<T>;
}

const AuthContext = createContext<AuthContextValue | null>(null);
const TOKEN_STORAGE_KEY = 'argus_session_token';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_STORAGE_KEY));
  const [user, setUser] = useState<UserProfile | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    setToken(null);
    setUser(null);
    setOrganization(null);
  }, []);

  const setSession = useCallback((data: { token: string; user: UserProfile; organization: Organization }) => {
    localStorage.setItem(TOKEN_STORAGE_KEY, data.token);
    setToken(data.token);
    setUser(data.user);
    setOrganization(data.organization);
  }, []);

  const refreshSession = useCallback(async () => {
    const stored = localStorage.getItem(TOKEN_STORAGE_KEY);
    if (!stored) {
      setLoading(false);
      return;
    }
    try {
      const resp = await fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${stored}` },
      });
      if (!resp.ok) {
        logout();
        return;
      }
      const data = (await resp.json()) as { token: string; user: UserProfile; organization: Organization };
      setSession(data);
    } catch {
      logout();
    } finally {
      setLoading(false);
    }
  }, [logout, setSession]);

  useEffect(() => {
    void refreshSession();
  }, [refreshSession]);

  const apiFetch = useCallback(
    async <T = unknown>(url: string, options: RequestInit = {}): Promise<T> => {
      const currentToken = localStorage.getItem(TOKEN_STORAGE_KEY);
      const headers = new Headers(options.headers);
      if (!headers.has('Content-Type') && options.body) {
        headers.set('Content-Type', 'application/json');
      }
      if (currentToken) {
        headers.set('Authorization', `Bearer ${currentToken}`);
      }

      const resp = await fetch(url, { ...options, headers });
      const text = await resp.text();
      let parsed: unknown = {};
      try {
        parsed = text ? JSON.parse(text) : {};
      } catch {
        parsed = { error: text };
      }

      if (resp.status === 401) {
        logout();
        throw new Error((parsed as { error?: string }).error || 'Session expired.');
      }

      if (!resp.ok) {
        throw new Error((parsed as { error?: string }).error || `Request failed (${resp.status})`);
      }

      return parsed as T;
    },
    [logout]
  );

  return (
    <AuthContext.Provider
      value={{
        token,
        user,
        organization,
        loading,
        setSession,
        refreshSession,
        logout,
        apiFetch,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return ctx;
}
