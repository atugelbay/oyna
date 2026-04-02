import { CrmBrandIcon, CrmBrandWordmark } from "@/components/crm/CrmBrand";
import { CrmHeader } from "@/components/crm/CrmHeader";
import { CrmPanelProviders } from "@/components/crm/CrmPanelProviders";
import { CrmSidebar } from "@/components/crm/CrmSidebar";

export default function CrmDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <CrmPanelProviders>
      <div className="crm-app-shell flex min-h-screen flex-col">
        {/* Колонка иконки = ширина сайдбара; OYNA + шапка = над окном контента */}
        <div className="flex h-16 shrink-0 items-stretch overflow-visible">
          <div className="flex w-24 shrink-0 items-center justify-center sm:w-28">
            <CrmBrandIcon />
          </div>
          <div className="flex min-h-0 min-w-0 flex-1 items-center gap-6 pr-4 overflow-visible">
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
    </CrmPanelProviders>
  );
}
