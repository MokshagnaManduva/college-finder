import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { authApi } from '../api';
import { currentToken, storeToken, SESSION_EVENT, isSessionStorageEvent, DEMO_MODE } from '../api/client';
import type { User } from '../types';

interface AuthState {
  user: User | null; ready: boolean; error: string;
  establish(token: string, user: User): void;
  logout(): void;
}
const Context = createContext<AuthState | null>(null);

export function AuthProvider({ children }: {children: ReactNode}) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(DEMO_MODE || !currentToken());
  const [error, setError] = useState('');
  const cache = useQueryClient();
  const clearPrivateCache = () => {
    cache.removeQueries({ queryKey: ['workspace'] });
    cache.removeQueries({ queryKey: ['profile'] });
  };
  useEffect(() => {
    let active = true;
    const check = async () => {
      const token = currentToken();
      if (!token || DEMO_MODE) return;
      try {
        const result = await authApi.me();
        if (active && currentToken() === token) { setUser(result); setReady(true); setError(''); }
      } catch (err) {
        if (active && currentToken() === token) {
          setError(err instanceof Error ? err.message : 'Could not check your session.');
          setReady(true);
        }
      }
    };
    const changed = () => {
      setUser(null); setReady(!currentToken()); setError(''); clearPrivateCache();
      if (currentToken()) void check();
    };
    const storage = (event: StorageEvent) => {
      if (!isSessionStorageEvent(event)) return;
      storeToken(event.newValue); changed();
    };
    window.addEventListener(SESSION_EVENT, changed);
    window.addEventListener('storage', storage);
    void check();
    return () => { active = false; window.removeEventListener(SESSION_EVENT, changed); window.removeEventListener('storage', storage); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cache]);
  return <Context.Provider value={{ user, ready, error,
    establish: (token, nextUser) => {
      clearPrivateCache();
      const persisted = storeToken(token);
      setUser(nextUser); setReady(true);
      setError(persisted ? '' : 'Browser storage is unavailable. Sign-in lasts for this visit.');
    },
    logout: () => { storeToken(null); clearPrivateCache(); setUser(null); setReady(true); setError(''); },
  }}>{children}</Context.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const value = useContext(Context);
  if (!value) throw new Error('AuthProvider is required');
  return value;
}
