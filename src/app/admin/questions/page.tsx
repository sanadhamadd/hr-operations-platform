import type { Metadata } from "next";

import { PageHeader } from "@/components/ui/page-header";
import { PlaceholderNotice } from "@/components/ui/placeholder-notice";

export const metadata: Metadata = { title: "Questions" };

export default function QuestionsPage() {
  return (
    <>
      <PageHeader
        title="Questions"
        description="Review the questions employees have asked and improve the answers they receive."
      />
      <PlaceholderNotice
        plannedCapabilities={[
          "Question history with audited access to conversations",
          "Correcting an answer and notifying the employee who asked",
          "Publishing corrections as reusable frequently asked questions",
        ]}
      />
    </>
  );
}
