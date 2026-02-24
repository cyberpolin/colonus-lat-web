"use client";

import Link from "next/link";
import { Main } from "@/components/ui/main";
import { useColonusStore } from "@/lib/store";

export function SuperAdminRouteGuard({
  children,
  title,
  allowLandlord = false
}: {
  children: React.ReactNode;
  title: string;
  allowLandlord?: boolean;
}) {
  const authSession = useColonusStore((state) => state.authSession);
  const impersonationRole = useColonusStore((state) => state.impersonationRole);
  const effectiveRole = authSession?.role ?? impersonationRole;
  const allowed = effectiveRole === "super_admin" || (allowLandlord && effectiveRole === "landlord");

  if (!authSession) {
    return (
      <Main
        eyebrow="Super Admin"
        title={`${title} Login Required`}
        description="Sign in to continue."
        maxWidthClassName="max-w-2xl"
      >
        <section id="super-admin-guard-login-required-card" className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <Link
            href="/login"
            className="mt-4 inline-flex rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:border-slate-500"
          >
            Go To Login
          </Link>
        </section>
      </Main>
    );
  }

  if (!allowed) {
    return (
      <Main
        eyebrow="Super Admin"
        title={`${title} Locked`}
        description="Select the correct pretend role before opening this route."
        maxWidthClassName="max-w-2xl"
      >
        <section id="super-admin-guard-locked-card" className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <Link
            href="/"
            className="mt-4 inline-flex rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:border-slate-500"
          >
            Go To Role Selector
          </Link>
        </section>
      </Main>
    );
  }

  return <>{children}</>;
}
