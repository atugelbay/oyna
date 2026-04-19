import { CrmPanelProviders } from "@/components/crm/CrmPanelProviders";
import { CrmShellLayout } from "@/components/crm/CrmShellLayout";

export default function CrmDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <CrmPanelProviders>
      <CrmShellLayout>{children}</CrmShellLayout>
    </CrmPanelProviders>
  );
}
