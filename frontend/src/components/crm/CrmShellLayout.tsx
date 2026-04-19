"use client";

import type { ReactNode } from "react";
import { PanelLeft } from "lucide-react";
import { CrmBrandWordmark } from "@/components/crm/CrmBrand";
import { CrmHeader } from "@/components/crm/CrmHeader";
import { CrmSidebar } from "@/components/crm/CrmSidebar";
import { useCrmSidebarLayout } from "@/lib/crm-sidebar-layout-context";

export function CrmShellLayout({ children }: { children: ReactNode }) {
  const { collapsed, toggle, railWidthClass } = useCrmSidebarLayout();

  return (
    <div className="crm-app-shell flex min-h-screen flex-col">
      <div className="flex h-16 shrink-0 items-stretch overflow-visible">
        <div
          className={`flex shrink-0 items-center justify-center transition-[width] duration-200 ease-out ${railWidthClass}`}
        >
          <button
            type="button"
            onClick={toggle}
            aria-expanded={!collapsed}
            aria-controls="crm-sidebar-nav"
            aria-label={collapsed ? "Развернуть боковое меню" : "Свернуть боковое меню"}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-text-secondary transition-colors hover:bg-white/5 hover:text-white"
          >
            <PanelLeft className="h-5 w-5" strokeWidth={1.75} />
          </button>
        </div>
        <div className="flex min-h-0 min-w-0 flex-1 items-center gap-6 overflow-visible pr-4">
          <CrmBrandWordmark />
          <CrmHeader />
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        <CrmSidebar />
        <main className="crm-main-panel min-h-0 min-w-0 flex-1 overflow-hidden">
          <div className="h-full overflow-auto p-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
