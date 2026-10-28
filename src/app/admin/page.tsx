import { redirect } from "next/navigation";

import { adminPortal } from "@/lib/navigation";

export default function AdminIndexPage() {
  redirect(adminPortal.homeHref);
}
