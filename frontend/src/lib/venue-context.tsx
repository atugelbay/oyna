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
  loading: boolean;
};

const CrmVenueContext = createContext<CrmVenueContextValue | null>(null);

export function CrmVenueProvider({ children }: { children: ReactNode }) {
  const [venues, setVenues] = useState<CrmVenue[]>([]);
  const [selectedVenueId, setSelectedVenueIdState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    venuesService
      .list()
      .then((data: CrmVenue[]) => {
        if (cancelled) return;
        const list = Array.isArray(data) ? data : [];
        setVenues(list);
        const stored =
          typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
        const validStored = stored && list.some((v) => v.id === stored) ? stored : null;
        const initial = validStored ?? list[0]?.id ?? null;
        setSelectedVenueIdState(initial);
        if (initial && typeof window !== "undefined") {
          localStorage.setItem(STORAGE_KEY, initial);
        }
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
  }, []);

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
      loading,
    }),
    [venues, selectedVenueId, selectedVenue, setSelectedVenueId, loading],
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
