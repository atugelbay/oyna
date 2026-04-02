"use client";

import type { ReactNode } from "react";
import { CrmVenueProvider } from "@/lib/venue-context";

export function CrmPanelProviders({ children }: { children: ReactNode }) {
  return <CrmVenueProvider>{children}</CrmVenueProvider>;
}
