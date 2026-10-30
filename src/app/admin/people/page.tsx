import type { Metadata } from "next";

import { PageHeader } from "@/components/ui/page-header";
import { PlaceholderNotice } from "@/components/ui/placeholder-notice";
import { requireHrAccess } from "@/lib/auth/session";

export const metadata: Metadata = { title: "People" };

export default async function PeoplePage() {
  await requireHrAccess();

  return (
    <>
      <PageHeader
        title="People"
        description="Manage who can use the platform and what they are permitted to do."
      />
      <PlaceholderNotice
        plannedCapabilities={[
          "Inviting employees by invitation only",
          "Assigning roles and permissions",
          "Deactivating accounts",
        ]}
      />
    </>
  );
}
