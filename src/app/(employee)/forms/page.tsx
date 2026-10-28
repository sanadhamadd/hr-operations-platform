import type { Metadata } from "next";

import { PageHeader } from "@/components/ui/page-header";
import { PlaceholderNotice } from "@/components/ui/placeholder-notice";

export const metadata: Metadata = { title: "Forms" };

export default function FormsPage() {
  return (
    <>
      <PageHeader
        title="Forms"
        description="Find the HR forms available to you and submit them online."
      />
      <PlaceholderNotice
        plannedCapabilities={[
          "A catalog of the forms you are permitted to use",
          "Saving a draft and returning to it later",
          "Submission with a confirmation receipt",
        ]}
      />
    </>
  );
}
