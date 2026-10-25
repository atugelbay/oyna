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
import { venuesService } from "@/services/venues.service";

const STORAGE_KEY = "crm_selected_venue_id";

export type CrmVenue = { id: string; name: string; city?: string };

type CrmVenueContextValue = {
  venues: CrmVenue[];
  selectedVenueId: string | null;
  selectedVenue: CrmVenue | null;
  setSelectedVenueId: (id: string) => void;
  refreshVenues: (preferId?: string | null) => Promise<void>;
  loading: boolean;
};

const CrmVenueContext = createContext<CrmVenueContextValue | null>(null);

export function CrmVenueProvider({ children }: { children: ReactNode }) {
  const [venues, setVenues] = useState<CrmVenue[]>([]);
  const [selectedVenueId, setSelectedVenueIdState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const applyVenueList = useCallback((list: CrmVenue[], preferId?: string | null) => {
    setVenues(list);
    const stored =
      typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
    const preferred =
      preferId && list.some((v) => v.id === preferId) ? preferId : null;
    const validStored = stored && list.some((v) => v.id === stored) ? stored : null;
    const initial = preferred ?? validStored ?? list[0]?.id ?? null;
    setSelectedVenueIdState(initial);
    if (initial && typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, initial);
    } else if (typeof window !== "undefined" && !initial) {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  const refreshVenues = useCallback(
    async (preferId?: string | null) => {
      const data = await venuesService.list();
      const list = Array.isArray(data) ? (data as CrmVenue[]) : [];
      applyVenueList(list, preferId ?? selectedVenueId);
    },
    [applyVenueList, selectedVenueId],
  );

  useEffect(() => {
    let cancelled = false;
    venuesService
      .list()
      .then((data: CrmVenue[]) => {
        if (cancelled) return;
        applyVenueList(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (!cancelled) {
          setVenues([]);
          setSelectedVenueIdState(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [applyVenueList]);

  const setSelectedVenueId = useCallback((id: string) => {
    setSelectedVenueIdState(id);
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, id);
    }
  }, []);

  const selectedVenue = useMemo(
    () => venues.find((v) => v.id === selectedVenueId) ?? null,
    [venues, selectedVenueId],
  );

  const value = useMemo(
    () => ({
      venues,
      selectedVenueId,
      selectedVenue,
      setSelectedVenueId,
      refreshVenues,
      loading,
    }),
    [venues, selectedVenueId, selectedVenue, setSelectedVenueId, refreshVenues, loading],
  );

  return <CrmVenueContext.Provider value={value}>{children}</CrmVenueContext.Provider>;
}

export function useCrmVenue() {
  const ctx = useContext(CrmVenueContext);
  if (!ctx) {
    throw new Error("useCrmVenue must be used within CrmVenueProvider");
  }
  return ctx;
}
