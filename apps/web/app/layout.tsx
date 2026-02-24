import type { Metadata } from "next";
import { AppThemeShell } from "@/components/app-theme-shell";
import { FetchLoggerBootstrap } from "@/components/fetch-logger-bootstrap";
import { installFetchLogger } from "@/lib/fetch-logger";
import "./globals.css";

export const metadata: Metadata = {
  title: "COLONUS",
  description: "Tenant and landlord local-first dashboard"
};

installFetchLogger("server");

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <FetchLoggerBootstrap />
        <AppThemeShell>{children}</AppThemeShell>
      </body>
    </html>
  );
}
