"use client";

import type { ReactNode } from "react";
import { CrmSidebarLayoutProvider } from "@/lib/crm-sidebar-layout-context";
import { CrmVenueProvider } from "@/lib/venue-context";

export function CrmPanelProviders({ children }: { children: ReactNode }) {
  return (
    <CrmVenueProvider>
      <CrmSidebarLayoutProvider>{children}</CrmSidebarLayoutProvider>
    </CrmVenueProvider>
  );
}
