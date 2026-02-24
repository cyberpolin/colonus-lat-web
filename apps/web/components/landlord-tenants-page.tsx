"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { MainMenu } from "@/components/main-menu";
import { EmptyState } from "@/components/ui/empty-state";
import { GradeBadge } from "@/components/ui/grade-badge";
import { GradeCard } from "@/components/ui/grade-card";
import { GradeEditModal } from "@/components/ui/grade-edit-modal";
import { Input } from "@/components/ui/input";
import { Main } from "@/components/ui/main";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { centsToCurrency } from "@/lib/format";
import { useColonusStore } from "@/lib/store";
import { useTenantGradesStore } from "@/lib/tenant-grades-store";

export function LandlordTenantsPage() {
  const state = useColonusStore();
  const authSession = useColonusStore((store) => store.authSession);
  const impersonationRole = useColonusStore((store) => store.impersonationRole);
  const tenantGrades = useTenantGradesStore((store) => store.tenantGrades);
  const upsertGrade = useTenantGradesStore((store) => store.upsertGrade);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "good" | "attention">("all");
  const [selectedTenantId, setSelectedTenantId] = useState<string>();
  const [isEditingTenantSettings, setIsEditingTenantSettings] = useState(false);
  const [tenantSettingsDraft, setTenantSettingsDraft] = useState({
    propertyId: "",
    rentCycleMonths: 1 as 1 | 3 | 6 | 12,
    rentAmount: ""
  });
  const [isGradeModalOpen, setIsGradeModalOpen] = useState(false);
  const isLocked = impersonationRole !== "landlord";
  const canEditGrade = (authSession?.role ?? impersonationRole) === "landlord";

  const activeLandlordId = state.activeLandlordId ?? state.landlords[0]?.id;
  const landlordProperties = state.properties.filter((property) => property.landlordId === activeLandlordId);

  const rows = useMemo(() => {
    const scopedTenants = state.tenants.filter((tenant) => tenant.landlordId === activeLandlordId);
    return scopedTenants.map((tenant) => {
      const property = state.properties.find((item) => item.id === tenant.propertyId);
      const payments = state.paymentSubmissions.filter((item) => item.tenantId === tenant.id);
      const refunds = state.refundRequests.filter((item) => item.tenantId === tenant.id);
      const tickets = state.tickets.filter((item) => item.createdByTenantId === tenant.id);
      const conditionProofs = state.careProofSubmissions.filter((item) => item.tenantId === tenant.id);

      const pendingPayments = payments.filter((item) => item.status === "pending").length;
      const rejectedPayments = payments.filter((item) => item.status === "rejected").length;
      const openTickets = tickets.filter((item) => item.status === "open" || item.status === "in_progress").length;
      const inReviewRefunds = refunds.filter(
        (item) => item.status === "submitted" || item.status === "in_review"
      ).length;

      const attentionScore = pendingPayments + rejectedPayments + openTickets + inReviewRefunds;
      const health = attentionScore > 2 ? "attention" : "good";

      return {
        tenant,
        property,
        grade: tenantGrades.find(
          (grade) => grade.propertyId === tenant.propertyId && grade.tenantId === tenant.id
        ),
        payments,
        refunds,
        tickets,
        conditionProofs,
        pendingPayments,
        rejectedPayments,
        openTickets,
        inReviewRefunds,
        attentionScore,
        health
      };
    });
  }, [
    activeLandlordId,
    state.tenants,
    state.properties,
    state.paymentSubmissions,
    state.refundRequests,
    state.tickets,
    state.careProofSubmissions,
    tenantGrades
  ]);

  const filtered = useMemo(() => {
    return rows.filter((row) => {
      const query = search.trim().toLowerCase();
      const matchesQuery =
        !query ||
        row.tenant.fullName.toLowerCase().includes(query) ||
        row.tenant.email.toLowerCase().includes(query) ||
        (row.tenant.phone ?? "").toLowerCase().includes(query);
      const matchesStatus = statusFilter === "all" || row.health === statusFilter;
      return matchesQuery && matchesStatus;
    });
  }, [rows, search, statusFilter]);

  const selected = filtered.find((row) => row.tenant.id === selectedTenantId) ?? filtered[0];

  useEffect(() => {
    if (!selected || isEditingTenantSettings) return;
    setTenantSettingsDraft({
      propertyId: selected.tenant.propertyId,
      rentCycleMonths: selected.tenant.rentCycleMonths,
      rentAmount: (selected.tenant.rentAmountCents / 100).toFixed(2)
    });
  }, [
    selected?.tenant.id,
    selected?.tenant.propertyId,
    selected?.tenant.rentCycleMonths,
    selected?.tenant.rentAmountCents,
    isEditingTenantSettings
  ]);

  if (isLocked) {
    return (
      <Main
        eyebrow="Landlord"
        title="Tenant Portfolio"
        description="Select landlord from role selector before opening this route."
        maxWidthClassName="max-w-2xl"      >
        <MainMenu visible role="landlord" />
        <section id="landlord-tenants-route-locked-card" className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-semibold text-slate-900">Landlord Tenants Locked</h1>
          <p className="mt-2 text-slate-600">Select landlord from the pretend-user selector before opening this route.</p>
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

  return (
    <Main
      eyebrow="Landlord"
      title="Tenant Portfolio"
      description="Tenant list and per-tenant operational status for your properties only."    >
      <MainMenu visible role="landlord" />
      <nav id="landlord-tenants-breadcrumb" aria-label="Breadcrumb" className="text-xs text-slate-500">
        <p className="flex flex-wrap items-center gap-2">
          <Link href="/" className="hover:text-slate-700">
            Home
          </Link>
          <span>/</span>
          <Link href="/landlord" className="hover:text-slate-700">
            Landlord
          </Link>
          <span>/</span>
          <span className="text-slate-700">Tenants</span>
        </p>
      </nav>

      <section id="landlord-tenants-filters-card" className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-2 md:grid-cols-3">
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search tenant by name, email, phone"
            className="rounded border border-slate-300 p-2"
          />
          <Select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as "all" | "good" | "attention")}
            className="rounded border border-slate-300 p-2"
          >
            <option value="all">All status</option>
            <option value="good">Good</option>
            <option value="attention">Needs attention</option>
          </Select>
          <p className="rounded border border-slate-200 bg-slate-50 p-2 text-sm text-slate-700">Results: {filtered.length}</p>
        </div>
      </section>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <section id="landlord-tenants-list-card" className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="space-y-2">
            {filtered.map((row) => (
              <button
                key={row.tenant.id}
                type="button"
                onClick={() => setSelectedTenantId(row.tenant.id)}
                className={`w-full rounded border p-3 text-left text-sm ${
                  selected?.tenant.id === row.tenant.id
                    ? "border-slate-700 bg-slate-50"
                    : "border-slate-200 hover:border-slate-400"
                }`}
              >
                <p className="font-medium text-slate-900">{row.tenant.fullName}</p>
                <p className="text-slate-600">{row.tenant.email}</p>
                <div className="mt-1">
                  <GradeBadge score={row.grade?.score} />
                </div>
                <p className="text-xs text-slate-600">Property: {row.property?.name ?? "-"}</p>
                <p className="text-xs text-slate-600">
                  Pending payments: {row.pendingPayments} · Open tickets: {row.openTickets} · Refunds in review: {row.inReviewRefunds}
                </p>
              </button>
            ))}
            {filtered.length === 0 && (
              <EmptyState
                title="No Matching Tenants"
                message="No tenant matches these filters. Try adjusting your search or status."
              />
            )}
          </div>
        </section>

        <section id="landlord-tenants-detail-card" className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          {!selected && (
            <div className="space-y-3">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-4 w-56" />
              <Skeleton className="h-20 w-full" />
              <EmptyState
                title="No Tenant Selected"
                message="Choose a tenant from the list to review documents and statuses."
              />
            </div>
          )}
          {selected && (
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">{selected.tenant.fullName}</h2>
                <p className="text-sm text-slate-600">{selected.tenant.email}</p>
                <p className="text-xs text-slate-600">Rent amount: {centsToCurrency(selected.tenant.rentAmountCents)}</p>
                <p className="text-xs text-slate-600">Rent cycle: every {selected.tenant.rentCycleMonths} month(s)</p>
              </div>

              <div>
                <Link
                  id="landlord-tenants-detail-property-settings-link"
                  href="/landlord/properties"
                  className="inline-flex rounded border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700 hover:border-slate-500"
                >
                  Open Property Settings
                </Link>
              </div>

              <div id="landlord-tenants-detail-settings-summary-card" className="group rounded border border-slate-200 bg-slate-50 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-xs uppercase tracking-wider text-slate-500">Tenant Settings Summary</p>
                  {!isEditingTenantSettings && (
                    <button
                      type="button"
                      onClick={() => {
                        setTenantSettingsDraft({
                          propertyId: selected.tenant.propertyId,
                          rentCycleMonths: selected.tenant.rentCycleMonths,
                          rentAmount: (selected.tenant.rentAmountCents / 100).toFixed(2)
                        });
                        setIsEditingTenantSettings(true);
                      }}
                      className="inline-flex items-center gap-1 rounded border border-slate-300 px-2 py-1 text-[11px] text-slate-700 opacity-0 transition-opacity group-hover:opacity-100 hover:border-slate-500"
                      aria-label="Edit tenant settings summary"
                    >
                      <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                        <path d="M14.69 2.86a1.5 1.5 0 0 1 2.12 2.12l-8.5 8.5-3.06.94.94-3.06 8.5-8.5Zm-8.04 9.1-.4 1.3 1.3-.4 7.96-7.96-.9-.9-7.96 7.96Z" />
                      </svg>
                      Edit
                    </button>
                  )}
                </div>
                {!isEditingTenantSettings && (
                  <div className="space-y-1 text-xs text-slate-600">
                    <p>Property: {selected.property?.name ?? "-"}</p>
                    <p>Rent amount: {centsToCurrency(selected.tenant.rentAmountCents)}</p>
                    <p>Rent cycle: every {selected.tenant.rentCycleMonths} month(s)</p>
                    <p>
                      Contact: {selected.tenant.email}
                      {selected.tenant.phone ? ` · ${selected.tenant.phone}` : ""}
                    </p>
                  </div>
                )}
                {isEditingTenantSettings && (
                  <form
                    className="space-y-2"
                    onSubmit={(event) => {
                      event.preventDefault();
                      state.updateTenantSettings({
                        tenantId: selected.tenant.id,
                        propertyId: tenantSettingsDraft.propertyId || selected.tenant.propertyId,
                        rentCycleMonths: tenantSettingsDraft.rentCycleMonths,
                        rentAmountCents: Math.round(Number(tenantSettingsDraft.rentAmount || 0) * 100)
                      });
                      setIsEditingTenantSettings(false);
                    }}
                  >
                    <Select
                      value={tenantSettingsDraft.propertyId}
                      onChange={(event) =>
                        setTenantSettingsDraft((prev) => ({
                          ...prev,
                          propertyId: event.target.value
                        }))
                      }
                      className="text-sm"
                    >
                      {landlordProperties.map((property) => (
                        <option key={property.id} value={property.id}>
                          {property.name}
                        </option>
                      ))}
                    </Select>
                    <div className="grid gap-2 md:grid-cols-2">
                      <Select
                        value={tenantSettingsDraft.rentCycleMonths}
                        onChange={(event) =>
                          setTenantSettingsDraft((prev) => ({
                            ...prev,
                            rentCycleMonths: Number(event.target.value) as 1 | 3 | 6 | 12
                          }))
                        }
                        className="text-sm"
                      >
                        <option value={1}>1 month cycle</option>
                        <option value={3}>3 month cycle</option>
                        <option value={6}>6 month cycle</option>
                        <option value={12}>12 month cycle</option>
                      </Select>
                      <Input
                        value={tenantSettingsDraft.rentAmount}
                        onChange={(event) =>
                          setTenantSettingsDraft((prev) => ({
                            ...prev,
                            rentAmount: event.target.value
                          }))
                        }
                        type="number"
                        min="0"
                        step="0.01"
                        className="text-sm"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button type="submit" className="rounded border border-slate-800 px-2 py-1 text-xs text-slate-900">
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsEditingTenantSettings(false)}
                        className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-700"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                )}
              </div>

              <div id="landlord-tenants-detail-grade-card">
                <GradeCard
                  grade={selected.grade}
                  footer={
                    canEditGrade ? (
                      <button
                        type="button"
                        onClick={() => setIsGradeModalOpen(true)}
                        className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:border-slate-500"
                      >
                        Edit Grade
                      </button>
                    ) : undefined
                  }
                />
              </div>

              <div className="grid gap-2 md:grid-cols-2">
                <div className="rounded border border-slate-200 bg-slate-50 p-2 text-xs text-slate-700">Payments: {selected.payments.length}</div>
                <div className="rounded border border-slate-200 bg-slate-50 p-2 text-xs text-slate-700">Condition proofs: {selected.conditionProofs.length}</div>
                <div className="rounded border border-slate-200 bg-slate-50 p-2 text-xs text-slate-700">Refund requests: {selected.refunds.length}</div>
                <div className="rounded border border-slate-200 bg-slate-50 p-2 text-xs text-slate-700">Tickets: {selected.tickets.length}</div>
              </div>

              <div>
                <p className="text-xs uppercase tracking-wider text-slate-500">Recent Documents</p>
                <div className="mt-2 space-y-2 text-sm">
                  {selected.payments.slice(0, 4).map((payment) => (
                    <div key={payment.id} className="rounded border border-slate-200 p-2">
                      <p className="font-medium text-slate-900">{payment.kind} - {centsToCurrency(payment.amountCents)}</p>
                      <p className="text-xs text-slate-600">Status: {payment.status}</p>
                    </div>
                  ))}
                  {selected.conditionProofs.slice(0, 3).map((proof) => (
                    <div key={proof.id} className="rounded border border-slate-200 p-2">
                      <p className="font-medium text-slate-900">Condition proof ({proof.category ?? "incident"})</p>
                      <p className="text-xs text-slate-600">Status: {proof.status}</p>
                    </div>
                  ))}
                  {selected.refunds.slice(0, 3).map((refund) => (
                    <div key={refund.id} className="rounded border border-slate-200 p-2">
                      <p className="font-medium text-slate-900">Refund ({refund.reasonCategory})</p>
                      <p className="text-xs text-slate-600">Status: {refund.status}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
      {selected && (
        <GradeEditModal
          open={isGradeModalOpen}
          title={`Edit Grade: ${selected.tenant.fullName}`}
          initialValue={{
            score: selected.grade?.score ?? 3,
            reasons: selected.grade?.reasons ?? [],
            note: selected.grade?.note ?? ""
          }}
          onClose={() => setIsGradeModalOpen(false)}
          onSave={(value) => {
            upsertGrade({
              propertyId: selected.tenant.propertyId,
              tenantId: selected.tenant.id,
              score: value.score,
              reasons: value.reasons,
              note: value.note,
              createdByUserId: authSession?.userId ?? activeLandlordId ?? "landlord_local"
            });
          }}
        />
      )}
    </Main>
  );
}
