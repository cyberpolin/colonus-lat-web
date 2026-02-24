import type { Metadata } from "next";
import { AppThemeShell } from "@/components/app-theme-shell";
import "./globals.css";

export const metadata: Metadata = {
  title: "COLONUS",
  description: "Tenant and landlord local-first dashboard"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AppThemeShell>{children}</AppThemeShell>
      </body>
    </html>
  );
}
