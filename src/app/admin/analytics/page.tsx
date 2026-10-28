import type { Metadata } from "next";

import { PageHeader } from "@/components/ui/page-header";
import { PlaceholderNotice } from "@/components/ui/placeholder-notice";

export const metadata: Metadata = { title: "Analytics" };

export default function AnalyticsPage() {
  return (
    <>
      <PageHeader
        title="Analytics"
        description="Understand how employees use HR services and where knowledge is missing."
      />
      <PlaceholderNotice
        plannedCapabilities={[
          "Question volume and how often answers resolve them",
          "Topics with no published answer",
          "Time taken to process form submissions",
        ]}
      />
    </>
  );
}
