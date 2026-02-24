import Link from "next/link";
import { Main } from "@/components/ui/main";

export default function LandingPage() {
  return (
    <Main
      eyebrow="COLONUS"
      title="Property Operations, Local First"
      description="Super admins onboard clients, landlords operate properties, and tenants submit proofs, tickets, and refund requests."
      maxWidthClassName="max-w-5xl"
    >
      <section className="mt-6 grid gap-4 md:grid-cols-2">
        <article id="landing-tier-free-card" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs uppercase tracking-wider text-slate-500">Free</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">$0/month</p>
          <ul className="mt-3 space-y-2 text-sm text-slate-700">
            <li>10 syncs per property per day</li>
            <li>All actions save locally and queue for sync</li>
            <li>Tenant proofs, tickets, and refund requests</li>
          </ul>
        </article>

        <article id="landing-tier-unlimited-card" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs uppercase tracking-wider text-slate-500">Unlimited</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">$10/month</p>
          <ul className="mt-3 space-y-2 text-sm text-slate-700">
            <li>Unlimited daily syncs per property</li>
            <li>Everything in Free</li>
            <li>Best for high-volume portfolios</li>
          </ul>
        </article>
      </section>

      <section className="mt-6 grid gap-4 md:grid-cols-3">
        <article id="landing-role-super-admin-card" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs uppercase tracking-wider text-slate-500">Super Admin</p>
          <ul className="mt-3 space-y-2 text-sm text-slate-700">
            <li>Add client wizard with draft resume</li>
            <li>Client list, health, and tier controls</li>
            <li>Client payment periods (1, 3, 6, 12 months)</li>
          </ul>
        </article>
        <article id="landing-role-landlord-card" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs uppercase tracking-wider text-slate-500">Landlord</p>
          <ul className="mt-3 space-y-2 text-sm text-slate-700">
            <li>Approve or reject tenant payment proofs</li>
            <li>Set proof requirements by property</li>
            <li>Track income, outcome, and property expenses</li>
          </ul>
        </article>
        <article id="landing-role-tenant-card" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs uppercase tracking-wider text-slate-500">Tenant</p>
          <ul className="mt-3 space-y-2 text-sm text-slate-700">
            <li>Upload rent and service payment proofs</li>
            <li>Submit condition proofs and refund requests</li>
            <li>Raise tickets and track statuses</li>
          </ul>
        </article>
      </section>

      <div className="mt-6 flex flex-wrap gap-2">
        <Link
          href="/"
          className="inline-flex rounded-full border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:border-slate-500"
        >
          Continue To App
        </Link>
        <Link
          href="/login"
          className="inline-flex rounded-full border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:border-slate-500"
        >
          Login
        </Link>
      </div>
    </Main>
  );
}
