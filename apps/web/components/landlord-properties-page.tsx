"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { MainMenu } from "@/components/main-menu";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Main } from "@/components/ui/main";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { centsToCurrency } from "@/lib/format";
import { useColonusStore } from "@/lib/store";
import type { ProofRequirement } from "@colonus/shared";

const proofRequirementOptions: Array<{ value: ProofRequirement; label: string }> = [
  { value: "optional", label: "Optional" },
  { value: "required", label: "Required" },
  { value: "disabled", label: "Do Not Collect" }
];

export function LandlordPropertiesPage() {
  const state = useColonusStore();
  const impersonationRole = useColonusStore((store) => store.impersonationRole);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "stable" | "attention">("all");
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>();
  const [isEditingPropertyInfo, setIsEditingPropertyInfo] = useState(false);
  const [isEditingProofRules, setIsEditingProofRules] = useState(false);
  const [propertyInfoDraft, setPropertyInfoDraft] = useState({
    name: "",
    address: "",
    unitCode: "",
    monthlyRent: ""
  });
  const [proofRulesDraft, setProofRulesDraft] = useState<{
    rentPaymentProof: ProofRequirement;
    servicePaymentProof: ProofRequirement;
    careProof: ProofRequirement;
  }>({
    rentPaymentProof: "optional",
    servicePaymentProof: "optional",
    careProof: "optional"
  });

  const isLocked = impersonationRole !== "landlord";
  const activeLandlordId = state.activeLandlordId ?? state.landlords[0]?.id;

  const rows = useMemo(() => {
    const scopedProperties = state.properties.filter((property) => property.landlordId === activeLandlordId);
    return scopedProperties.map((property) => {
      const tenants = state.tenants.filter((tenant) => tenant.propertyId === property.id);
      const payments = state.paymentSubmissions.filter((payment) => payment.propertyId === property.id);
      const tickets = state.tickets.filter((ticket) => ticket.propertyId === property.id);
      const refunds = state.refundRequests.filter((refund) => refund.propertyId === property.id);
      const conditionProofs = state.careProofSubmissions.filter((proof) => proof.propertyId === property.id);
      const subscription = state.propertySubscriptions.find((sub) => sub.propertyId === property.id);
      const proofSettings = state.propertyProofSettings.find((settings) => settings.propertyId === property.id);

      const approvedIncome = payments
        .filter((payment) => payment.status === "approved")
        .reduce((acc, payment) => acc + payment.amountCents, 0);
      const pendingPayments = payments.filter((payment) => payment.status === "pending").length;
      const openTickets = tickets.filter(
        (ticket) => ticket.status === "open" || ticket.status === "in_progress"
      ).length;
      const openRefunds = refunds.filter(
        (refund) => refund.status === "submitted" || refund.status === "in_review"
      ).length;
      const attentionScore = pendingPayments + openTickets + openRefunds;
      const health = attentionScore > 2 ? "attention" : "stable";

      return {
        property,
        tenants,
        payments,
        tickets,
        refunds,
        conditionProofs,
        subscription,
        proofSettings,
        approvedIncome,
        pendingPayments,
        openTickets,
        openRefunds,
        health
      };
    });
  }, [
    activeLandlordId,
    state.properties,
    state.tenants,
    state.paymentSubmissions,
    state.tickets,
    state.refundRequests,
    state.careProofSubmissions,
    state.propertySubscriptions,
    state.propertyProofSettings
  ]);

  const filtered = useMemo(() => {
    return rows.filter((row) => {
      const query = search.trim().toLowerCase();
      const matchesQuery =
        !query ||
        row.property.name.toLowerCase().includes(query) ||
        row.property.address.toLowerCase().includes(query) ||
        (row.property.unitCode ?? "").toLowerCase().includes(query);
      const matchesStatus = statusFilter === "all" || row.health === statusFilter;
      return matchesQuery && matchesStatus;
    });
  }, [rows, search, statusFilter]);

  const selected = filtered.find((row) => row.property.id === selectedPropertyId) ?? filtered[0];

  useEffect(() => {
    if (!selected || isEditingPropertyInfo) return;
    setPropertyInfoDraft({
      name: selected.property.name,
      address: selected.property.address,
      unitCode: selected.property.unitCode ?? "",
      monthlyRent: (selected.property.monthlyRentCents / 100).toFixed(2)
    });
  }, [
    selected?.property.id,
    selected?.property.name,
    selected?.property.address,
    selected?.property.unitCode,
    selected?.property.monthlyRentCents,
    isEditingPropertyInfo
  ]);

  useEffect(() => {
    if (!selected || isEditingProofRules) return;
    setProofRulesDraft({
      rentPaymentProof: selected.proofSettings?.rentPaymentProof ?? "optional",
      servicePaymentProof: selected.proofSettings?.servicePaymentProof ?? "optional",
      careProof: selected.proofSettings?.careProof ?? "optional"
    });
  }, [
    selected?.property.id,
    selected?.proofSettings?.rentPaymentProof,
    selected?.proofSettings?.servicePaymentProof,
    selected?.proofSettings?.careProof,
    isEditingProofRules
  ]);

  if (isLocked) {
    return (
      <Main
        eyebrow="Landlord"
        title="Property Portfolio"
        description="Select landlord from role selector before opening this route."
        maxWidthClassName="max-w-2xl"      >
        <MainMenu visible role="landlord" />
        <section id="landlord-properties-route-locked-card" className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-semibold text-slate-900">Landlord Properties Locked</h1>
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
      title="Property Portfolio"
      description="Operational view across your properties, tenants, proofs, tickets, and payment health."    >
      <MainMenu visible role="landlord" />
      <nav id="landlord-properties-breadcrumb" aria-label="Breadcrumb" className="text-xs text-slate-500">
        <p className="flex flex-wrap items-center gap-2">
          <Link href="/" className="hover:text-slate-700">
            Home
          </Link>
          <span>/</span>
          <Link href="/landlord" className="hover:text-slate-700">
            Landlord
          </Link>
          <span>/</span>
          <span className="text-slate-700">Properties</span>
        </p>
      </nav>

      <section id="landlord-properties-filters-card" className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-2 md:grid-cols-3">
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search property by name, address, unit"
            className="rounded border border-slate-300 p-2"
          />
          <Select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as "all" | "stable" | "attention")}
            className="rounded border border-slate-300 p-2"
          >
            <option value="all">All status</option>
            <option value="stable">Stable</option>
            <option value="attention">Needs attention</option>
          </Select>
          <p className="rounded border border-slate-200 bg-slate-50 p-2 text-sm text-slate-700">Results: {filtered.length}</p>
        </div>
      </section>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <section id="landlord-properties-detail-card" className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="space-y-2">
            {filtered.map((row) => (
              <button
                key={row.property.id}
                type="button"
                onClick={() => setSelectedPropertyId(row.property.id)}
                className={`w-full rounded border p-3 text-left text-sm ${
                  selected?.property.id === row.property.id
                    ? "border-slate-700 bg-slate-50"
                    : "border-slate-200 hover:border-slate-400"
                }`}
              >
                <p className="font-medium text-slate-900">{row.property.name}</p>
                <p className="text-slate-600">{row.property.address}</p>
                <p className="text-xs text-slate-600">
                  Tenants: {row.tenants.length} · Pending payments: {row.pendingPayments} · Open tickets: {row.openTickets}
                </p>
                <p className="text-xs text-slate-600">Approved income: {centsToCurrency(row.approvedIncome)}</p>
              </button>
            ))}
            {filtered.length === 0 && (
              <EmptyState
                title="No Matching Properties"
                message="No property matches the current filters. Try a different query."
              />
            )}
          </div>
        </section>

        <section id="landlord-properties-proof-settings-card" className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          {!selected && (
            <div className="space-y-3">
              <Skeleton className="h-5 w-44" />
              <Skeleton className="h-4 w-56" />
              <Skeleton className="h-20 w-full" />
              <EmptyState
                title="No Property Selected"
                message="Select a property from the list to view operational details."
              />
            </div>
          )}
          {selected && (
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">{selected.property.name}</h2>
                <p className="text-sm text-slate-600">{selected.property.address}</p>
                <p className="text-xs text-slate-600">Unit: {selected.property.unitCode || "-"}</p>
                <p className="text-xs text-slate-600">Tier: {selected.subscription?.tier ?? "free"}</p>
                <p className="text-xs text-slate-600">Subscription status: {selected.subscription?.subscriptionStatus ?? "trial"}</p>
              </div>

              <div className="grid gap-2 md:grid-cols-2">
                <Link
                  href="/landlord/tenants"
                  className="rounded border border-slate-200 bg-slate-50 p-2 text-xs text-slate-700 hover:border-slate-400"
                >
                  Tenants: {selected.tenants.length}
                </Link>
                <div className="rounded border border-slate-200 bg-slate-50 p-2 text-xs text-slate-700">Payments: {selected.payments.length}</div>
                <div className="rounded border border-slate-200 bg-slate-50 p-2 text-xs text-slate-700">Condition proofs: {selected.conditionProofs.length}</div>
                <div className="rounded border border-slate-200 bg-slate-50 p-2 text-xs text-slate-700">Refund requests: {selected.refunds.length}</div>
                <div className="rounded border border-slate-200 bg-slate-50 p-2 text-xs text-slate-700">Tickets: {selected.tickets.length}</div>
                <div className="rounded border border-slate-200 bg-slate-50 p-2 text-xs text-slate-700">Approved income: {centsToCurrency(selected.approvedIncome)}</div>
              </div>

              <div id="landlord-properties-proof-rules-inline-editor" className="group rounded border border-slate-200 bg-slate-50 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-xs uppercase tracking-wider text-slate-500">Proof Rules</p>
                  {!isEditingProofRules && (
                    <button
                      type="button"
                      onClick={() => {
                        setProofRulesDraft({
                          rentPaymentProof: selected.proofSettings?.rentPaymentProof ?? "optional",
                          servicePaymentProof: selected.proofSettings?.servicePaymentProof ?? "optional",
                          careProof: selected.proofSettings?.careProof ?? "optional"
                        });
                        setIsEditingProofRules(true);
                      }}
                      className="inline-flex items-center gap-1 rounded border border-slate-300 px-2 py-1 text-[11px] text-slate-700 opacity-0 transition-opacity group-hover:opacity-100 hover:border-slate-500"
                      aria-label="Edit proof rules"
                    >
                      <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                        <path d="M14.69 2.86a1.5 1.5 0 0 1 2.12 2.12l-8.5 8.5-3.06.94.94-3.06 8.5-8.5Zm-8.04 9.1-.4 1.3 1.3-.4 7.96-7.96-.9-.9-7.96 7.96Z" />
                      </svg>
                      Edit
                    </button>
                  )}
                </div>

                {!isEditingProofRules && (
                  <div className="space-y-1 text-xs text-slate-600">
                    <p>Rent proof: {selected.proofSettings?.rentPaymentProof ?? "optional"}</p>
                    <p>Service proof: {selected.proofSettings?.servicePaymentProof ?? "optional"}</p>
                    <p>Condition proof: {selected.proofSettings?.careProof ?? "optional"}</p>
                  </div>
                )}

                {isEditingProofRules && (
                  <form
                    className="space-y-2"
                    onSubmit={(event) => {
                      event.preventDefault();
                      state.setPropertyProofRequirement({
                        propertyId: selected.property.id,
                        field: "rentPaymentProof",
                        requirement: proofRulesDraft.rentPaymentProof
                      });
                      state.setPropertyProofRequirement({
                        propertyId: selected.property.id,
                        field: "servicePaymentProof",
                        requirement: proofRulesDraft.servicePaymentProof
                      });
                      state.setPropertyProofRequirement({
                        propertyId: selected.property.id,
                        field: "careProof",
                        requirement: proofRulesDraft.careProof
                      });
                      setIsEditingProofRules(false);
                    }}
                  >
                    <label className="text-xs text-slate-600">
                      Rent Payment Proof
                      <Select
                        className="mt-1 w-full text-sm"
                        value={proofRulesDraft.rentPaymentProof}
                        onChange={(event) =>
                          setProofRulesDraft((prev) => ({
                            ...prev,
                            rentPaymentProof: event.target.value as ProofRequirement
                          }))
                        }
                      >
                        {proofRequirementOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </Select>
                    </label>
                    <label className="text-xs text-slate-600">
                      Service Payment Proof
                      <Select
                        className="mt-1 w-full text-sm"
                        value={proofRulesDraft.servicePaymentProof}
                        onChange={(event) =>
                          setProofRulesDraft((prev) => ({
                            ...prev,
                            servicePaymentProof: event.target.value as ProofRequirement
                          }))
                        }
                      >
                        {proofRequirementOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </Select>
                    </label>
                    <label className="text-xs text-slate-600">
                      Property Care Proof
                      <Select
                        className="mt-1 w-full text-sm"
                        value={proofRulesDraft.careProof}
                        onChange={(event) =>
                          setProofRulesDraft((prev) => ({
                            ...prev,
                            careProof: event.target.value as ProofRequirement
                          }))
                        }
                      >
                        {proofRequirementOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </Select>
                    </label>
                    <div className="flex gap-2">
                      <button type="submit" className="rounded border border-slate-800 px-2 py-1 text-xs text-slate-900">
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsEditingProofRules(false)}
                        className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-700"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                )}
              </div>

              <div
                id="landlord-properties-proof-settings-property-info"
                className="group rounded border border-slate-200 bg-slate-50 p-3"
              >
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-xs uppercase tracking-wider text-slate-500">Property Settings</p>
                  {!isEditingPropertyInfo && (
                    <button
                      type="button"
                      onClick={() => {
                        setPropertyInfoDraft({
                          name: selected.property.name,
                          address: selected.property.address,
                          unitCode: selected.property.unitCode ?? "",
                          monthlyRent: (selected.property.monthlyRentCents / 100).toFixed(2)
                        });
                        setIsEditingPropertyInfo(true);
                      }}
                      className="inline-flex items-center gap-1 rounded border border-slate-300 px-2 py-1 text-[11px] text-slate-700 opacity-0 transition-opacity group-hover:opacity-100 hover:border-slate-500"
                      aria-label="Edit property settings"
                    >
                      <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                        <path d="M14.69 2.86a1.5 1.5 0 0 1 2.12 2.12l-8.5 8.5-3.06.94.94-3.06 8.5-8.5Zm-8.04 9.1-.4 1.3 1.3-.4 7.96-7.96-.9-.9-7.96 7.96Z" />
                      </svg>
                      Edit
                    </button>
                  )}
                </div>

                {!isEditingPropertyInfo && (
                  <div className="space-y-1 text-xs text-slate-600">
                    <p>Name: {selected.property.name}</p>
                    <p>Address: {selected.property.address || "-"}</p>
                    <p>Unit: {selected.property.unitCode || "-"}</p>
                    <p>Monthly rent: {centsToCurrency(selected.property.monthlyRentCents)}</p>
                  </div>
                )}

                {isEditingPropertyInfo && (
                  <form
                    className="space-y-2"
                    onSubmit={(event) => {
                      event.preventDefault();
                      state.updatePropertySettings({
                        propertyId: selected.property.id,
                        name: propertyInfoDraft.name.trim() || selected.property.name,
                        address: propertyInfoDraft.address.trim(),
                        unitCode: propertyInfoDraft.unitCode.trim(),
                        monthlyRentCents: Math.round(Number(propertyInfoDraft.monthlyRent || 0) * 100)
                      });
                      setIsEditingPropertyInfo(false);
                    }}
                  >
                    <Input
                      value={propertyInfoDraft.name}
                      onChange={(event) =>
                        setPropertyInfoDraft((prev) => ({
                          ...prev,
                          name: event.target.value
                        }))
                      }
                      placeholder="Property name"
                      className="text-sm"
                    />
                    <Input
                      value={propertyInfoDraft.address}
                      onChange={(event) =>
                        setPropertyInfoDraft((prev) => ({
                          ...prev,
                          address: event.target.value
                        }))
                      }
                      placeholder="Address"
                      className="text-sm"
                    />
                    <div className="grid gap-2 md:grid-cols-2">
                      <Input
                        value={propertyInfoDraft.unitCode}
                        onChange={(event) =>
                          setPropertyInfoDraft((prev) => ({
                            ...prev,
                            unitCode: event.target.value
                          }))
                        }
                        placeholder="Unit"
                        className="text-sm"
                      />
                      <Input
                        value={propertyInfoDraft.monthlyRent}
                        onChange={(event) =>
                          setPropertyInfoDraft((prev) => ({
                            ...prev,
                            monthlyRent: event.target.value
                          }))
                        }
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="Monthly rent"
                        className="text-sm"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button type="submit" className="rounded border border-slate-800 px-2 py-1 text-xs text-slate-900">
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsEditingPropertyInfo(false)}
                        className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-700"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                )}
              </div>

              <div>
                <p className="text-xs uppercase tracking-wider text-slate-500">Recent Activity</p>
                <div className="mt-2 space-y-2 text-sm">
                  {selected.payments.slice(0, 3).map((payment) => (
                    <div key={payment.id} className="rounded border border-slate-200 p-2">
                      <p className="font-medium text-slate-900">Payment {payment.kind} - {centsToCurrency(payment.amountCents)}</p>
                      <p className="text-xs text-slate-600">Status: {payment.status}</p>
                    </div>
                  ))}
                  {selected.tickets.slice(0, 2).map((ticket) => (
                    <div key={ticket.id} className="rounded border border-slate-200 p-2">
                      <p className="font-medium text-slate-900">Ticket: {ticket.title}</p>
                      <p className="text-xs text-slate-600">Status: {ticket.status}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
    </Main>
  );
}
