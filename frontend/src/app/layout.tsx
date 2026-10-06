import type { Metadata } from "next";

import { AttentionBell } from "@/components/AttentionBell";
import { ProjectViewsMenu } from "@/components/ProjectViewsMenu";
import { CommandPalette } from "@/components/CommandPalette";

import "./globals.css";
import "./enhancements.css";
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
        <ProjectViewsMenu />
        <AttentionBell />
        <CommandPalette />
      </body>
    </html>
  );
}
