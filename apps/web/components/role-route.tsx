"use client";

import Link from "next/link";
import { Dashboard } from "@/components/dashboard";
import { LandlordFirstTimeOnboarding } from "@/components/landlord-first-time-onboarding";
import { MainMenu } from "@/components/main-menu";
import { Main } from "@/components/ui/main";
import { useColonusStore } from "@/lib/store";
import type { UserRole } from "@colonus/shared";

interface RoleRouteProps {
  role: UserRole;
  label: string;
  firstTime?: boolean;
}

export function RoleRoute({ role, label, firstTime = false }: RoleRouteProps) {
  const authSession = useColonusStore((state) => state.authSession);
  const impersonationRole = useColonusStore((state) => state.impersonationRole);
  const effectiveRole = authSession?.role ?? impersonationRole;

  if (!authSession) {
    return (
      <Main
        eyebrow={label}
        title={`${label} Login Required`}
        description="Sign in to continue."
        maxWidthClassName="max-w-2xl"
      >
        <section id="role-route-login-required-card" className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
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

  if (effectiveRole !== role) {
    return (
      <Main
        eyebrow={label}
        title={`${label} Route Locked`}
        description="Select who you want to pretend to be first, then open this route."
        maxWidthClassName="max-w-2xl"      >
        <MainMenu visible role={authSession.role} />
        <section id="role-route-locked-card" className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
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

  if (role === "landlord" && firstTime) {
    return <LandlordFirstTimeOnboarding />;
  }

  return <Dashboard role={role} />;
}
