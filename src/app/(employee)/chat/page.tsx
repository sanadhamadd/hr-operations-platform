import type { Metadata } from "next";

import { PageHeader } from "@/components/ui/page-header";
import { PlaceholderNotice } from "@/components/ui/placeholder-notice";

export const metadata: Metadata = { title: "Chat" };

export default function ChatPage() {
  return (
    <>
      <PageHeader
        title="Chat"
        description="Ask questions about HR policies and receive answers grounded in published policy documents."
      />
      <PlaceholderNotice
        plannedCapabilities={[
          "Answers with citations to the relevant policy section",
          "Clarifying questions when an answer depends on your circumstances",
          "A clear response when no published policy covers the question",
          "Flagging an answer for review by the HR team",
          "History of your previous conversations",
        ]}
      />
    </>
  );
}
