"use client";

import Link from "next/link";
import { Main } from "@/components/ui/main";
import { useColonusStore } from "@/lib/store";
import type { UserRole } from "@colonus/shared";

const roles: Array<{ role: UserRole; path: string; label: string; description: string }> = [
  {
    role: "super_admin",
    path: "/superadmin",
    label: "Super Admin",
    description: "Manage landlords, tenants, and properties"
  },
  {
    role: "landlord",
    path: "/landlord",
    label: "Landlord",
    description: "Approve payments and track income/outcome"
  },
  {
    role: "tenant",
    path: "/tenant",
    label: "Tenant",
    description: "Submit payments, proofs, fix and permission requests"
  }
];

export function RoleSelector() {
  const selectImpersonationRole = useColonusStore((state) => state.selectImpersonationRole);

  return (
    <Main
      eyebrow="COLONUS"
      title="Choose Who To Pretend To Be"
      description="Pick a role first, then continue to the matching dashboard route."
      maxWidthClassName="max-w-4xl"
      headerClassName="mb-8"
    >

      <div className="grid gap-4 md:grid-cols-3">
        {roles.map((item) => (
          <Link
            key={item.role}
            href={item.path}
            onClick={() => selectImpersonationRole(item.role)}
            id={`role-selector-card-${item.role}`}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-slate-400"
          >
            <p className="text-xs uppercase tracking-wider text-slate-500">Role</p>
            <h2 className="mt-2 text-xl font-semibold text-slate-900">{item.label}</h2>
            <p className="mt-2 text-sm text-slate-600">{item.description}</p>
          </Link>
        ))}
      </div>

      <div className="mt-6">
        <Link
          href="/landingPage"
          className="mr-2 inline-flex rounded-full border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:border-slate-500"
        >
          View Plans
        </Link>
        <Link
          href="/ui-system"
          className="inline-flex rounded-full border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:border-slate-500"
        >
          Open UI System
        </Link>
        <Link
          href="/login"
          className="ml-2 inline-flex rounded-full border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:border-slate-500"
        >
          Login
        </Link>
      </div>
    </Main>
  );
}
