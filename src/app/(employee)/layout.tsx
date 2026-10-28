import { PortalShell } from "@/components/portal-shell/portal-shell";
import { employeePortal } from "@/lib/navigation";

export default function EmployeeLayout({ children }: LayoutProps<"/">) {
  return <PortalShell portal={employeePortal}>{children}</PortalShell>;
}
