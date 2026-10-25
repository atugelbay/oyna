"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import { useRouter } from "next/navigation";
import api from "./api";

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
  login: (identifier: string, password: string) => Promise<void>;
  register: (
    phone: string,
    password: string,
    nickname: string,
    birthDate?: string,
  ) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const loadUser = useCallback(async () => {
    const token = localStorage.getItem("accessToken");
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      const { data } = await api.get("/profile/me");
      setUser(data);
    } catch {
      localStorage.removeItem("accessToken");
      localStorage.removeItem("refreshToken");
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUser();
    const expire = () => setUser(null);
    window.addEventListener("oyna:session-expired", expire);
    return () => window.removeEventListener("oyna:session-expired", expire);
  }, [loadUser]);

  const login = async (identifier: string, password: string) => {
    const { data } = await api.post("/auth/login", { identifier, password });
    localStorage.setItem("accessToken", data.accessToken);
    localStorage.setItem("refreshToken", data.refreshToken);
    setUser(data.user);
  };

  const register = async (
    phone: string,
    password: string,
    nickname: string,
    birthDate?: string,
  ) => {
    const { data } = await api.post("/auth/register", {
      phone,
      password,
      nickname,
      birthDate,
    });
    localStorage.setItem("accessToken", data.accessToken);
    localStorage.setItem("refreshToken", data.refreshToken);
    setUser(data.user);
  };

  const logout = () => {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    setUser(null);
    router.push("/welcome");
  };

  const refreshUser = async () => {
    await loadUser();
  };

  return (
    <AuthContext.Provider
      value={{ user, loading, login, register, logout, refreshUser }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
