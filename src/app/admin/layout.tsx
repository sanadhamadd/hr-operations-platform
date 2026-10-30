import { PortalShell } from "@/components/portal-shell/portal-shell";
import { requireHrAccess } from "@/lib/auth/session";
import { adminPortal } from "@/lib/navigation";

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const viewer = await requireHrAccess();

  return (
    <PortalShell portal={adminPortal} userEmail={viewer.email}>
      {children}
    </PortalShell>
  );
}
