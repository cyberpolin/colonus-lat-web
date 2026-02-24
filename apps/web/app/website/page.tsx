import Link from "next/link";
import { Main } from "@/components/ui/main";

export default function WebsitePage() {
  return (
    <Main
      eyebrow="COLONUS"
      title="Property Ops That Keep Working Offline"
      description="Manage landlords, properties, tenants, payment proofs, tickets, and refund workflows with local-first reliability and controlled cloud sync."
    >
      <section id="website-hero-card" className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mt-5 flex flex-wrap gap-2">
          <Link
            href="/available-units"
            className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:border-slate-500"
          >
            Browse Available Units
          </Link>
          <Link
            href="/website/upgrade"
            className="rounded-full border border-slate-900 bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            Upgrade To Premium
          </Link>
          <Link
            href="/login"
            className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:border-slate-500"
          >
            Login
          </Link>
        </div>
      </section>

      <section className="mt-6 grid gap-4 md:grid-cols-2">
        <article id="website-tier-free-card" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Free</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">$0/month</p>
          <ul className="mt-3 space-y-2 text-sm text-slate-700">
            <li>10 cloud syncs per property per day</li>
            <li>Landlord and tenant actions saved locally first</li>
            <li>Proofs, tickets, and refund requests included</li>
          </ul>
        </article>

        <article id="website-tier-premium-card" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Premium</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">$10/month</p>
          <ul className="mt-3 space-y-2 text-sm text-slate-700">
            <li>Unlimited cloud sync usage</li>
            <li>Everything in Free plan</li>
            <li>Best for active portfolios with frequent updates</li>
          </ul>
        </article>
      </section>

      <section className="mt-6 grid gap-4 md:grid-cols-3">
        <article id="website-role-super-admin-card" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">For Super Admin</p>
          <p className="mt-2 text-sm text-slate-700">Client onboarding, portfolio visibility, tiers, and metrics.</p>
        </article>
        <article id="website-role-landlord-card" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">For Landlords</p>
          <p className="mt-2 text-sm text-slate-700">Tenant operations, approvals, settings, and property controls.</p>
        </article>
        <article id="website-role-tenant-card" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">For Tenants</p>
          <p className="mt-2 text-sm text-slate-700">Payments, proofs, tickets, and request tracking in one place.</p>
        </article>
      </section>
    </Main>
  );
}
