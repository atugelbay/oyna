"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

const STORAGE_KEY = "crm_sidebar_collapsed";

type CrmSidebarLayoutContextValue = {
  collapsed: boolean;
  toggle: () => void;
  setCollapsed: (v: boolean) => void;
  /** Tailwind width классы для колонки сайдбара и ячейки переключателя в шапке */
  railWidthClass: string;
};

const CrmSidebarLayoutContext = createContext<CrmSidebarLayoutContextValue | null>(null);

export function CrmSidebarLayoutProvider({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsedState] = useState(false);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw === "1") setCollapsedState(true);
    } catch {
      /* ignore */
    }
  }, []);

  const setCollapsed = useCallback((v: boolean) => {
    setCollapsedState(v);
    try {
      sessionStorage.setItem(STORAGE_KEY, v ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, []);

  const toggle = useCallback(() => {
    setCollapsedState((prev) => {
      const next = !prev;
      try {
        sessionStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const railWidthClass = collapsed ? "w-16" : "w-24 sm:w-28";

  const value = useMemo(
    () => ({
      collapsed,
      toggle,
      setCollapsed,
      railWidthClass,
    }),
    [collapsed, toggle, setCollapsed, railWidthClass],
  );

  return <CrmSidebarLayoutContext.Provider value={value}>{children}</CrmSidebarLayoutContext.Provider>;
}

export function useCrmSidebarLayout() {
  const ctx = useContext(CrmSidebarLayoutContext);
  if (!ctx) {
    throw new Error("useCrmSidebarLayout must be used within CrmSidebarLayoutProvider");
  }
  return ctx;
}
