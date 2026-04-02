'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import api from './api';

interface UserProfile {
  id: string;
  phone: string;
  nickname: string;
  name: string;
  role: string;
  loyaltyStatus: string;
  totalScore: number;
  balanceSeconds: number;
}

interface AuthContextValue {
  user: UserProfile | null;
  loading: boolean;
  requestOtp: (phone: string) => Promise<void>;
  verifyOtp: (phone: string, code: string) => Promise<{ needsProfile: boolean; phone?: string }>;
  register: (phone: string, code: string, nickname: string, birthDate?: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const loadUser = useCallback(async () => {
    const token = localStorage.getItem('accessToken');
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      const { data } = await api.get('/profile/me');
      setUser(data);
    } catch {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  const requestOtp = async (phone: string) => {
    await api.post('/auth/request-otp', { phone });
  };

  // Returns { needsProfile: true } for new users, or sets user + redirects for existing ones
  const verifyOtp = async (phone: string, code: string) => {
    const { data } = await api.post('/auth/login', { phone, code });

    if (data.needsProfile) {
      return { needsProfile: true, phone: data.phone };
    }

    localStorage.setItem('accessToken', data.accessToken);
    localStorage.setItem('refreshToken', data.refreshToken);
    setUser(data.user);
    return { needsProfile: false };
  };

  const register = async (phone: string, code: string, nickname: string, birthDate?: string) => {
    const { data } = await api.post('/auth/register', { phone, code, nickname, birthDate });
    localStorage.setItem('accessToken', data.accessToken);
    localStorage.setItem('refreshToken', data.refreshToken);
    setUser(data.user);
  };

  const logout = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    setUser(null);
    router.push('/welcome');
  };

  const refreshUser = async () => {
    await loadUser();
  };

  return (
    <AuthContext.Provider value={{ user, loading, requestOtp, verifyOtp, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
