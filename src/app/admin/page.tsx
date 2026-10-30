import { redirect } from "next/navigation";

import { requireHrAccess } from "@/lib/auth/session";
import { adminPortal } from "@/lib/navigation";

export default async function AdminIndexPage() {
  await requireHrAccess();
  redirect(adminPortal.homeHref);
}
