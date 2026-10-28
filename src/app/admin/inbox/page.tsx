import type { Metadata } from "next";

import { PageHeader } from "@/components/ui/page-header";
import { PlaceholderNotice } from "@/components/ui/placeholder-notice";

export const metadata: Metadata = { title: "HR Inbox" };

export default function InboxPage() {
  return (
    <>
      <PageHeader
        title="HR Inbox"
        description="Work that needs attention from the HR team, gathered in one place."
      />
      <PlaceholderNotice
        plannedCapabilities={[
          "Answers flagged by employees for review",
          "Questions the assistant could not answer",
          "Form submissions awaiting approval",
        ]}
      />
    </>
  );
}
