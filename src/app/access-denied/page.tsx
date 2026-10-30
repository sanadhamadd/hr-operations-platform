import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AuthPage } from "@/components/auth/auth-page";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { decideAccess, loginPath } from "@/lib/auth/access";
import { getViewer } from "@/lib/auth/session";
import { employeePortal } from "@/lib/navigation";

export const metadata: Metadata = { title: "Access denied" };

export default async function AccessDeniedPage() {
  const viewer = await getViewer();
  if (!viewer) redirect(loginPath);

  // The reason is worked out from the current membership rather than taken from the URL.
  const decision = decideAccess(viewer, "employee");
  const message =
    decision === "disabled"
      ? "Your account has been disabled. Contact the HR team if you need access."
      : decision === "no-membership"
        ? "Your account has not been given access to the platform. Contact the HR team if you need access."
        : "Your account does not have access to that page.";

  return (
    <AuthPage title="Access denied" intro={message}>
      {decision === "allow" ? (
        <Link href={employeePortal.homeHref}>Go to the {employeePortal.label.toLowerCase()}</Link>
      ) : null}
      <SignOutButton />
    </AuthPage>
  );
}
