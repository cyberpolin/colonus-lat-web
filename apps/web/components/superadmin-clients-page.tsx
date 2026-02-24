"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { MainMenu } from "@/components/main-menu";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Main } from "@/components/ui/main";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { SuperAdminRouteGuard } from "@/components/super-admin-route-guard";
import { centsToCurrency } from "@/lib/format";
import {
  getSyncHistoryFileContent,
  getSyncHistoryList,
  type SyncHistoryFileItem
} from "@/lib/sync-history-api";
import { useColonusStore } from "@/lib/store";
import { hasClientDraftInStorage } from "@/lib/use-client";
import type { PlanTier, SubscriptionStatus } from "@colonus/shared";

const tierOptions: Array<{ value: PlanTier; label: string }> = [
  { value: "free", label: "Free" },
  { value: "unlimited", label: "Unlimited" }
];

const statusOptions: Array<{ value: SubscriptionStatus; label: string }> = [
  { value: "trial", label: "Trial" },
  { value: "active", label: "Active" },
  { value: "past_due", label: "Past Due" },
  { value: "canceled", label: "Canceled" }
];

export function SuperAdminClientsPage() {
  const state = useColonusStore();
  const [viewMode, setViewMode] = useState<"clients" | "sync-history">("clients");
  const [search, setSearch] = useState("");
  const [landlordStatusFilter, setLandlordStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [tierFilter, setTierFilter] = useState<"all" | PlanTier | "mixed">("all");
  const [selectedLandlordId, setSelectedLandlordId] = useState<string>();
  const [currentPage, setCurrentPage] = useState(1);
  const [hasClientDraft, setHasClientDraft] = useState(false);
  const [syncHistoryFiles, setSyncHistoryFiles] = useState<SyncHistoryFileItem[]>([]);
  const [isSyncHistoryLoading, setIsSyncHistoryLoading] = useState(false);
  const [syncHistoryError, setSyncHistoryError] = useState<string>();
  const [selectedHistoryPublicId, setSelectedHistoryPublicId] = useState<string>();
  const [selectedHistoryContent, setSelectedHistoryContent] = useState<unknown>();
  const [isHistoryContentLoading, setIsHistoryContentLoading] = useState(false);
  const pageSize = 12;

  const clientRows = useMemo(() => {
    return state.landlords.map((landlord) => {
      const properties = state.properties.filter((item) => item.landlordId === landlord.id);
      const propertyIds = properties.map((item) => item.id);
      const tenants = state.tenants.filter((item) => item.landlordId === landlord.id);
      const subscriptions = state.propertySubscriptions.filter((item) => propertyIds.includes(item.propertyId));
      const tiers = new Set(subscriptions.map((item) => item.tier));
      const tierSummary: "free" | "unlimited" | "mixed" =
        tiers.size === 0 ? "free" : tiers.size === 1 ? (Array.from(tiers)[0] as "free" | "unlimited") : "mixed";
      const pendingPayments = state.paymentSubmissions.filter(
        (item) => propertyIds.includes(item.propertyId) && item.status === "pending"
      ).length;
      const totalPayments = state.paymentSubmissions.filter((item) =>
        propertyIds.includes(item.propertyId)
      ).length;
      const pastDueCount = subscriptions.filter((item) => item.subscriptionStatus === "past_due").length;
      const unresolvedFixes = state.fixRequests.filter(
        (item) => propertyIds.includes(item.propertyId) && item.status !== "resolved"
      ).length;
      const pendingPaymentRatio = totalPayments === 0 ? 0 : pendingPayments / totalPayments;
      const healthScore = Math.max(
        0,
        Math.min(100, Math.round(100 - pastDueCount * 20 - pendingPaymentRatio * 40 - unresolvedFixes * 5))
      );
      const healthLabel = healthScore >= 80 ? "Strong" : healthScore >= 60 ? "Watch" : "At Risk";
      const approvedIncome = state.paymentSubmissions
        .filter((item) => propertyIds.includes(item.propertyId) && item.status === "approved")
        .reduce((acc, item) => acc + item.amountCents, 0);

      return {
        landlord,
        properties,
        tenants,
        subscriptions,
        tierSummary,
        pendingPayments,
        totalPayments,
        pastDueCount,
        unresolvedFixes,
        pendingPaymentRatio,
        healthScore,
        healthLabel,
        approvedIncome
      };
    });
  }, [
    state.landlords,
    state.properties,
    state.tenants,
    state.propertySubscriptions,
    state.paymentSubmissions,
    state.fixRequests
  ]);

  const filtered = useMemo(() => {
    return clientRows.filter((row) => {
      const query = search.trim().toLowerCase();
      const matchesQuery =
        query.length === 0 ||
        row.landlord.fullName.toLowerCase().includes(query) ||
        row.landlord.email.toLowerCase().includes(query) ||
        row.landlord.phone?.toLowerCase().includes(query);
      const matchesStatus = landlordStatusFilter === "all" || row.landlord.status === landlordStatusFilter;
      const matchesTier = tierFilter === "all" || row.tierSummary === tierFilter;
      return matchesQuery && matchesStatus && matchesTier;
    });
  }, [clientRows, search, landlordStatusFilter, tierFilter]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, landlordStatusFilter, tierFilter]);

  useEffect(() => {
    setHasClientDraft(hasClientDraftInStorage());
  }, []);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(currentPage, pageCount);
  const pageStart = (safePage - 1) * pageSize;
  const pageRows = filtered.slice(pageStart, pageStart + pageSize);

  const selected = filtered.find((row) => row.landlord.id === selectedLandlordId) ?? pageRows[0] ?? filtered[0];

  useEffect(() => {
    if (viewMode !== "sync-history") return;
    if (!selected?.landlord.id) {
      setSyncHistoryFiles([]);
      setSelectedHistoryPublicId(undefined);
      setSelectedHistoryContent(undefined);
      return;
    }

    let cancelled = false;
    setIsSyncHistoryLoading(true);
    setSyncHistoryError(undefined);
    setSyncHistoryFiles([]);
    setSelectedHistoryPublicId(undefined);
    setSelectedHistoryContent(undefined);

    void getSyncHistoryList(selected.landlord.id)
      .then((files) => {
        if (cancelled) return;
        setSyncHistoryFiles(files);
      })
      .catch((error) => {
        if (cancelled) return;
        setSyncHistoryError(error instanceof Error ? error.message : "Failed to load sync history.");
      })
      .finally(() => {
        if (cancelled) return;
        setIsSyncHistoryLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selected?.landlord.id, viewMode]);

  useEffect(() => {
    if (viewMode !== "sync-history") return;
    if (!selectedHistoryPublicId) {
      setSelectedHistoryContent(undefined);
      return;
    }

    let cancelled = false;
    setIsHistoryContentLoading(true);
    setSyncHistoryError(undefined);

    void getSyncHistoryFileContent(selectedHistoryPublicId)
      .then((content) => {
        if (cancelled) return;
        setSelectedHistoryContent(content);
      })
      .catch((error) => {
        if (cancelled) return;
        setSyncHistoryError(
          error instanceof Error ? error.message : "Failed to load history file content."
        );
        setSelectedHistoryContent(undefined);
      })
      .finally(() => {
        if (cancelled) return;
        setIsHistoryContentLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedHistoryPublicId, viewMode]);

  return (
    <SuperAdminRouteGuard title="Client List">
      <Main
        eyebrow="Super Admin"
        title="Landlord Clients"
        description="Search, filter, edit client details, activate/deactivate accounts, and manage tier inheritance through properties."      >
        <MainMenu visible role="super_admin" />

        <div className="mt-4 flex flex-wrap gap-2">
          <Link href="/superadmin" className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:border-slate-500">
            Back To Dashboard
          </Link>
          <Link href="/superadmin/add-client" className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:border-slate-500">
            Add Client
            {hasClientDraft && (
              <span className="ml-2 inline-flex h-4 w-4 items-center justify-center rounded-full border border-slate-500 text-[10px] leading-none">
                !
              </span>
            )}
          </Link>
          <button
            type="button"
            id="superadmin-clients-sync-history-button"
            onClick={() =>
              setViewMode((mode) => (mode === "clients" ? "sync-history" : "clients"))
            }
            className={`rounded-full border px-4 py-2 text-sm ${
              viewMode === "sync-history"
                ? "border-slate-700 bg-slate-100 text-slate-900"
                : "border-slate-300 bg-white text-slate-700 hover:border-slate-500"
            }`}
          >
            Sync History
          </button>
        </div>

        <section id="superadmin-clients-filters-card" className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="grid gap-2 md:grid-cols-4">
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search name, email, phone"
              className="rounded border border-slate-300 p-2"
            />
            <Select
              value={landlordStatusFilter}
              onChange={(event) => setLandlordStatusFilter(event.target.value as "all" | "active" | "inactive")}
              className="rounded border border-slate-300 p-2"
            >
              <option value="all">All statuses</option>
              <option value="active">Active only</option>
              <option value="inactive">Inactive only</option>
            </Select>
            <Select
              value={tierFilter}
              onChange={(event) => setTierFilter(event.target.value as "all" | PlanTier | "mixed")}
              className="rounded border border-slate-300 p-2"
            >
              <option value="all">All tiers</option>
              <option value="free">Free</option>
              <option value="unlimited">Unlimited</option>
              <option value="mixed">Mixed</option>
            </Select>
            <p className="rounded border border-slate-200 bg-slate-50 p-2 text-sm text-slate-700">
              Results: {filtered.length}
            </p>
          </div>
        </section>

        {viewMode === "clients" && (
        <div className="mt-4 grid gap-4 lg:grid-cols-[1.2fr_1fr]">
          <section id="superadmin-clients-list-card" className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="space-y-2">
              {pageRows.map((row) => (
                <button
                  key={row.landlord.id}
                  type="button"
                  onClick={() => setSelectedLandlordId(row.landlord.id)}
                  className={`w-full rounded border p-3 text-left text-sm ${
                    selected?.landlord.id === row.landlord.id
                      ? "border-slate-700 bg-slate-50"
                      : "border-slate-200 hover:border-slate-400"
                  }`}
                >
                  <p className="font-medium text-slate-900">{row.landlord.fullName}</p>
                  <p className="text-slate-600">{row.landlord.email}</p>
                  <p className="text-xs text-slate-600">
                    {row.landlord.status} · {row.properties.length} properties · {row.tenants.length} tenants · {row.tierSummary} tier
                  </p>
                  <p className="mt-1 text-xs text-slate-600">
                    Health: {row.healthScore}/100 ({row.healthLabel})
                  </p>
                  <p className="mt-2 text-xs text-slate-700">
                    Open: <span className="underline">/superadmin/clients/{row.landlord.id}</span>
                  </p>
                </button>
              ))}
              {filtered.length === 0 && (
                <EmptyState
                  title="No Clients Found"
                  message="Try a different search or reset filters to view landlord clients."
                />
              )}
            </div>
            <div className="mt-4 flex items-center justify-between border-t border-slate-200 pt-3 text-xs text-slate-600">
              <p>
                Page {safePage} of {pageCount}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={safePage <= 1}
                  onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                  className="rounded border border-slate-300 px-2 py-1 disabled:opacity-40"
                >
                  Previous
                </button>
                <button
                  type="button"
                  disabled={safePage >= pageCount}
                  onClick={() => setCurrentPage((page) => Math.min(pageCount, page + 1))}
                  className="rounded border border-slate-300 px-2 py-1 disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          </section>

          <section id="superadmin-clients-detail-card" className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            {!selected && (
              <div className="space-y-3">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-4 w-64" />
                <Skeleton className="h-20 w-full" />
                <EmptyState
                  title="No Client Selected"
                  message="Pick a landlord from the list to view client details and controls."
                />
              </div>
            )}
            {selected && (
              <div className="space-y-4">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">{selected.landlord.fullName}</h2>
                  <p className="text-sm text-slate-600">{selected.landlord.email}</p>
                  <p className="text-xs text-slate-600">Credentials sent: {selected.landlord.credentialsSentAt ? new Date(selected.landlord.credentialsSentAt).toLocaleString("en-US") : "Not sent"}</p>
                  <Link
                    href={`/superadmin/clients/${selected.landlord.id}`}
                    className="mt-2 inline-flex rounded border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:border-slate-500"
                  >
                    Open Client Info
                  </Link>
                </div>

                <div className="grid gap-2 md:grid-cols-2">
                  <div className="rounded border border-slate-200 bg-slate-50 p-2 text-xs text-slate-700">Properties: {selected.properties.length}</div>
                  <div className="rounded border border-slate-200 bg-slate-50 p-2 text-xs text-slate-700">Tenants: {selected.tenants.length}</div>
                  <div className="rounded border border-slate-200 bg-slate-50 p-2 text-xs text-slate-700">Pending payments: {selected.pendingPayments}</div>
                  <div className="rounded border border-slate-200 bg-slate-50 p-2 text-xs text-slate-700">Approved income: {centsToCurrency(selected.approvedIncome)}</div>
                  <div className="rounded border border-slate-200 bg-slate-50 p-2 text-xs text-slate-700">Past due subscriptions: {selected.pastDueCount}</div>
                  <div className="rounded border border-slate-200 bg-slate-50 p-2 text-xs text-slate-700">Pending payment ratio: {Math.round(selected.pendingPaymentRatio * 100)}%</div>
                  <div className="rounded border border-slate-200 bg-slate-50 p-2 text-xs text-slate-700">Unresolved fixes: {selected.unresolvedFixes}</div>
                  <div className="rounded border border-slate-200 bg-slate-50 p-2 text-xs text-slate-700">
                    Health score: {selected.healthScore}/100 ({selected.healthLabel})
                  </div>
                </div>

                <form
                  className="space-y-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    const form = new FormData(event.currentTarget);
                    state.updateLandlord({
                      landlordId: selected.landlord.id,
                      fullName: String(form.get("fullName") ?? ""),
                      email: String(form.get("email") ?? ""),
                      phone: String(form.get("phone") ?? ""),
                      paymentSubmissionFrequency: Number(form.get("paymentSubmissionFrequency") ?? 1) as 1 | 3 | 6 | 12,
                      proofSubmissionFrequency: Number(form.get("proofSubmissionFrequency") ?? 1) as 1 | 3 | 6 | 12
                    });
                  }}
                >
                  <p className="text-xs uppercase tracking-wider text-slate-500">Edit Client</p>
                  <Input name="fullName" defaultValue={selected.landlord.fullName} className="w-full rounded border border-slate-300 p-2" />
                  <Input name="email" type="email" defaultValue={selected.landlord.email} className="w-full rounded border border-slate-300 p-2" />
                  <Input name="phone" defaultValue={selected.landlord.phone} className="w-full rounded border border-slate-300 p-2" />
                  <Select name="paymentSubmissionFrequency" defaultValue={selected.landlord.paymentSubmissionFrequency} className="w-full rounded border border-slate-300 p-2">
                    <option value={1}>Payment every 1 month</option>
                    <option value={3}>Payment every 3 months</option>
                    <option value={6}>Payment every 6 months</option>
                    <option value={12}>Payment every 12 months</option>
                  </Select>
                  <Select name="proofSubmissionFrequency" defaultValue={selected.landlord.proofSubmissionFrequency} className="w-full rounded border border-slate-300 p-2">
                    <option value={1}>Proof every 1 month</option>
                    <option value={3}>Proof every 3 months</option>
                    <option value={6}>Proof every 6 months</option>
                    <option value={12}>Proof every 12 months</option>
                  </Select>
                  <button className="rounded bg-slate-900 px-3 py-2 text-sm text-white">Save Changes</button>
                </form>

                <div className="space-y-2">
                  <p className="text-xs uppercase tracking-wider text-slate-500">Client Controls</p>
                  <button
                    type="button"
                    onClick={() =>
                      state.setLandlordStatus({
                        landlordId: selected.landlord.id,
                        status: selected.landlord.status === "active" ? "inactive" : "active"
                      })
                    }
                    className="rounded border border-slate-400 px-3 py-2 text-xs text-slate-700"
                  >
                    {selected.landlord.status === "active" ? "Deactivate" : "Activate"} Client
                  </button>
                  <button
                    type="button"
                    onClick={() => state.markLandlordCredentialsSent(selected.landlord.id)}
                    className="ml-2 rounded border border-slate-400 px-3 py-2 text-xs text-slate-700"
                  >
                    Resend Credentials
                  </button>
                </div>

                <form
                  className="space-y-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    const form = new FormData(event.currentTarget);
                    state.setLandlordTier({
                      landlordId: selected.landlord.id,
                      tier: String(form.get("tier") ?? "free") as PlanTier,
                      subscriptionStatus: String(form.get("subscriptionStatus") ?? "trial") as SubscriptionStatus
                    });
                  }}
                >
                  <p className="text-xs uppercase tracking-wider text-slate-500">Change Tier For All Client Properties</p>
                  <Select name="tier" defaultValue={selected.tierSummary === "mixed" ? "free" : selected.tierSummary} className="w-full rounded border border-slate-300 p-2">
                    {tierOptions.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </Select>
                  <Select name="subscriptionStatus" defaultValue="trial" className="w-full rounded border border-slate-300 p-2">
                    {statusOptions.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </Select>
                  <button className="rounded bg-slate-900 px-3 py-2 text-sm text-white">Apply Tier To Properties</button>
                </form>
              </div>
            )}
          </section>
        </div>
        )}

        {viewMode === "sync-history" && (
          <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_1.4fr]">
            <section
              id="superadmin-sync-history-list-card"
              className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">
                Sync History Files
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                {selected
                  ? `${selected.landlord.fullName} (${selected.landlord.id})`
                  : "Select a landlord in the filters/list view first."}
              </p>
              {isSyncHistoryLoading && (
                <div className="mt-3 space-y-2">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              )}
              {!isSyncHistoryLoading && syncHistoryFiles.length === 0 && (
                <div className="mt-3">
                  <EmptyState
                    title="No Sync History Files"
                    message="No history files found for this landlord yet."
                  />
                </div>
              )}
              {!isSyncHistoryLoading && syncHistoryFiles.length > 0 && (
                <div className="mt-3 max-h-[520px] space-y-2 overflow-auto pr-1">
                  {syncHistoryFiles.map((file) => (
                    <button
                      key={file.publicId}
                      type="button"
                      onClick={() => setSelectedHistoryPublicId(file.publicId)}
                      className={`w-full rounded border p-2 text-left text-xs ${
                        selectedHistoryPublicId === file.publicId
                          ? "border-slate-700 bg-slate-50"
                          : "border-slate-200 hover:border-slate-400"
                      }`}
                    >
                      <p className="truncate font-medium text-slate-900">{file.publicId}</p>
                      <p className="mt-1 text-slate-600">
                        {file.createdAt
                          ? new Date(file.createdAt).toLocaleString("en-US")
                          : "Unknown timestamp"}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </section>

            <section
              id="superadmin-sync-history-content-card"
              className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">
                File Content
              </h2>
              {syncHistoryError && (
                <p className="mt-2 rounded border border-slate-300 bg-slate-50 p-2 text-xs text-slate-700">
                  {syncHistoryError}
                </p>
              )}
              {!selectedHistoryPublicId && !isHistoryContentLoading && (
                <div className="mt-3">
                  <EmptyState
                    title="No File Selected"
                    message="Choose a history file from the list to open its JSON content."
                  />
                </div>
              )}
              {isHistoryContentLoading && (
                <div className="mt-3 space-y-2">
                  <Skeleton className="h-5 w-40" />
                  <Skeleton className="h-64 w-full" />
                </div>
              )}
              {!isHistoryContentLoading &&
                selectedHistoryPublicId &&
                selectedHistoryContent !== undefined && (
                <pre className="mt-3 max-h-[560px] overflow-auto rounded border border-slate-200 bg-slate-50 p-3 text-[11px] leading-relaxed text-slate-700">
                  {JSON.stringify(selectedHistoryContent, null, 2)}
                </pre>
              )}
            </section>
          </div>
        )}
      </Main>
    </SuperAdminRouteGuard>
  );
}
