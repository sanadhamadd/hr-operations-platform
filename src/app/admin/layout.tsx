import { PortalShell } from "@/components/portal-shell/portal-shell";
import { adminPortal } from "@/lib/navigation";

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return <PortalShell portal={adminPortal}>{children}</PortalShell>;
}
