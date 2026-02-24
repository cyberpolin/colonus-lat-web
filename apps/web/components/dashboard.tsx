"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ImageDropInput } from "@/components/image-drop-input";
import { MainMenu } from "@/components/main-menu";
import { EmptyState } from "@/components/ui/empty-state";
import { GradeBadge } from "@/components/ui/grade-badge";
import { GradeCard } from "@/components/ui/grade-card";
import { ThumbImage } from "@/components/ui/thumb-image";
import { Main } from "@/components/ui/main";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card as SurfaceCard } from "@/components/ui/card";
import { centsToCurrency } from "@/lib/format";
import { useColonusStore } from "@/lib/store";
import { toDescriptiveId } from "@/lib/ui";
import { getFounderDailySnapshot } from "@/lib/superadmin-metrics";
import { useTenantGradesStore } from "@/lib/tenant-grades-store";
import { logBackupSyncEvent, uploadMediaToApi } from "@/lib/upload";
import { hasClientDraftInStorage } from "@/lib/use-client";
import {
  PROOF_IMAGE_PLACEHOLDER_URL,
  type MediaUploadStub,
  type ProofRequirement,
  type SubscriptionStatus,
  type UserRole
} from "@colonus/shared";
import { getOutboxQueue } from "@colonus/sync";

const Card = ({ title, value }: { title: string; value: string | number }) => (
  <div id={`dashboard-card-${toDescriptiveId(title)}`} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
    <p className="text-xs uppercase tracking-wider text-slate-500">{title}</p>
    <p className="mt-2 text-2xl font-semibold text-slate-900">{value}</p>
  </div>
);

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section
    id={`dashboard-section-${toDescriptiveId(title)}`}
    className="space-y-3 rounded-2xl border border-slate-200 bg-white/90 p-5 shadow-sm"
  >
    <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">{title}</h2>
    {children}
  </section>
);

interface DashboardProps {
  role: UserRole;
}

const planTierOptions: Array<{ value: "free" | "unlimited"; label: string }> = [
  { value: "free", label: "Free Trial (10 syncs/day/property)" },
  { value: "unlimited", label: "Unlimited" }
];

const subscriptionStatusOptions: Array<{ value: SubscriptionStatus; label: string }> = [
  { value: "trial", label: "Trial" },
  { value: "active", label: "Active" },
  { value: "past_due", label: "Past Due" },
  { value: "canceled", label: "Canceled" }
];

const toStoredProof = (proof: MediaUploadStub): MediaUploadStub => ({
  ...proof
});

const createSimulatedProof = (fileName: string): MediaUploadStub => ({
  fileName,
  mimeType: "image/jpeg",
  byteSize: 1,
  localObjectUrl: PROOF_IMAGE_PLACEHOLDER_URL
});

const proofRequirementLabel: Record<ProofRequirement, string> = {
  optional: "Optional",
  required: "Required",
  disabled: "Do Not Collect"
};

const isImageMedia = (media?: MediaUploadStub): boolean => {
  if (!media) return false;
  if (media.mimeType.startsWith("image/")) return true;
  return /\.(png|jpe?g|webp|gif|bmp|svg)$/i.test(media.localObjectUrl);
};

const AttachmentPreview = ({
  media,
  alt,
  imageHeightClass = "h-24"
}: {
  media?: MediaUploadStub;
  alt: string;
  imageHeightClass?: string;
}) => {
  if (!media) return null;
  if (isImageMedia(media)) {
    return (
      <div className="mb-2 overflow-hidden rounded border max-w-fit border-slate-200 bg-slate-50">
        <ThumbImage
          src={media.localObjectUrl}
          alt={alt}
          className={`${imageHeightClass} bg-slate-50`}
          fit="contain"
        />
      </div>
    );
  }
  return (
    <a
      href={media.localObjectUrl}
      target="_blank"
      rel="noreferrer"
      className="mb-2 inline-flex rounded border border-slate-300 px-2 py-1 text-xs text-slate-700 underline underline-offset-2"
    >
      Open attachment
    </a>
  );
};

const getCurrentRentCycleRange = (
  startDateIso: string,
  cycleMonths: 1 | 3 | 6 | 12
): { start: Date; end: Date } => {
  const base = new Date(startDateIso);
  if (Number.isNaN(base.getTime())) {
    const fallback = new Date();
    return { start: fallback, end: fallback };
  }
  const now = new Date();
  const monthsDiff = (now.getFullYear() - base.getFullYear()) * 12 + (now.getMonth() - base.getMonth());
  const completedCycles = Math.max(0, Math.floor(monthsDiff / cycleMonths));
  const cycleStart = new Date(base);
  cycleStart.setMonth(base.getMonth() + completedCycles * cycleMonths);
  const cycleEnd = new Date(cycleStart);
  cycleEnd.setMonth(cycleEnd.getMonth() + cycleMonths, 0);
  cycleEnd.setHours(23, 59, 59, 999);
  return { start: cycleStart, end: cycleEnd };
};

