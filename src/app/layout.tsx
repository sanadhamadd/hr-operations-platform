import type { Metadata } from "next";

import { site } from "@/lib/site";

import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: site.productName,
    template: `%s · ${site.productName}`,
  },
  description: "Early application foundation for an HR knowledge and operations platform.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
