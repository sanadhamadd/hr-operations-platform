import type { Metadata } from "next";

import { PageHeader } from "@/components/ui/page-header";
import { PlaceholderNotice } from "@/components/ui/placeholder-notice";
import { requireEmployeeAccess } from "@/lib/auth/session";

export const metadata: Metadata = { title: "My Requests" };

export default async function RequestsPage() {
  await requireEmployeeAccess();

  return (
    <>
      <PageHeader
        title="My Requests"
        description="Track the forms you have submitted and the decisions made on them."
      />
      <PlaceholderNotice
        plannedCapabilities={[
          "Status of each submitted request",
          "Decisions and comments from the HR team",
          "Notifications when a request changes status",
        ]}
      />
    </>
  );
}
