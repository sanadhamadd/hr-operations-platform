import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "HR Operations Platform",
  description: "Early application foundation for an HR knowledge and operations platform.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
