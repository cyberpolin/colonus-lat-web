"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { MainMenu } from "@/components/main-menu";
import { SuperAdminRouteGuard } from "@/components/super-admin-route-guard";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Main } from "@/components/ui/main";
import { Select } from "@/components/ui/select";
import { centsToCurrency } from "@/lib/format";
import { useColonusStore } from "@/lib/store";
import { hasClientDraftInStorage } from "@/lib/use-client";

const monthInputDefault = (): string => new Date().toISOString().slice(0, 7);

const buildPeriod = (monthValue: string, durationMonths: number) => {
  const [yearPart, monthPart] = monthValue.split("-");
  const year = Number(yearPart);
  const monthIndex = Number(monthPart) - 1;
  const start = new Date(year, monthIndex, 1);
  const end = new Date(year, monthIndex + durationMonths, 0, 23, 59, 59, 999);
  const label = `${durationMonths} Month${durationMonths > 1 ? "s" : ""} (${start.toLocaleDateString("en-US")} - ${end.toLocaleDateString("en-US")})`;

  return {
    label,
    startDate: start.toISOString(),
    endDate: end.toISOString()
  };
};

export function SuperAdminClientDetailsPage({ landlordId }: { landlordId: string }) {
  const state = useColonusStore();
  const [anchorMonth, setAnchorMonth] = useState(monthInputDefault());
  const [durationMonths, setDurationMonths] = useState(1);
  const [hasClientDraft, setHasClientDraft] = useState(false);

  const landlord = state.landlords.find((item) => item.id === landlordId);

  const data = useMemo(() => {
    if (!landlord) return undefined;
    const properties = state.properties.filter((item) => item.landlordId === landlord.id);
    const propertyIds = properties.map((item) => item.id);
    const tenants = state.tenants.filter((item) => item.landlordId === landlord.id);
    const payments = state.paymentSubmissions
      .filter((item) => propertyIds.includes(item.propertyId))
      .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
    const periods = state.paymentPeriods
      .filter((item) => item.landlordId === landlord.id)
      .sort((a, b) => b.startDate.localeCompare(a.startDate));

    const approved = payments.filter((item) => item.status === "approved");
    const pending = payments.filter((item) => item.status === "pending");
    const rejected = payments.filter((item) => item.status === "rejected");

    const totalApproved = approved.reduce((acc, item) => acc + item.amountCents, 0);
    const totalPending = pending.reduce((acc, item) => acc + item.amountCents, 0);
    const totalRejected = rejected.reduce((acc, item) => acc + item.amountCents, 0);

    return {
      properties,
      tenants,
      payments,
      periods,
      approvedCount: approved.length,
      pendingCount: pending.length,
      rejectedCount: rejected.length,
      totalApproved,
      totalPending,
      totalRejected
    };
  }, [landlord, state.properties, state.tenants, state.paymentSubmissions, state.paymentPeriods]);

  useEffect(() => {
    setHasClientDraft(hasClientDraftInStorage());
  }, []);

  return (
    <SuperAdminRouteGuard title="Client Info">
      <Main
        eyebrow="Super Admin"
        title="Client Info"
        description="Client profile, properties, tenants, payments, and payment periods."      >
        <MainMenu visible role="super_admin" />

        <div className="mt-4 flex flex-wrap gap-2">
          <Link href="/superadmin/clients" className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:border-slate-500">
            Back To Clients
          </Link>
          <Link href="/superadmin/add-client" className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:border-slate-500">
            Add Another Client
            {hasClientDraft && (
              <span className="ml-2 inline-flex h-4 w-4 items-center justify-center rounded-full border border-slate-500 text-[10px] leading-none">
                !
              </span>
            )}
          </Link>
        </div>

        {!landlord && (
          <section id="superadmin-client-details-summary-card" className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <EmptyState
              title="Client Not Found"
              message="The requested landlord does not exist or is no longer available."
            />
          </section>
        )}

        {landlord && data && (
          <div className="mt-4 grid gap-4 lg:grid-cols-[1.1fr_1fr]">
            <section id="superadmin-client-details-periods-card" className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">{landlord.fullName}</h2>
                <p className="text-sm text-slate-600">{landlord.email}</p>
                <p className="text-xs text-slate-600">Status: {landlord.status}</p>
              </div>

              <div className="grid gap-2 md:grid-cols-2">
                <div className="rounded border border-slate-200 bg-slate-50 p-2 text-xs text-slate-700">Properties: {data.properties.length}</div>
                <div className="rounded border border-slate-200 bg-slate-50 p-2 text-xs text-slate-700">Tenants: {data.tenants.length}</div>
                <div className="rounded border border-slate-200 bg-slate-50 p-2 text-xs text-slate-700">Payments approved: {data.approvedCount}</div>
                <div className="rounded border border-slate-200 bg-slate-50 p-2 text-xs text-slate-700">Payments pending: {data.pendingCount}</div>
                <div className="rounded border border-slate-200 bg-slate-50 p-2 text-xs text-slate-700">Payments rejected: {data.rejectedCount}</div>
                <div className="rounded border border-slate-200 bg-slate-50 p-2 text-xs text-slate-700">Approved value: {centsToCurrency(data.totalApproved)}</div>
                <div className="rounded border border-slate-200 bg-slate-50 p-2 text-xs text-slate-700">Pending value: {centsToCurrency(data.totalPending)}</div>
                <div className="rounded border border-slate-200 bg-slate-50 p-2 text-xs text-slate-700">Rejected value: {centsToCurrency(data.totalRejected)}</div>
              </div>

              <div>
                <p className="text-xs uppercase tracking-wider text-slate-500">Properties</p>
                <div className="mt-2 space-y-2 text-sm">
                  {data.properties.length === 0 && (
                    <EmptyState
                      title="No Properties Yet"
                      message="This client does not have properties assigned yet."
                    />
                  )}
                  {data.properties.map((property) => (
                    <div key={property.id} className="rounded border border-slate-200 p-2">
                      <p className="font-medium text-slate-900">{property.name}</p>
                      <p className="text-slate-600">{property.address}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-xs uppercase tracking-wider text-slate-500">Tenants</p>
                <div className="mt-2 space-y-2 text-sm">
                  {data.tenants.length === 0 && (
                    <EmptyState
                      title="No Tenants Yet"
                      message="Add tenants to start tracking payments and tickets for this client."
                    />
                  )}
                  {data.tenants.slice(0, 12).map((tenant) => (
                    <div key={tenant.id} className="rounded border border-slate-200 p-2">
                      <p className="font-medium text-slate-900">{tenant.fullName}</p>
                      <p className="text-slate-600">{tenant.email}</p>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <section id="superadmin-client-details-payments-card" className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div>
                <p className="text-xs uppercase tracking-wider text-slate-500">Payment Periods</p>
                <form
                  className="mt-2 grid gap-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    const { label, startDate, endDate } = buildPeriod(anchorMonth, durationMonths);
                    state.createPaymentPeriod({
                      landlordId: landlord.id,
                      label,
                      durationMonths,
                      startDate,
                      endDate
                    });
                  }}
                >
                  <Input
                    type="month"
                    value={anchorMonth}
                    onChange={(event) => setAnchorMonth(event.target.value)}
                    className="rounded border border-slate-300 p-2"
                  />
                  <Select
                    value={durationMonths}
                    onChange={(event) => setDurationMonths(Number(event.target.value))}
                    className="rounded border border-slate-300 p-2"
                  >
                    <option value={1}>1 Month</option>
                    <option value={3}>3 Months</option>
                    <option value={6}>6 Months</option>
                    <option value={12}>12 Months</option>
                  </Select>
                  <button className="rounded bg-slate-900 px-3 py-2 text-sm text-white">Create Payment Period</button>
                </form>
              </div>

              <div className="space-y-2 text-sm">
                {data.periods.length === 0 && (
                  <EmptyState
                    title="No Payment Periods"
                    message="Create a payment period to define billing windows for this client."
                  />
                )}
                {data.periods.map((period) => (
                  <div key={period.id} className="rounded border border-slate-200 p-2">
                    <p className="font-medium text-slate-900">{period.label}</p>
                    <p className="text-xs text-slate-600">
                      {new Date(period.startDate).toLocaleDateString("en-US")} to {new Date(period.endDate).toLocaleDateString("en-US")}
                    </p>
                  </div>
                ))}
              </div>

              <div>
                <p className="text-xs uppercase tracking-wider text-slate-500">Recent Payments</p>
                <div className="mt-2 space-y-2 text-sm">
                  {data.payments.length === 0 && (
                    <EmptyState
                      title="No Payments Yet"
                      message="Payments will appear here once tenants submit receipts."
                    />
                  )}
                  {data.payments.slice(0, 12).map((payment) => (
                    <div key={payment.id} className="rounded border border-slate-200 p-2">
                      <p className="font-medium text-slate-900">{payment.kind} · {centsToCurrency(payment.amountCents)}</p>
                      <p className="text-xs text-slate-600">Status: {payment.status}</p>
                      <p className="text-xs text-slate-600">Date: {new Date(payment.submittedAt).toLocaleDateString("en-US")}</p>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </div>
        )}
      </Main>
    </SuperAdminRouteGuard>
  );
}
