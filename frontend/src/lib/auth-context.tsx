"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import api from "./api";

interface User {
  id: string;
  phone: string;
  nickname: string;
  name: string;
  role: string;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  crmLogin: (phone: string, password: string) => Promise<void>;
  crmEmployeeLogin: (phone: string, code: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadUser = useCallback(async () => {
    const token = localStorage.getItem("accessToken");
    if (!token) {
      setIsLoading(false);
      return;
    }
    try {
      const { data } = await api.get("/users/me");
      setUser(data);
    } catch {
      localStorage.removeItem("accessToken");
      localStorage.removeItem("refreshToken");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  const normalizePhone = (phone: string) => {
    const digits = phone.replace(/\D/g, "");
    const subscriber = digits.length >= 10 ? digits.slice(-10) : digits;
    return subscriber ? `+7${subscriber}` : phone;
  };

  const crmLogin = async (phone: string, password: string) => {
    const { data } = await api.post("/auth/crm-login", {
      phone: normalizePhone(phone),
      password,
    });
    localStorage.setItem("accessToken", data.accessToken);
    localStorage.setItem("refreshToken", data.refreshToken);
    setUser(data.user);
  };

  const crmEmployeeLogin = async (phone: string, code: string) => {
    const { data } = await api.post("/auth/crm-login", {
      phone: normalizePhone(phone),
      code,
      isEmployee: true,
    });
    localStorage.setItem("accessToken", data.accessToken);
    localStorage.setItem("refreshToken", data.refreshToken);
    setUser(data.user);
  };

  const logout = () => {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    setUser(null);
    window.location.href = "/login";
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        crmLogin,
        crmEmployeeLogin,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
