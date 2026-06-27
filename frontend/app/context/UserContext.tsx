'use client';

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { login as loginApi, register as registerApi, getAuthHeaders } from '@/app/lib/api';

interface User {
  id: string;
  name: string;
  email: string;
}

interface UserContextValue {
  user: User | null;
  token: string | null;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<boolean>;
  register: (name: string, email: string, password: string) => Promise<boolean>;
  logout: () => void;
  getToken: () => string | null;
}

const UserContext = createContext<UserContextValue | undefined>(undefined);

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Hydrate from localStorage on mount (client-side only)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const storedUser = window.localStorage.getItem('trading-user');
    const storedToken = window.localStorage.getItem('trading-token');
    
    if (storedUser && storedToken) {
      try {
        setUser(JSON.parse(storedUser));
        setToken(storedToken);
      } catch {
        // Clear corrupted data
        window.localStorage.removeItem('trading-user');
        window.localStorage.removeItem('trading-token');
      }
    }
  }, []);

  const login = async (email: string, password: string) => {
    setLoading(true);
    setError(null);

    try {
      const result = await loginApi(email, password);
      setUser(result.user);
      setToken(result.token);
      
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('trading-user', JSON.stringify(result.user));
        window.localStorage.setItem('trading-token', result.token);
      }
      
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unable to sign in';
      setError(errorMessage);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const register = async (name: string, email: string, password: string) => {
    setLoading(true);
    setError(null);

    try {
      const result = await registerApi(name, email, password);
      const newUser = result.user;
      setUser({
        id: newUser.id,
        name,
        email: newUser.email,
      });
      
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('trading-user', JSON.stringify({
          id: newUser.id,
          name,
          email: newUser.email,
        }));
      }
      
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unable to create account';
      setError(errorMessage);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    setError(null);
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem('trading-user');
      window.localStorage.removeItem('trading-token');
    }
  };

  const getToken = () => token;

  const value = useMemo(
    () => ({ user, token, loading, error, login, register, logout, getToken }),
    [user, token, loading, error]
  );

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

export function useUser() {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error('useUser must be used inside the UserProvider');
  }
  return context;
}
