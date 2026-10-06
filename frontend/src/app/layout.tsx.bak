import type { Metadata } from "next";

import "./globals.css";
import routePaint from "./RoutePaintGuard.module.css";

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
    <html
      lang="en"
      style={{
        backgroundColor:
          "#f3f4f1",
      }}
    >
      <body
        className={routePaint.body}
        style={{
          backgroundColor:
            "#f3f4f1",
        }}
      >
        {children}
      </body>
    </html>
  );
}
