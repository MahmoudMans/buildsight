import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "BuildSight | Construction Intelligence",
  description:
    "Local-first construction project intelligence and delivery platform.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