export function Dashboard({ role }: DashboardProps) {
  const isDevMode = process.env.NODE_ENV === "development";
  const state = useColonusStore();
  const tenantGrades = useTenantGradesStore((store) => store.tenantGrades);
  const setActiveRole = useColonusStore((store) => store.setActiveRole);

  const [superLandlordId, setSuperLandlordId] = useState("");
  const [tenantLandlordId, setTenantLandlordId] = useState("");
  const [tenantPropertyId, setTenantPropertyId] = useState("");
  const [landlordPropertyId, setLandlordPropertyId] = useState("");
  const [landlordNewTenantPropertyId, setLandlordNewTenantPropertyId] = useState("");
  const [rentProof, setRentProof] = useState<MediaUploadStub>();
  const [serviceProof, setServiceProof] = useState<MediaUploadStub>();
  const [careProof, setCareProof] = useState<MediaUploadStub>();
  const [refundProof, setRefundProof] = useState<MediaUploadStub>();
  const [ticketProof, setTicketProof] = useState<MediaUploadStub>();
  const [uploadNotice, setUploadNotice] = useState<string>();
  const [devActionError, setDevActionError] = useState<string>();
  const [isAddingSuperLandlord, setIsAddingSuperLandlord] = useState(false);
  const [isAddingSuperTenant, setIsAddingSuperTenant] = useState(false);
  const [isAddingLandlordTenant, setIsAddingLandlordTenant] = useState(false);
  const [isSubmittingRentProof, setIsSubmittingRentProof] = useState(false);
  const [isSubmittingServiceProof, setIsSubmittingServiceProof] = useState(false);
  const [isSubmittingConditionProof, setIsSubmittingConditionProof] = useState(false);
  const [isSubmittingRefund, setIsSubmittingRefund] = useState(false);
  const [isSubmittingTicket, setIsSubmittingTicket] = useState(false);
  const [rejectReasonByPaymentId, setRejectReasonByPaymentId] = useState<Record<string, string>>({});
  const [rejectReasonByConditionProofId, setRejectReasonByConditionProofId] = useState<Record<string, string>>({});
  const [refundDecisionById, setRefundDecisionById] = useState<Record<string, string>>({});
  const [hasClientDraft, setHasClientDraft] = useState(false);

  const activeSuperAdminId = state.activeSuperAdminId ?? state.superAdmins[0]?.id;
  const activeLandlordId = state.activeLandlordId ?? state.landlords[0]?.id;
  const activeTenantId = state.activeTenantId ?? state.tenants[0]?.id;
  const activeTenant = state.tenants.find((item) => item.id === activeTenantId);

  const landlordProperties = state.properties.filter((property) => property.landlordId === activeLandlordId);
  const landlordTenants = state.tenants.filter((tenant) => tenant.landlordId === activeLandlordId);
  const activeLandlordPropertyContextId = landlordProperties[0]?.id;
  const activeLandlordSubscription = activeLandlordPropertyContextId
    ? state.propertySubscriptions.find((sub) => sub.propertyId === activeLandlordPropertyContextId)
    : undefined;
  const landlordSyncUsage = activeLandlordPropertyContextId
    ? state.syncUsageByProperty[activeLandlordPropertyContextId]
    : undefined;

  const activeTenantSubscription = activeTenant
    ? state.propertySubscriptions.find((sub) => sub.propertyId === activeTenant.propertyId)
    : undefined;
  const tenantSyncUsage = activeTenant?.propertyId
    ? state.syncUsageByProperty[activeTenant.propertyId]
    : undefined;

  const activeLandlordPropertyIds = landlordProperties.map((property) => property.id);
  const landlordPayments = state.paymentSubmissions.filter((submission) =>
    activeLandlordPropertyIds.includes(submission.propertyId)
  );
  const landlordRevenueCents = landlordPayments
    .filter((submission) => submission.status === "approved")
    .reduce((acc, submission) => acc + submission.amountCents, 0);
  const landlordMonthRevenueCents = landlordPayments
    .filter((submission) => {
      if (submission.status !== "approved") return false;
      const paidAt = new Date(submission.datePaid ?? submission.submittedAt);
      const now = new Date();
      return (
        !Number.isNaN(paidAt.getTime()) &&
        paidAt.getFullYear() === now.getFullYear() &&
        paidAt.getMonth() === now.getMonth()
      );
    })
    .reduce((acc, submission) => acc + submission.amountCents, 0);
  const landlordConditionProofs = state.careProofSubmissions.filter((submission) =>
    activeLandlordPropertyIds.includes(submission.propertyId)
  );
  const landlordRefundRequests = state.refundRequests.filter((request) =>
    activeLandlordPropertyIds.includes(request.propertyId)
  );
  const landlordTickets = state.tickets.filter((ticket) => activeLandlordPropertyIds.includes(ticket.propertyId));

  const tenantProperties = activeTenant
    ? state.properties.filter((property) => property.id === activeTenant.propertyId)
    : [];
  const tenantPayments = state.paymentSubmissions
    .filter((submission) => submission.tenantId === activeTenantId)
    .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
  const tenantConditionProofs = state.careProofSubmissions
    .filter((submission) => submission.tenantId === activeTenantId && activeTenant?.propertyId === submission.propertyId)
    .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
  const tenantRefundRequests = state.refundRequests
    .filter((request) => request.tenantId === activeTenantId && activeTenant?.propertyId === request.propertyId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const tenantTickets = state.tickets
    .filter((ticket) => ticket.createdByTenantId === activeTenantId && activeTenant?.propertyId === ticket.propertyId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const activeTenantCycleMonths = (activeTenant?.rentCycleMonths ?? 1) as 1 | 3 | 6 | 12;
  const tenantCycleRange = activeTenant
    ? getCurrentRentCycleRange(activeTenant.createdAt, activeTenantCycleMonths)
    : undefined;
  const tenantRentApprovedThisCycle = tenantPayments
    .filter((payment) => {
      if (payment.kind !== "rent" || payment.status !== "approved") return false;
      if (!tenantCycleRange) return false;
      const paidAt = new Date(payment.datePaid ?? payment.submittedAt);
      if (Number.isNaN(paidAt.getTime())) return false;
      return paidAt >= tenantCycleRange.start && paidAt <= tenantCycleRange.end;
    })
    .reduce((acc, payment) => acc + payment.amountCents, 0);
  const tenantRentDue = Math.max((activeTenant?.rentAmountCents ?? 0) - tenantRentApprovedThisCycle, 0);
  const tenantDaysToNextDue =
    tenantCycleRange && !Number.isNaN(tenantCycleRange.end.getTime())
      ? Math.max(0, Math.ceil((tenantCycleRange.end.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
      : undefined;
  const tenantNextPaymentDueValue =
    tenantDaysToNextDue === undefined
      ? "-"
      : tenantDaysToNextDue === 0
        ? "Today"
        : `${tenantDaysToNextDue} day(s)`;
  const tenantRefundApproved = tenantRefundRequests.filter((item) => item.status === "approved").length;
  const tenantRefundInReview = tenantRefundRequests.filter(
    (item) => item.status === "submitted" || item.status === "in_review"
  ).length;
  const activeTenantGrade = activeTenant
    ? tenantGrades.find(
        (grade) => grade.propertyId === activeTenant.propertyId && grade.tenantId === activeTenant.id
      )
    : undefined;

  const activeTenantProofSettings = activeTenant
    ? state.propertyProofSettings.find((settings) => settings.propertyId === activeTenant.propertyId)
    : undefined;

  const rentProofRule = activeTenantProofSettings?.rentPaymentProof ?? "optional";
  const serviceProofRule = activeTenantProofSettings?.servicePaymentProof ?? "optional";
  const careProofRule = activeTenantProofSettings?.careProof ?? "optional";
  const tenantLandlord = activeTenant
    ? state.landlords.find((landlord) => landlord.id === activeTenant.landlordId)
    : undefined;
  const maskedLandlordEmail = tenantLandlord?.email
    ? tenantLandlord.email.replace(/(^.).+(@.+$)/, "$1***$2")
    : "N/A";
  const maskedLandlordPhone = tenantLandlord?.phone
    ? tenantLandlord.phone.replace(/\d(?=\d{2})/g, "*")
    : "N/A";
  const founderMetrics = useMemo(
    () =>
      getFounderDailySnapshot(
        {
          superAdmins: state.superAdmins,
          tenants: state.tenants,
          landlords: state.landlords,
          properties: state.properties,
          propertySubscriptions: state.propertySubscriptions,
          propertyProofSettings: state.propertyProofSettings,
          paymentSubmissions: state.paymentSubmissions,
          careProofSubmissions: state.careProofSubmissions,
          propertyExpenses: state.propertyExpenses,
          fixRequests: state.fixRequests,
          permissionRequests: state.permissionRequests,
          refundRequests: state.refundRequests,
          tickets: state.tickets,
          paymentPeriods: state.paymentPeriods,
          syncUsageByProperty: state.syncUsageByProperty
        },
        getOutboxQueue()
      ),
    [
      state.superAdmins,
      state.tenants,
      state.landlords,
      state.properties,
      state.propertySubscriptions,
      state.propertyProofSettings,
      state.paymentSubmissions,
      state.careProofSubmissions,
      state.propertyExpenses,
      state.fixRequests,
      state.permissionRequests,
      state.refundRequests,
      state.tickets,
      state.paymentPeriods,
      state.syncUsageByProperty
    ]
  );

  useEffect(() => {
    setActiveRole(role);
  }, [role, setActiveRole]);

  useEffect(() => {
    if (role !== "super_admin") return;
    setHasClientDraft(hasClientDraftInStorage());
  }, [role]);

  const uploadProofForTenant = async (
    proof: MediaUploadStub | undefined,
    category: string
  ): Promise<MediaUploadStub | undefined> => {
    if (!proof || !activeTenant) return undefined;
    if (!proof.localObjectUrl.startsWith("blob:")) return proof;
    try {
      const uploaded = await uploadMediaToApi({
        proof,
        landlordId: activeTenant.landlordId,
        propertyId: activeTenant.propertyId,
        category
      });
      return {
        ...proof,
        localObjectUrl: uploaded.secureUrl,
        keystoneFileId: uploaded.publicId
      };
    } catch (error) {
      setUploadNotice(
        error instanceof Error ? error.message : "Upload failed. Saved locally with placeholder."
      );
      return undefined;
    }
  };

  return (
    <Main
      eyebrow="COLONUS.lat"
      title="Dashboard"
      description="Property-based subscriptions, offline-safe writes, queued sync."
      headerClassName="mb-6"    >
      <MainMenu
        visible
        role={role}
        hasClientDraft={hasClientDraft}
        freeTrialUsage={
          role === "landlord" && activeLandlordSubscription?.tier === "free"
            ? { count: landlordSyncUsage?.count ?? 0, limit: 10 }
            : role === "tenant" && activeTenantSubscription?.tier === "free"
              ? { count: tenantSyncUsage?.count ?? 0, limit: 10 }
              : undefined
        }
        onSeedFake={async () => {
          await state.seedFakeData();
          const seededState = useColonusStore.getState();
          try {
            await logBackupSyncEvent({
              actorId: activeSuperAdminId,
              clientSessionId: "seed-fake-data",
              clientStorageVersion: "8",
              counts: {
                superAdmins: seededState.superAdmins.length,
                landlords: seededState.landlords.length,
                properties: seededState.properties.length,
                tenants: seededState.tenants.length
              }
            });
          } catch {
            // Ignore logging failure. Seeder remains local-first.
          }
        }}
        onClearDatabase={() => state.clearDatabase()}
      />

      {role === "tenant" && (
        <nav id="tenant-breadcrumb" aria-label="Breadcrumb" className="mb-4 text-xs text-slate-500">
          <p className="flex flex-wrap items-center gap-2">
            <Link href="/" className="hover:text-slate-700">
              Home
            </Link>
            <span>/</span>
            <span className="text-slate-700">Tenant</span>
          </p>
        </nav>
      )}
      {role === "landlord" && (
        <nav id="landlord-breadcrumb" aria-label="Breadcrumb" className="mb-4 text-xs text-slate-500">
          <p className="flex flex-wrap items-center gap-2">
            <Link href="/" className="hover:text-slate-700">
              Home
            </Link>
            <span>/</span>
            <span className="text-slate-700">Landlord</span>
          </p>
        </nav>
      )}

      {(role === "tenant" || role === "landlord") && state.lastSyncNotice && (
        <section className="mb-6 rounded-lg border border-slate-300 bg-slate-50 p-3">
          <p className="text-xs text-slate-700">{state.lastSyncNotice}</p>
        </section>
      )}
      {role === "tenant" && uploadNotice && (
        <section className="mb-6 rounded-lg border border-slate-300 bg-slate-50 p-3">
          <p className="text-xs text-slate-700">{uploadNotice}</p>
        </section>
      )}
      {isDevMode && devActionError && (
        <section className="mb-6 rounded-lg border border-slate-300 bg-slate-50 p-3">
          <p className="text-xs text-slate-700">{devActionError}</p>
        </section>
      )}

      <div className="mb-6 grid gap-4 md:grid-cols-4">
        {role === "landlord" ? (
          <>
            <Link href="/landlord/tenants" className="block">
              <Card title="Tenants" value={landlordTenants.length} />
            </Link>
            <Link href="/landlord/properties" className="block">
              <Card title="Properties" value={landlordProperties.length} />
            </Link>
            <Card title="Month Revenue" value={centsToCurrency(landlordMonthRevenueCents)} />
            <Card title="Overall Revenue" value={centsToCurrency(landlordRevenueCents)} />
          </>
        ) : role === "tenant" ? (
          <>
            <Card title="Total Debt Amount" value={centsToCurrency(tenantRentDue)} />
            <Card title="Next Payment Due In" value={tenantNextPaymentDueValue} />
            <Card title="Properties" value={tenantProperties.length} />
            <Card title="Queued Sync Jobs" value={state.getOutboxSize()} />
          </>
        ) : (
          <>
            <Card title="Landlords" value={state.landlords.length} />
            <Card title="Tenants" value={state.tenants.length} />
            <Card title="Properties" value={state.properties.length} />
            <Card title="Queued Sync Jobs" value={state.getOutboxSize()} />
          </>
        )}
      </div>

      {role === "super_admin" && (
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <Section title="Add Landlord">
              <form
                className="space-y-2"
                onSubmit={async (event) => {
                  event.preventDefault();
                  const formElement = event.currentTarget;
                  setIsAddingSuperLandlord(true);
                  const form = new FormData(formElement);
                  let created = false;
                  try {
                    await state.addLandlord({
                      fullName: String(form.get("fullName") ?? ""),
                      email: String(form.get("email") ?? ""),
                      phone: String(form.get("phone") ?? ""),
                      paymentSubmissionFrequency: Number(form.get("paymentSubmissionFrequency") ?? 1) as
                        | 1
                        | 3
                        | 6
                        | 12,
                      proofSubmissionFrequency: Number(form.get("proofSubmissionFrequency") ?? 1) as
                        | 1
                        | 3
                        | 6
                        | 12
                    });
                    setDevActionError(undefined);
                    created = true;
                  } catch (error) {
                    console.error("Failed to add landlord", error);
                    if (isDevMode) {
                      setDevActionError(
                        error instanceof Error
                          ? `Dev: add landlord failed - ${error.message}`
                          : "Dev: add landlord failed."
                      );
                    }
                  } finally {
                    setIsAddingSuperLandlord(false);
                  }
                  if (created) formElement.reset();
                }}
              >
                <Input name="fullName" required placeholder="Name" className="w-full rounded border border-slate-300 p-2" />
                <Input name="email" required type="email" placeholder="Email" className="w-full rounded border border-slate-300 p-2" />
                <Input name="phone" placeholder="Phone" className="w-full rounded border border-slate-300 p-2" />
                <Select name="paymentSubmissionFrequency" className="w-full rounded border border-slate-300 p-2">
                  <option value={1}>Payment: every 1 month</option>
                  <option value={3}>Payment: every 3 months</option>
                  <option value={6}>Payment: every 6 months</option>
                  <option value={12}>Payment: every 12 months</option>
                </Select>
                <Select name="proofSubmissionFrequency" className="w-full rounded border border-slate-300 p-2">
                  <option value={1}>Proof: every 1 month</option>
                  <option value={3}>Proof: every 3 months</option>
                  <option value={6}>Proof: every 6 months</option>
                  <option value={12}>Proof: every 12 months</option>
                </Select>
                <button
                  disabled={isAddingSuperLandlord}
                  className="rounded bg-slate-900 px-3 py-2 text-sm text-white disabled:opacity-60"
                >
                  {isAddingSuperLandlord ? "Adding..." : "Add"}
                </button>
              </form>
            </Section>

            <Section title="Add Property">
              <form
                className="space-y-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  const formElement = event.currentTarget;
                  const form = new FormData(formElement);
                  state.addProperty({
                    landlordId: String(form.get("landlordId") ?? ""),
                    name: String(form.get("name") ?? ""),
                    address: String(form.get("address") ?? ""),
                    unitCode: String(form.get("unitCode") ?? ""),
                    monthlyRentCents: Math.round(Number(form.get("monthlyRent") ?? 0) * 100)
                  });
                  formElement.reset();
                }}
              >
                <Select
                  name="landlordId"
                  required
                  value={superLandlordId}
                  onChange={(event) => setSuperLandlordId(event.target.value)}
                  className="w-full rounded border border-slate-300 p-2"
                >
                  <option value="">Select landlord</option>
                  {state.landlords.map((landlord) => (
                    <option key={landlord.id} value={landlord.id}>
                      {landlord.fullName}
                    </option>
                  ))}
                </Select>
                <Input name="name" required placeholder="Property name" className="w-full rounded border border-slate-300 p-2" />
                <Input name="address" required placeholder="Address" className="w-full rounded border border-slate-300 p-2" />
                <Input name="unitCode" placeholder="Unit" className="w-full rounded border border-slate-300 p-2" />
                <Input name="monthlyRent" required type="number" min="0" step="0.01" placeholder="Monthly rent" className="w-full rounded border border-slate-300 p-2" />
                <button className="rounded bg-slate-900 px-3 py-2 text-sm text-white">Add</button>
              </form>
            </Section>

            <Section title="Add Tenant">
              <form
                className="space-y-2"
                onSubmit={async (event) => {
                  event.preventDefault();
                  const formElement = event.currentTarget;
                  setIsAddingSuperTenant(true);
                  const form = new FormData(formElement);
                  let created = false;
                  try {
                    await state.addTenant({
                      fullName: String(form.get("fullName") ?? ""),
                      email: String(form.get("email") ?? ""),
                      phone: String(form.get("phone") ?? ""),
                      landlordId: String(form.get("landlordId") ?? ""),
                      propertyId: String(form.get("propertyId") ?? ""),
                      rentCycleMonths: Number(form.get("rentCycleMonths") ?? 1) as 1 | 3 | 6 | 12,
                      rentAmountCents: Math.round(Number(form.get("rentAmount") ?? 0) * 100)
                    });
                    setDevActionError(undefined);
                    created = true;
                  } catch (error) {
                    console.error("Failed to add tenant", error);
                    if (isDevMode) {
                      setDevActionError(
                        error instanceof Error
                          ? `Dev: add tenant failed - ${error.message}`
                          : "Dev: add tenant failed."
                      );
                    }
                  } finally {
                    setIsAddingSuperTenant(false);
                  }
                  if (created) formElement.reset();
                }}
              >
                <Input name="fullName" required placeholder="Name" className="w-full rounded border border-slate-300 p-2" />
                <Input name="email" required type="email" placeholder="Email" className="w-full rounded border border-slate-300 p-2" />
                <Input name="phone" placeholder="Phone" className="w-full rounded border border-slate-300 p-2" />
                <Select
                  name="landlordId"
                  required
                  value={tenantLandlordId}
                  onChange={(event) => setTenantLandlordId(event.target.value)}
                  className="w-full rounded border border-slate-300 p-2"
                >
                  <option value="">Landlord</option>
                  {state.landlords.map((landlord) => (
                    <option key={landlord.id} value={landlord.id}>
                      {landlord.fullName}
                    </option>
                  ))}
                </Select>
                <Select
                  name="propertyId"
                  required
                  value={tenantPropertyId}
                  onChange={(event) => setTenantPropertyId(event.target.value)}
                  className="w-full rounded border border-slate-300 p-2"
                >
                  <option value="">Property</option>
                  {state.properties.map((property) => (
                    <option key={property.id} value={property.id}>
                      {property.name}
                    </option>
                  ))}
                </Select>
                <Select name="rentCycleMonths" className="w-full rounded border border-slate-300 p-2">
                  <option value={1}>1 month cycle</option>
                  <option value={3}>3 month cycle</option>
                  <option value={6}>6 month cycle</option>
                  <option value={12}>12 month cycle</option>
                </Select>
                <Input name="rentAmount" required type="number" min="0" step="0.01" placeholder="Rent amount" className="w-full rounded border border-slate-300 p-2" />
                <button
                  disabled={isAddingSuperTenant}
                  className="rounded bg-slate-900 px-3 py-2 text-sm text-white disabled:opacity-60"
                >
                  {isAddingSuperTenant ? "Adding..." : "Add"}
                </button>
              </form>
            </Section>
          </div>

          <Section title="Property Subscriptions">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-wider text-slate-500">Properties</p>
                {state.properties.length === 0 && (
                  <EmptyState
                    title="No Properties Yet"
                    message="Add a property to assign subscriptions and proof rules."
                  />
                )}
                {state.properties.map((property) => {
                  const subscription =
                    state.propertySubscriptions.find((item) => item.propertyId === property.id) ?? {
                      tier: "free" as const,
                      subscriptionStatus: "trial" as const,
                      billingProviderId: undefined,
                      trialEndsAt: undefined
                    };
                  return (
                    <div key={property.id} className="rounded border border-slate-200 p-3">
                      <p className="text-sm font-medium text-slate-900">{property.name}</p>
                      <p className="text-xs text-slate-500">{property.address}</p>
                      <Select
                        className="mt-2 w-full rounded border border-slate-300 p-2 text-sm"
                        value={subscription.tier}
                        onChange={(event) =>
                          state.setPropertySubscriptionTier({
                            propertyId: property.id,
                            tier: event.target.value as "free" | "unlimited",
                            subscriptionStatus: subscription.subscriptionStatus,
                            billingProviderId: subscription.billingProviderId,
                            trialEndsAt: subscription.trialEndsAt
                          })
                        }
                      >
                        {planTierOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </Select>
                      <Select
                        className="mt-2 w-full rounded border border-slate-300 p-2 text-sm"
                        value={subscription.subscriptionStatus}
                        onChange={(event) =>
                          state.setPropertySubscriptionTier({
                            propertyId: property.id,
                            tier: subscription.tier,
                            subscriptionStatus: event.target.value as SubscriptionStatus,
                            billingProviderId: subscription.billingProviderId,
                            trialEndsAt: subscription.trialEndsAt
                          })
                        }
                      >
                        {subscriptionStatusOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </Select>
                    </div>
                  );
                })}
              </div>
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-wider text-slate-500">Rule</p>
                <p className="text-sm text-slate-600">
                  Tier is attached to property. Landlords and tenants inherit tier from current property context.
                </p>
              </div>
            </div>
          </Section>

          <Section title="SuperAdmin / Founder Dashboard - Phase 1 (MVP)">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
              <p>Executive summary for monetization, adoption, support load, and sync health.</p>
              <p className="mt-1">Snapshot: {new Date(founderMetrics.generatedAt).toLocaleString()}</p>
            </div>

            <div className="grid gap-3 md:grid-cols-4">
              {founderMetrics.sections
                .flatMap((section) => section.items)
                .filter((item) =>
                  [
                    "Monthly Recurring Revenue (MRR)",
                    "At-risk revenue",
                    "Failed sync rate",
                    "Open tickets"
                  ].includes(item.label)
                )
                .map((item) => (
                  <article
                    key={item.label}
                    className={`rounded-lg border p-3 ${
                      item.critical ? "border-slate-500 bg-slate-100" : "border-slate-200 bg-white"
                    }`}
                  >
                    <p className="text-[11px] uppercase tracking-wide text-slate-500">{item.label}</p>
                    <p className="mt-1 text-2xl font-semibold text-slate-900">{item.value}</p>
                  </article>
                ))}
            </div>

            {founderMetrics.criticalAlerts.length > 0 && (
              <div className="rounded-lg border border-slate-300 bg-white p-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-700">Critical States</p>
                <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-700">
                  {founderMetrics.criticalAlerts.map((alert) => (
                    <p key={alert} className="rounded-full border border-slate-400 bg-slate-100 px-2 py-1">
                      {alert}
                    </p>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-4">
              {founderMetrics.sections.map((section) => (
                <div key={section.title} className="space-y-2 rounded-lg border border-slate-200 bg-slate-50/60 p-3">
                  <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-700">
                    {section.title}
                  </h3>
                  <div className="grid gap-3 md:grid-cols-2">
                    {section.items.map((item) => (
                      <article
                        key={item.label}
                        className={`rounded-lg border p-3 ${
                          item.critical ? "border-slate-500 bg-slate-100" : "border-slate-200 bg-white"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-xs uppercase tracking-wide text-slate-500">{item.label}</p>
                          {item.critical && (
                            <span className="rounded-full border border-slate-500 px-2 py-0.5 text-[10px] font-medium uppercase text-slate-700">
                              Attention
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-xl font-semibold text-slate-900">{item.value}</p>
                        <p className="mt-2 text-[11px] text-slate-600">Calculation source: {item.source}</p>
                      </article>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Section>
        </div>
      )}

      {role === "landlord" && (
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <SurfaceCard id="landlord-management-add-property-card" title="Add Property" collapsible defaultCollapsed>
              <form
                className="space-y-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (!activeLandlordId) return;
                  const formElement = event.currentTarget;
                  const form = new FormData(formElement);
                  state.addProperty({
                    landlordId: activeLandlordId,
                    name: String(form.get("name") ?? ""),
                    address: String(form.get("address") ?? ""),
                    unitCode: String(form.get("unitCode") ?? ""),
                    monthlyRentCents: Math.round(Number(form.get("monthlyRent") ?? 0) * 100)
                  });
                  formElement.reset();
                }}
              >
                <Input name="name" required placeholder="Property name" />
                <Input name="address" required placeholder="Address" />
                <Input name="unitCode" placeholder="Unit" />
                <Input name="monthlyRent" required type="number" min="0" step="0.01" placeholder="Monthly rent" />
                <button className="rounded bg-slate-900 px-3 py-2 text-sm text-white">Add Property</button>
              </form>
            </SurfaceCard>

            <SurfaceCard id="landlord-management-add-tenant-card" title="Add Tenant" collapsible defaultCollapsed>
              <form
                className="space-y-2"
                onSubmit={async (event) => {
                  event.preventDefault();
                  if (!activeLandlordId) return;
                  const formElement = event.currentTarget;
                  setIsAddingLandlordTenant(true);
                  const form = new FormData(formElement);
                  let created = false;
                  try {
                    await state.addTenant({
                      fullName: String(form.get("fullName") ?? ""),
                      email: String(form.get("email") ?? ""),
                      phone: String(form.get("phone") ?? ""),
                      landlordId: activeLandlordId,
                      propertyId: String(form.get("propertyId") ?? ""),
                      rentCycleMonths: Number(form.get("rentCycleMonths") ?? 1) as 1 | 3 | 6 | 12,
                      rentAmountCents: Math.round(Number(form.get("rentAmount") ?? 0) * 100)
                    });
                    setDevActionError(undefined);
                    created = true;
                  } catch (error) {
                    console.error("Failed to add tenant", error);
                    if (isDevMode) {
                      setDevActionError(
                        error instanceof Error
                          ? `Dev: add tenant failed - ${error.message}`
                          : "Dev: add tenant failed."
                      );
                    }
                  } finally {
                    setIsAddingLandlordTenant(false);
                  }
                  if (created) {
                    formElement.reset();
                    setLandlordNewTenantPropertyId("");
                  }
                }}
              >
                <Input name="fullName" required placeholder="Tenant name" />
                <Input name="email" required type="email" placeholder="Tenant email" />
                <Input name="phone" placeholder="Phone" />
                <Select
                  name="propertyId"
                  required
                  value={landlordNewTenantPropertyId}
                  onChange={(event) => setLandlordNewTenantPropertyId(event.target.value)}
                >
                  <option value="">Assign property</option>
                  {landlordProperties.map((property) => (
                    <option key={property.id} value={property.id}>
                      {property.name}
                    </option>
                  ))}
                </Select>
                <Select name="rentCycleMonths">
                  <option value={1}>1 month cycle</option>
                  <option value={3}>3 month cycle</option>
                  <option value={6}>6 month cycle</option>
                  <option value={12}>12 month cycle</option>
                </Select>
                <Input name="rentAmount" required type="number" min="0" step="0.01" placeholder="Rent amount" />
                <button
                  disabled={isAddingLandlordTenant}
                  className="rounded bg-slate-900 px-3 py-2 text-sm text-white disabled:opacity-60"
                >
                  {isAddingLandlordTenant ? "Adding Tenant..." : "Add Tenant"}
                </button>
              </form>
            </SurfaceCard>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Section title="Approve Payments">
              <div className="space-y-2">
                {landlordPayments.length === 0 && (
                  <EmptyState
                    title="No Payment Submissions"
                    message="Tenant payment receipts will appear here once submitted."
                  />
                )}
                {landlordPayments.map((submission) => (
                  <div key={submission.id} className="rounded border border-slate-200 p-3 text-sm">
                    <AttachmentPreview
                      media={submission.proof}
                      alt="Payment proof thumbnail"
                      imageHeightClass="h-28"
                    />
                    <p>
                      {submission.kind} - {centsToCurrency(submission.amountCents)} - {submission.status}
                    </p>
                    {submission.status === "rejected" && submission.rejectionReason && (
                      <p className="mt-1 text-xs text-slate-600">Rejection reason: {submission.rejectionReason}</p>
                    )}
                    <button
                      disabled={submission.status === "approved"}
                      onClick={() => state.approvePayment(submission.id)}
                      className="mt-2 rounded border border-slate-800 px-3 py-1 text-xs disabled:opacity-40"
                    >
                      Approve
                    </button>
                    <div className="mt-2 space-y-2">
                      <Input
                        value={rejectReasonByPaymentId[submission.id] ?? ""}
                        onChange={(event) =>
                          setRejectReasonByPaymentId((current) => ({ ...current, [submission.id]: event.target.value }))
                        }
                        placeholder="Reason for rejection"
                        className="w-full rounded border border-slate-300 p-2 text-xs"
                      />
                      <button
                        type="button"
                        disabled={submission.status === "approved" || !(rejectReasonByPaymentId[submission.id] ?? "").trim()}
                        onClick={() => {
                          const reason = rejectReasonByPaymentId[submission.id] ?? "";
                          if (!reason.trim()) return;
                          state.rejectPayment({ paymentId: submission.id, reason });
                          setRejectReasonByPaymentId((current) => ({ ...current, [submission.id]: "" }));
                        }}
                        className="rounded border border-slate-800 px-3 py-1 text-xs disabled:opacity-40"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </Section>

            <Section title="Add Property Expense">
              <form
                className="space-y-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (!activeLandlordId) return;
                  const formElement = event.currentTarget;
                  const form = new FormData(formElement);
                  state.addPropertyExpense({
                    landlordId: activeLandlordId,
                    propertyId: String(form.get("propertyId") ?? ""),
                    title: String(form.get("title") ?? ""),
                    amountCents: Math.round(Number(form.get("amount") ?? 0) * 100),
                    incurredAt: String(form.get("incurredAt") ?? new Date().toISOString())
                  });
                  formElement.reset();
                }}
              >
                <Select
                  name="propertyId"
                  required
                  value={landlordPropertyId}
                  onChange={(event) => setLandlordPropertyId(event.target.value)}
                  className="w-full rounded border border-slate-300 p-2"
                >
                  <option value="">Property</option>
                  {landlordProperties.map((property) => (
                    <option key={property.id} value={property.id}>
                      {property.name}
                    </option>
                  ))}
                </Select>
                <Input name="title" required placeholder="Expense title" className="w-full rounded border border-slate-300 p-2" />
                <Input name="amount" required type="number" min="0" step="0.01" placeholder="Amount" className="w-full rounded border border-slate-300 p-2" />
                <Input name="incurredAt" type="date" className="w-full rounded border border-slate-300 p-2" />
                <button className="rounded bg-slate-900 px-3 py-2 text-sm text-white">Add Expense</button>
              </form>
            </Section>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <Section title="Review Condition Proofs">
              <div className="space-y-2">
                {landlordConditionProofs.length === 0 && (
                  <EmptyState
                    title="No Condition Proofs"
                    message="Property condition evidence will appear here when tenants upload it."
                  />
                )}
                {landlordConditionProofs.map((submission) => (
                  <div key={submission.id} className="rounded border border-slate-200 p-3 text-sm">
                    <AttachmentPreview
                      media={submission.proof}
                      alt="Condition proof thumbnail"
                      imageHeightClass="h-24"
                    />
                    <p className="text-slate-700">Category: {submission.category ?? "incident"}</p>
                    <p className="text-slate-700">Status: {submission.status}</p>
                    {submission.rejectionReason && (
                      <p className="text-xs text-slate-600">Reason: {submission.rejectionReason}</p>
                    )}
                    <button
                      type="button"
                      disabled={submission.status === "approved"}
                      onClick={() => state.approveConditionProof(submission.id)}
                      className="mt-2 rounded border border-slate-800 px-3 py-1 text-xs disabled:opacity-40"
                    >
                      Approve
                    </button>
                    <div className="mt-2 space-y-2">
                      <Input
                        value={rejectReasonByConditionProofId[submission.id] ?? ""}
                        onChange={(event) =>
                          setRejectReasonByConditionProofId((current) => ({
                            ...current,
                            [submission.id]: event.target.value
                          }))
                        }
                        placeholder="Reason for rejection"
                        className="w-full rounded border border-slate-300 p-2 text-xs"
                      />
                      <button
                        type="button"
                        disabled={!(rejectReasonByConditionProofId[submission.id] ?? "").trim()}
                        onClick={() => {
                          const reason = rejectReasonByConditionProofId[submission.id] ?? "";
                          if (!reason.trim()) return;
                          state.rejectConditionProof({ careProofId: submission.id, reason });
                          setRejectReasonByConditionProofId((current) => ({ ...current, [submission.id]: "" }));
                        }}
                        className="rounded border border-slate-800 px-3 py-1 text-xs disabled:opacity-40"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </Section>

            <Section title="Review Refund Requests">
              <div className="space-y-2">
                {landlordRefundRequests.length === 0 && (
                  <EmptyState
                    title="No Refund Requests"
                    message="Submitted refund requests will appear here for review."
                  />
                )}
                {landlordRefundRequests.map((request) => (
                  <div key={request.id} className="rounded border border-slate-200 p-3 text-sm">
                    <p className="font-medium text-slate-900">
                      {request.reasonCategory} - {request.amountRequestedCents ? centsToCurrency(request.amountRequestedCents) : "No amount"}
                    </p>
                    <p className="text-slate-600">Status: {request.status}</p>
                    <p className="text-xs text-slate-600">{request.explanation}</p>
                    {request.decisionNote && <p className="text-xs text-slate-600">Decision: {request.decisionNote}</p>}
                    <Input
                      value={refundDecisionById[request.id] ?? ""}
                      onChange={(event) =>
                        setRefundDecisionById((current) => ({ ...current, [request.id]: event.target.value }))
                      }
                      placeholder="Decision note"
                      className="mt-2 w-full rounded border border-slate-300 p-2 text-xs"
                    />
                    <div className="mt-2 flex flex-wrap gap-1">
                      {(["in_review", "approved", "rejected", "partially_approved"] as const).map((nextStatus) => (
                        <button
                          key={nextStatus}
                          type="button"
                          onClick={() =>
                            state.reviewRefundRequest({
                              refundRequestId: request.id,
                              status: nextStatus,
                              decisionNote: refundDecisionById[request.id] ?? ""
                            })
                          }
                          className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-700"
                        >
                          {nextStatus}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </Section>

            <Section title="Ticket Management">
              <div className="space-y-2">
                {landlordTickets.length === 0 && (
                  <EmptyState
                    title="No Tickets"
                    message="Tenant tickets will appear here once created."
                  />
                )}
                {landlordTickets.map((ticket) => (
                  <div key={ticket.id} className="rounded border border-slate-200 p-3 text-sm">
                    <p className="font-medium text-slate-900">
                      {ticket.title} ({ticket.category}/{ticket.priority})
                    </p>
                    <p className="text-slate-600">Status: {ticket.status}</p>
                    <p className="text-xs text-slate-600">{ticket.description}</p>
                    <Select
                      className="mt-2 w-full rounded border border-slate-300 p-2 text-xs"
                      value={ticket.status}
                      onChange={(event) =>
                        state.updateTicketStatus({
                          ticketId: ticket.id,
                          status: event.target.value as "open" | "in_progress" | "resolved" | "closed"
                        })
                      }
                    >
                      <option value="open">open</option>
                      <option value="in_progress">in_progress</option>
                      <option value="resolved">resolved</option>
                      <option value="closed">closed</option>
                    </Select>
                  </div>
                ))}
              </div>
            </Section>
          </div>

        </div>
      )}

      {role === "tenant" && (
        <div className="grid gap-4 md:grid-cols-2">
          <Section title="Property Info">
            <div className="space-y-2">
              {tenantProperties.length === 0 && (
                <EmptyState
                  title="No Rented Properties"
                  message="This tenant has no assigned property in the current dataset."
                />
              )}
              {tenantProperties.map((property) => (
                <div key={property.id} className="rounded border border-slate-200 p-3 text-sm">
                  <p className="font-medium text-slate-900">{property.name}</p>
                  <p className="text-slate-600">{property.address}</p>
                  <p className="text-slate-600">Unit: {property.unitCode || "-"}</p>
                  <div className="mt-1">
                    <GradeBadge score={activeTenantGrade?.score} />
                  </div>
                  <p className="text-slate-600">Rent: {centsToCurrency(property.monthlyRentCents)}</p>
                  <p className="text-slate-600">Rent cycle: every {activeTenantCycleMonths} month(s)</p>
                  <p className="text-slate-600">Landlord email: {maskedLandlordEmail}</p>
                  <p className="text-slate-600">Landlord phone: {maskedLandlordPhone}</p>
                  <p className="mt-2 text-xs text-slate-600">Rules: rent proof {proofRequirementLabel[rentProofRule]}, service proof {proofRequirementLabel[serviceProofRule]}, condition proof {proofRequirementLabel[careProofRule]}</p>
                </div>
              ))}
            </div>
          </Section>

          <Section title="My Balance / Ledger Summary">
            <div className="grid gap-2 text-sm md:grid-cols-2">
              <div className="rounded border border-slate-200 bg-slate-50 p-2 text-slate-700">
                Current rent due: {centsToCurrency(tenantRentDue)}
              </div>
              <div className="rounded border border-slate-200 bg-slate-50 p-2 text-slate-700">
                Current cycle paid: {centsToCurrency(tenantRentApprovedThisCycle)}
              </div>
              <div className="rounded border border-slate-200 bg-slate-50 p-2 text-slate-700">
                Deposits: Not tracked yet
              </div>
              <div className="rounded border border-slate-200 bg-slate-50 p-2 text-slate-700">
                Refunds: {tenantRefundApproved} approved / {tenantRefundInReview} in review
              </div>
            </div>
          </Section>

          <Section title="My Grade">
            <GradeCard
              grade={activeTenantGrade}
              emptyLabel="No grade is available for this property yet."
            />
          </Section>

          <Section title="Upload Rent Payment Receipt">
            <form
              className="space-y-2"
              onSubmit={async (event) => {
                event.preventDefault();
                if (!activeTenant) return;
                if (rentProofRule === "required" && !rentProof) return;
                const formEl = event.currentTarget;
                setIsSubmittingRentProof(true);
                setUploadNotice(undefined);
                try {
                  const uploadedProof =
                    rentProofRule !== "disabled"
                      ? await uploadProofForTenant(rentProof, "receipts")
                      : undefined;
                  if (rentProofRule !== "disabled" && rentProof && !uploadedProof) return;
                  const form = new FormData(formEl);
                  state.submitPayment({
                    tenantId: activeTenant.id,
                    propertyId: activeTenant.propertyId,
                    amountCents: Math.round(Number(form.get("amount") ?? 0) * 100),
                    kind: "rent",
                    paymentMethod: String(form.get("paymentMethod") ?? "other") as
                      | "bank_transfer"
                      | "cash"
                      | "card"
                      | "other",
                    datePaid: String(form.get("datePaid") ?? new Date().toISOString()),
                    note: String(form.get("note") ?? ""),
                    proof:
                      rentProofRule !== "disabled" && uploadedProof
                        ? toStoredProof(uploadedProof)
                        : createSimulatedProof("rent-proof-placeholder.jpg")
                  });
                  setRentProof(undefined);
                  formEl.reset();
                } finally {
                  setIsSubmittingRentProof(false);
                }
              }}
            >
              <Input name="amount" required type="number" min="0" step="0.01" placeholder="Amount" className="w-full rounded border border-slate-300 p-2" />
              <Input name="datePaid" required type="date" className="w-full rounded border border-slate-300 p-2" />
              <Select name="paymentMethod" className="w-full rounded border border-slate-300 p-2">
                <option value="bank_transfer">Bank transfer</option>
                <option value="card">Card</option>
                <option value="cash">Cash</option>
                <option value="other">Other</option>
              </Select>
              <Textarea name="note" placeholder="Optional note" className="w-full rounded border border-slate-300 p-2" />
              <p className="text-xs text-slate-600">Proof image: {proofRequirementLabel[rentProofRule]}</p>
              {rentProofRule !== "disabled" && <ImageDropInput label="Rent payment proof image" value={rentProof} onChange={setRentProof} />}
              {rentProofRule === "disabled" && <p className="text-xs text-slate-500">This property does not collect rent proof images.</p>}
              <button
                disabled={(rentProofRule === "required" && !rentProof) || isSubmittingRentProof}
                className="rounded bg-slate-900 px-3 py-2 text-sm text-white disabled:opacity-40"
              >
                {isSubmittingRentProof ? "Submitting..." : "Submit Receipt"}
              </button>
            </form>
          </Section>

          <Section title="Upload Service Payment Proof">
            <form
              className="space-y-2"
              onSubmit={async (event) => {
                event.preventDefault();
                if (!activeTenant) return;
                if (serviceProofRule === "required" && !serviceProof) return;
                const formEl = event.currentTarget;
                setIsSubmittingServiceProof(true);
                setUploadNotice(undefined);
                try {
                  const uploadedProof =
                    serviceProofRule !== "disabled"
                      ? await uploadProofForTenant(serviceProof, "service-payments")
                      : undefined;
                  if (serviceProofRule !== "disabled" && serviceProof && !uploadedProof) return;
                  const form = new FormData(formEl);
                  state.submitPayment({
                    tenantId: activeTenant.id,
                    propertyId: activeTenant.propertyId,
                    amountCents: Math.round(Number(form.get("amount") ?? 0) * 100),
                    kind: "service",
                    serviceType: String(form.get("serviceType") ?? "other") as
                      | "water"
                      | "light"
                      | "internet"
                      | "gas"
                      | "other",
                    servicePeriod: String(form.get("servicePeriod") ?? ""),
                    paymentMethod: String(form.get("paymentMethod") ?? "other") as
                      | "bank_transfer"
                      | "cash"
                      | "card"
                      | "other",
                    datePaid: String(form.get("datePaid") ?? new Date().toISOString()),
                    note: String(form.get("note") ?? ""),
                    proof:
                      serviceProofRule !== "disabled" && uploadedProof
                        ? toStoredProof(uploadedProof)
                        : createSimulatedProof("service-proof-placeholder.jpg")
                  });
                  setServiceProof(undefined);
                  formEl.reset();
                } finally {
                  setIsSubmittingServiceProof(false);
                }
              }}
            >
              <Input name="amount" required type="number" min="0" step="0.01" placeholder="Amount" className="w-full rounded border border-slate-300 p-2" />
              <Input name="servicePeriod" required type="month" className="w-full rounded border border-slate-300 p-2" />
              <Select name="serviceType" className="w-full rounded border border-slate-300 p-2">
                <option value="water">Water</option>
                <option value="light">Light</option>
                <option value="internet">Internet</option>
                <option value="gas">Gas</option>
                <option value="other">Other</option>
              </Select>
              <Input name="datePaid" required type="date" className="w-full rounded border border-slate-300 p-2" />
              <Select name="paymentMethod" className="w-full rounded border border-slate-300 p-2">
                <option value="bank_transfer">Bank transfer</option>
                <option value="card">Card</option>
                <option value="cash">Cash</option>
                <option value="other">Other</option>
              </Select>
              <Textarea name="note" placeholder="Optional note" className="w-full rounded border border-slate-300 p-2" />
              <p className="text-xs text-slate-600">Proof image: {proofRequirementLabel[serviceProofRule]}</p>
              {serviceProofRule !== "disabled" && <ImageDropInput label="Service payment proof image" value={serviceProof} onChange={setServiceProof} />}
              {serviceProofRule === "disabled" && <p className="text-xs text-slate-500">This property does not collect service payment proof images.</p>}
              <button
                disabled={(serviceProofRule === "required" && !serviceProof) || isSubmittingServiceProof}
                className="rounded bg-slate-900 px-3 py-2 text-sm text-white disabled:opacity-40"
              >
                {isSubmittingServiceProof ? "Submitting..." : "Submit Service Proof"}
              </button>
            </form>
          </Section>

          <Section title="Upload Condition Proof">
            <form
              className="space-y-2"
              onSubmit={async (event) => {
                event.preventDefault();
                if (!activeTenant) return;
                if (careProofRule === "required" && !careProof) return;
                const formEl = event.currentTarget;
                setIsSubmittingConditionProof(true);
                setUploadNotice(undefined);
                try {
                  const uploadedProof =
                    careProofRule !== "disabled"
                      ? await uploadProofForTenant(careProof, "care-proof")
                      : undefined;
                  if (careProofRule !== "disabled" && careProof && !uploadedProof) return;
                  const form = new FormData(formEl);
                  state.submitCareProof({
                    tenantId: activeTenant.id,
                    propertyId: activeTenant.propertyId,
                    category: String(form.get("category") ?? "incident") as
                      | "move_in"
                      | "move_out"
                      | "incident"
                      | "maintenance_before"
                      | "maintenance_after",
                    note: String(form.get("note") ?? ""),
                    attachments:
                      careProofRule !== "disabled" && uploadedProof
                        ? [toStoredProof(uploadedProof)]
                        : [createSimulatedProof("condition-proof-placeholder.jpg")],
                    proof:
                      careProofRule !== "disabled" && uploadedProof
                        ? toStoredProof(uploadedProof)
                        : createSimulatedProof("care-proof-placeholder.jpg")
                  });
                  setCareProof(undefined);
                  formEl.reset();
                } finally {
                  setIsSubmittingConditionProof(false);
                }
              }}
            >
              <Select name="category" className="w-full rounded border border-slate-300 p-2">
                <option value="move_in">Move in</option>
                <option value="move_out">Move out</option>
                <option value="incident">Incident evidence</option>
                <option value="maintenance_before">Maintenance before</option>
                <option value="maintenance_after">Maintenance after</option>
              </Select>
              <Textarea name="note" placeholder="Note" className="w-full rounded border border-slate-300 p-2" />
              <p className="text-xs text-slate-600">Proof image: {proofRequirementLabel[careProofRule]}</p>
              {careProofRule !== "disabled" && <ImageDropInput label="Property care proof image" value={careProof} onChange={setCareProof} />}
              {careProofRule === "disabled" && <p className="text-xs text-slate-500">This property does not collect care proof images.</p>}
              <button
                disabled={(careProofRule === "required" && !careProof) || isSubmittingConditionProof}
                className="rounded bg-slate-900 px-3 py-2 text-sm text-white disabled:opacity-40"
              >
                {isSubmittingConditionProof ? "Submitting..." : "Submit Condition Proof"}
              </button>
            </form>
          </Section>

          <Section title="Submit Refund Request">
            <form
              className="space-y-2"
              onSubmit={async (event) => {
                event.preventDefault();
                if (!activeTenant) return;
                const formEl = event.currentTarget;
                setIsSubmittingRefund(true);
                setUploadNotice(undefined);
                try {
                  const uploadedProof = await uploadProofForTenant(refundProof, "refund-requests");
                  if (refundProof && !uploadedProof) return;
                  const form = new FormData(formEl);
                  state.submitRefundRequest({
                    tenantId: activeTenant.id,
                    propertyId: activeTenant.propertyId,
                    reasonCategory: String(form.get("reasonCategory") ?? "other") as
                      | "deposit"
                      | "overpayment"
                      | "service"
                      | "other",
                    explanation: String(form.get("explanation") ?? ""),
                    amountRequestedCents: Math.round(Number(form.get("amountRequested") ?? 0) * 100),
                    attachments: uploadedProof ? [toStoredProof(uploadedProof)] : []
                  });
                  setRefundProof(undefined);
                  formEl.reset();
                } finally {
                  setIsSubmittingRefund(false);
                }
              }}
            >
              <Select name="reasonCategory" className="w-full rounded border border-slate-300 p-2">
                <option value="deposit">Deposit</option>
                <option value="overpayment">Overpayment</option>
                <option value="service">Service</option>
                <option value="other">Other</option>
              </Select>
              <Input name="amountRequested" type="number" min="0" step="0.01" placeholder="Amount requested (optional)" className="w-full rounded border border-slate-300 p-2" />
              <Textarea name="explanation" required placeholder="Why are you requesting refund?" className="w-full rounded border border-slate-300 p-2" />
              <ImageDropInput label="Refund attachment (optional)" value={refundProof} onChange={setRefundProof} />
              <button
                disabled={isSubmittingRefund}
                className="rounded bg-slate-900 px-3 py-2 text-sm text-white disabled:opacity-40"
              >
                {isSubmittingRefund ? "Submitting..." : "Submit Refund Request"}
              </button>
            </form>
          </Section>

          <Section title="Raise Ticket">
            <form
              className="space-y-2"
              onSubmit={async (event) => {
                event.preventDefault();
                if (!activeTenant) return;
                const formEl = event.currentTarget;
                setIsSubmittingTicket(true);
                setUploadNotice(undefined);
                try {
                  const uploadedProof = await uploadProofForTenant(ticketProof, "tickets");
                  if (ticketProof && !uploadedProof) return;
                  const form = new FormData(formEl);
                  state.createTicket({
                    propertyId: activeTenant.propertyId,
                    createdByTenantId: activeTenant.id,
                    category: String(form.get("category") ?? "other") as
                      | "maintenance"
                      | "billing"
                      | "rules"
                      | "other",
                    priority: String(form.get("priority") ?? "medium") as "low" | "medium" | "high",
                    title: String(form.get("title") ?? ""),
                    description: String(form.get("description") ?? ""),
                    attachments: uploadedProof ? [toStoredProof(uploadedProof)] : []
                  });
                  setTicketProof(undefined);
                  formEl.reset();
                } finally {
                  setIsSubmittingTicket(false);
                }
              }}
            >
              <Select name="category" className="w-full rounded border border-slate-300 p-2">
                <option value="maintenance">Maintenance</option>
                <option value="billing">Billing</option>
                <option value="rules">Rules</option>
                <option value="other">Other</option>
              </Select>
              <Select name="priority" className="w-full rounded border border-slate-300 p-2">
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </Select>
              <Input name="title" required placeholder="Title" className="w-full rounded border border-slate-300 p-2" />
              <Textarea name="description" required placeholder="Description" className="w-full rounded border border-slate-300 p-2" />
              <ImageDropInput label="Ticket attachment (optional)" value={ticketProof} onChange={setTicketProof} />
              <button
                disabled={isSubmittingTicket}
                className="rounded bg-slate-900 px-3 py-2 text-sm text-white disabled:opacity-40"
              >
                {isSubmittingTicket ? "Submitting..." : "Submit Ticket"}
              </button>
            </form>
          </Section>

          <Section title="My Documents">
            <div className="space-y-2 text-sm">
              {tenantPayments.length === 0 && tenantConditionProofs.length === 0 && tenantRefundRequests.length === 0 && tenantTickets.length === 0 && (
                <EmptyState
                  title="No Documents Yet"
                  message="Your payment receipts, proofs, refunds, and tickets will appear here."
                />
              )}
              {tenantPayments.map((payment) => (
                <div key={payment.id} className="rounded border border-slate-200 p-2">
                  <AttachmentPreview media={payment.proof} alt="Payment proof" imageHeightClass="h-20" />
                  <p className="font-medium text-slate-900">
                    {payment.kind} proof - {centsToCurrency(payment.amountCents)}
                  </p>
                  <p className="text-xs text-slate-600">Status: {payment.status}</p>
                  <p className="text-xs text-slate-600">Sync: {payment.syncStatus === "synced" ? "Synced" : "Pending upload"}</p>
                  {payment.status === "rejected" && payment.rejectionReason && <p className="text-xs text-slate-600">Reason: {payment.rejectionReason}</p>}
                </div>
              ))}
              {tenantConditionProofs.map((proof) => (
                <div key={proof.id} className="rounded border border-slate-200 p-2">
                  <AttachmentPreview media={proof.proof} alt="Condition proof" imageHeightClass="h-20" />
                  <p className="font-medium text-slate-900">Condition proof ({proof.category ?? "incident"})</p>
                  <p className="text-xs text-slate-600">Status: {proof.status}</p>
                  <p className="text-xs text-slate-600">Sync: {proof.syncStatus === "synced" ? "Synced" : "Pending upload"}</p>
                </div>
              ))}
              {tenantRefundRequests.map((refund) => (
                <div key={refund.id} className="rounded border border-slate-200 p-2">
                  {(refund.attachments ?? []).slice(0, 1).map((attachment, index) => (
                    <AttachmentPreview key={`${refund.id}-${index}`} media={attachment} alt="Refund attachment" imageHeightClass="h-20" />
                  ))}
                  <p className="font-medium text-slate-900">Refund request ({refund.reasonCategory})</p>
                  <p className="text-xs text-slate-600">Status: {refund.status}</p>
                  <p className="text-xs text-slate-600">Sync: {refund.syncStatus === "synced" ? "Synced" : "Pending upload"}</p>
                  {refund.decisionNote && <p className="text-xs text-slate-600">Decision: {refund.decisionNote}</p>}
                </div>
              ))}
            </div>
          </Section>

          <Section title="Tickets Feed (Current Property)">
            <div className="space-y-2 text-sm">
              {tenantTickets.length === 0 && (
                <EmptyState
                  title="No Property Tickets"
                  message="Tickets created for this property will be listed here."
                />
              )}
              {tenantTickets.map((ticket) => (
                <div key={ticket.id} className="rounded border border-slate-200 p-2">
                  {(ticket.attachments ?? []).slice(0, 1).map((attachment, index) => (
                    <AttachmentPreview key={`${ticket.id}-${index}`} media={attachment} alt="Ticket attachment" imageHeightClass="h-20" />
                  ))}
                  <p className="font-medium text-slate-900">
                    {ticket.title} ({ticket.category}/{ticket.priority})
                  </p>
                  <p className="text-xs text-slate-600">Status: {ticket.status}</p>
                  <p className="text-xs text-slate-600">Sync: {ticket.syncStatus === "synced" ? "Synced" : "Pending upload"}</p>
                </div>
              ))}
            </div>
          </Section>

          <Section title="Permission Request">
            <form
              className="space-y-2"
              onSubmit={(event) => {
                event.preventDefault();
                if (!activeTenant) return;
                const formElement = event.currentTarget;
                const form = new FormData(formElement);
                state.submitPermissionRequest({
                  tenantId: activeTenant.id,
                  propertyId: activeTenant.propertyId,
                  question: String(form.get("permissionQuestion") ?? "")
                });
                formElement.reset();
              }}
            >
              <Textarea
                name="permissionQuestion"
                required
                placeholder="Permission request (e.g. can I remove this wall?)"
                className="w-full rounded border border-slate-300 p-2"
              />
              <button className="rounded bg-slate-900 px-3 py-2 text-sm text-white">Submit Permission Request</button>
            </form>
          </Section>
        </div>
      )}
    </Main>
  );
}
