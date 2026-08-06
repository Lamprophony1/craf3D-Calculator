import { useCallback, useEffect, useState } from 'react';
import { get, post } from '../api/client';
import type { AppUser, LoginOption } from '../api/types';

export function useAuthSession() {
  const [user, setUser] = useState<AppUser | null>(null);
  const [options, setOptions] = useState<LoginOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unverifiedOffline, setUnverifiedOffline] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [loginOptions, session] = await Promise.all([
        get<LoginOption[]>('/api/auth/login-options'),
        get<{ user: AppUser | null }>('/api/auth/me').catch(() => ({ user: null }))
      ]);
      setOptions(loginOptions);
      setUser(session.user);
      setError(null);
      setUnverifiedOffline(false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No se pudo cargar la sesión.');
      setUnverifiedOffline(!navigator.onLine);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const login = async (username: string, pin: string) => {
    setLoading(true);
    try {
      const response = await post<{ user: AppUser }>('/api/auth/login', { username, pin });
      setUser(response.user);
      setError(null);
      setUnverifiedOffline(false);
      return true;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No se pudo iniciar sesión.');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    await post<void>('/api/auth/logout');
    setUser(null);
  };

  return { user, options, loading, error, unverifiedOffline, login, logout, refresh };
}
