import { PortalShell } from "@/components/portal-shell/portal-shell";
import { requireEmployeeAccess } from "@/lib/auth/session";
import { employeePortal } from "@/lib/navigation";

export default async function EmployeeLayout({ children }: LayoutProps<"/">) {
  const viewer = await requireEmployeeAccess();

  return (
    <PortalShell portal={employeePortal} userEmail={viewer.email}>
      {children}
    </PortalShell>
  );
}
