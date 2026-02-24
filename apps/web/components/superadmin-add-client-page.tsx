"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { MainMenu } from "@/components/main-menu";
import { SuperAdminRouteGuard } from "@/components/super-admin-route-guard";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Main } from "@/components/ui/main";
import { Select } from "@/components/ui/select";
import { useClient } from "@/lib/use-client";

interface LandlordDraft {
  fullName: string;
  email: string;
  phone: string;
  paymentSubmissionFrequency: 1 | 3 | 6 | 12;
  proofSubmissionFrequency: 1 | 3 | 6 | 12;
}

interface PropertyDraft {
  name: string;
  address: string;
  unitCode: string;
  monthlyRent: string;
}

interface TenantDraft {
  fullName: string;
  email: string;
  phone: string;
  propertyTempId: string;
  rentCycleMonths: 1 | 3 | 6 | 12;
  rentAmount: string;
}

const steps: Array<{ id: string; title: string; optional: boolean }> = [
  { id: "landlord", title: "Landlord", optional: false },
  { id: "properties", title: "Properties", optional: true },
  { id: "tenants", title: "Tenants", optional: true },
  { id: "credentials", title: "Credentials", optional: true }
];

export function SuperAdminAddClientPage() {
  const isDevMode = process.env.NODE_ENV === "development";
  const router = useRouter();
  const {
    temporalLandlord,
    temporalProperties,
    temporalTennats,
    hasDraft,
    createTemporalLandlord,
    createTemporalProperty,
    createTemporalTennat,
    removeTemporalProperty,
    removeTemporalTennat,
    resetTemporalClient,
    createClient
  } = useClient();

  const [step, setStep] = useState(0);
  const [sendCredentials, setSendCredentials] = useState(true);
  const [createdSummary, setCreatedSummary] = useState<{ landlordId: string; propertyCount: number; tenantCount: number }>();
  const [showDraftDecision, setShowDraftDecision] = useState(true);
  const [devActionError, setDevActionError] = useState<string>();
  const [isCreatingClient, setIsCreatingClient] = useState(false);

  const [landlordDraft, setLandlordDraft] = useState<LandlordDraft>({
    fullName: temporalLandlord?.fullName ?? "",
    email: temporalLandlord?.email ?? "",
    phone: temporalLandlord?.phone ?? "",
    paymentSubmissionFrequency: temporalLandlord?.paymentSubmissionFrequency ?? 1,
    proofSubmissionFrequency: temporalLandlord?.proofSubmissionFrequency ?? 1
  });
  const [propertyDraft, setPropertyDraft] = useState<PropertyDraft>({
    name: "",
    address: "",
    unitCode: "",
    monthlyRent: ""
  });
  const [tenantDraft, setTenantDraft] = useState<TenantDraft>({
    fullName: "",
    email: "",
    phone: "",
    propertyTempId: "",
    rentCycleMonths: 1 as const,
    rentAmount: ""
  });

  const currentStep = steps[step];
  const allNextOptional = steps.slice(step + 1).every((item) => item.optional);

  useEffect(() => {
    if (!hasDraft) setShowDraftDecision(false);
  }, [hasDraft]);

  const canContinue = useMemo(() => {
    if (currentStep.id === "landlord") {
      return Boolean(landlordDraft.fullName.trim() && landlordDraft.email.trim());
    }
    return true;
  }, [currentStep.id, landlordDraft.fullName, landlordDraft.email]);

  const completeCreate = async () => {
    if (!temporalLandlord) return;
    setIsCreatingClient(true);
    try {
      const created = await createClient({ sendCredentials });
      setCreatedSummary({
        landlordId: created.landlordId,
        propertyCount: created.propertyIds.length,
        tenantCount: created.tenantIds.length
      });
      setLandlordDraft({
        fullName: "",
        email: "",
        phone: "",
        paymentSubmissionFrequency: 1,
        proofSubmissionFrequency: 1
      });
      setPropertyDraft({ name: "", address: "", unitCode: "", monthlyRent: "" });
      setTenantDraft({
        fullName: "",
        email: "",
        phone: "",
        propertyTempId: "",
        rentCycleMonths: 1,
        rentAmount: ""
      });
      setDevActionError(undefined);
      router.push(`/superadmin/clients/${created.landlordId}`);
    } catch (error) {
      if (isDevMode) {
        setDevActionError(
          error instanceof Error ? `Dev: create client failed - ${error.message}` : "Dev: create client failed."
        );
      }
    } finally {
      setIsCreatingClient(false);
    }
  };

  if (showDraftDecision && hasDraft) {
    return (
      <SuperAdminRouteGuard title="Add Client">
        <Main
          eyebrow="Super Admin"
          title="Add Client Wizard"
          description="There is an unfinished draft. Continue where you left off or start over."
          maxWidthClassName="max-w-3xl"
          className="flex items-center"        >
          <MainMenu visible role="super_admin" />
          <section id="superadmin-add-client-draft-decision-card" className="w-full rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Super Admin</p>
            <h1 className="mt-2 text-3xl font-semibold text-slate-900">Unfinished Client Draft</h1>
            <p className="mt-2 text-sm text-slate-600">
              There is an unfinished draft. Continue where you left off or start over.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setShowDraftDecision(false)}
                className="rounded bg-slate-900 px-4 py-2 text-sm text-white"
              >
                Continue Draft
              </button>
              <button
                type="button"
                onClick={() => {
                  resetTemporalClient();
                  setStep(0);
                  setCreatedSummary(undefined);
                  setLandlordDraft({
                    fullName: "",
                    email: "",
                    phone: "",
                    paymentSubmissionFrequency: 1,
                    proofSubmissionFrequency: 1
                  });
                  setPropertyDraft({ name: "", address: "", unitCode: "", monthlyRent: "" });
                  setTenantDraft({
                    fullName: "",
                    email: "",
                    phone: "",
                    propertyTempId: "",
                    rentCycleMonths: 1,
                    rentAmount: ""
                  });
                  setShowDraftDecision(false);
                }}
                className="rounded border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:border-slate-500"
              >
                Start Over
              </button>
            </div>
          </section>
        </Main>
      </SuperAdminRouteGuard>
    );
  }

  return (
    <SuperAdminRouteGuard title="Add Client">
      <Main
        eyebrow="Super Admin"
        title="Add Client Wizard"
        description="Create a full client draft first. Data is saved only when you click complete."
        maxWidthClassName="max-w-5xl"      >
        <MainMenu visible role="super_admin" />

        <div className="mt-4 flex flex-wrap gap-2">
          <Link href="/superadmin" className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:border-slate-500">
            Back To Dashboard
          </Link>
          <Link href="/superadmin/clients" className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:border-slate-500">
            Open Client List
          </Link>
        </div>

        <section id="superadmin-add-client-stepper-card" className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="grid gap-2 md:grid-cols-4">
            {steps.map((item, index) => (
              <div
                key={item.id}
                className={`rounded border px-3 py-2 text-xs ${
                  index === step ? "border-slate-700 bg-slate-50 text-slate-900" : "border-slate-200 text-slate-600"
                }`}
              >
                {index + 1}. {item.title} {item.optional ? "(Optional)" : ""}
              </div>
            ))}
          </div>
        </section>

        <section id="superadmin-add-client-wizard-card" className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          {isDevMode && devActionError && (
            <div className="mb-3 rounded border border-slate-300 bg-slate-50 p-2">
              <p className="text-xs text-slate-700">{devActionError}</p>
            </div>
          )}
          {currentStep.id === "landlord" && (
            <div>
              <p className="text-xs uppercase tracking-wider text-slate-500">Step 1</p>
              <h2 className="mt-1 text-lg font-semibold text-slate-900">Landlord Details</h2>
              <div className="mt-3 grid gap-2 md:grid-cols-2">
                <Input
                  value={landlordDraft.fullName}
                  onChange={(event) => setLandlordDraft((current) => ({ ...current, fullName: event.target.value }))}
                  placeholder="Landlord full name"
                  className="rounded border border-slate-300 p-2"
                />
                <Input
                  value={landlordDraft.email}
                  type="email"
                  onChange={(event) => setLandlordDraft((current) => ({ ...current, email: event.target.value }))}
                  placeholder="Landlord email"
                  className="rounded border border-slate-300 p-2"
                />
                <Input
                  value={landlordDraft.phone}
                  onChange={(event) => setLandlordDraft((current) => ({ ...current, phone: event.target.value }))}
                  placeholder="Phone"
                  className="rounded border border-slate-300 p-2"
                />
                <Select
                  value={landlordDraft.paymentSubmissionFrequency}
                  onChange={(event) =>
                    setLandlordDraft((current) => ({
                      ...current,
                      paymentSubmissionFrequency: Number(event.target.value) as 1 | 3 | 6 | 12
                    }))
                  }
                  className="rounded border border-slate-300 p-2"
                >
                  <option value={1}>Payment every 1 month</option>
                  <option value={3}>Payment every 3 months</option>
                  <option value={6}>Payment every 6 months</option>
                  <option value={12}>Payment every 12 months</option>
                </Select>
                <Select
                  value={landlordDraft.proofSubmissionFrequency}
                  onChange={(event) =>
                    setLandlordDraft((current) => ({
                      ...current,
                      proofSubmissionFrequency: Number(event.target.value) as 1 | 3 | 6 | 12
                    }))
                  }
                  className="rounded border border-slate-300 p-2"
                >
                  <option value={1}>Proof every 1 month</option>
                  <option value={3}>Proof every 3 months</option>
                  <option value={6}>Proof every 6 months</option>
                  <option value={12}>Proof every 12 months</option>
                </Select>
              </div>
              <p className="mt-3 text-xs text-slate-600">
                Click Next to save this landlord draft and continue.
              </p>
            </div>
          )}

          {currentStep.id === "properties" && (
            <div>
              <p className="text-xs uppercase tracking-wider text-slate-500">Step 2 (Optional)</p>
              <h2 className="mt-1 text-lg font-semibold text-slate-900">Add Properties</h2>
              <div className="mt-3 grid gap-2 md:grid-cols-2">
                <Input
                  value={propertyDraft.name}
                  onChange={(event) => setPropertyDraft((current) => ({ ...current, name: event.target.value }))}
                  placeholder="Property name"
                  className="rounded border border-slate-300 p-2"
                />
                <Input
                  value={propertyDraft.address}
                  onChange={(event) => setPropertyDraft((current) => ({ ...current, address: event.target.value }))}
                  placeholder="Address"
                  className="rounded border border-slate-300 p-2"
                />
                <Input
                  value={propertyDraft.unitCode}
                  onChange={(event) => setPropertyDraft((current) => ({ ...current, unitCode: event.target.value }))}
                  placeholder="Unit code"
                  className="rounded border border-slate-300 p-2"
                />
                <Input
                  value={propertyDraft.monthlyRent}
                  onChange={(event) => setPropertyDraft((current) => ({ ...current, monthlyRent: event.target.value }))}
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Monthly rent"
                  className="rounded border border-slate-300 p-2"
                />
              </div>
              <button
                type="button"
                onClick={() => {
                  if (!propertyDraft.name.trim() || !propertyDraft.address.trim()) return;
                  createTemporalProperty({
                    name: propertyDraft.name.trim(),
                    address: propertyDraft.address.trim(),
                    unitCode: propertyDraft.unitCode.trim(),
                    monthlyRentCents: Math.round(Number(propertyDraft.monthlyRent || 0) * 100)
                  });
                  setPropertyDraft({ name: "", address: "", unitCode: "", monthlyRent: "" });
                }}
                className="mt-3 rounded bg-slate-900 px-3 py-2 text-sm text-white"
              >
                Add Property Draft
              </button>

              <div className="mt-3 space-y-2 text-sm">
                {temporalProperties.length === 0 && (
                  <EmptyState
                    title="No Property Drafts"
                    message="Add a property draft or skip this optional step."
                  />
                )}
                {temporalProperties.map((property) => (
                  <div key={property.tempId} className="flex items-center justify-between rounded border border-slate-200 p-2">
                    <p>{property.name} · {property.address}</p>
                    <button
                      type="button"
                      onClick={() => removeTemporalProperty(property.tempId)}
                      className="rounded border border-slate-300 px-2 py-1 text-xs"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {currentStep.id === "tenants" && (
            <div>
              <p className="text-xs uppercase tracking-wider text-slate-500">Step 3 (Optional)</p>
              <h2 className="mt-1 text-lg font-semibold text-slate-900">Add Tenants</h2>
              {temporalProperties.length === 0 && (
                <p className="mt-3 text-sm text-slate-600">Add at least one property draft before creating tenant drafts.</p>
              )}
              {temporalProperties.length > 0 && (
                <>
                  <div className="mt-3 grid gap-2 md:grid-cols-2">
                    <Input
                      value={tenantDraft.fullName}
                      onChange={(event) => setTenantDraft((current) => ({ ...current, fullName: event.target.value }))}
                      placeholder="Tenant full name"
                      className="rounded border border-slate-300 p-2"
                    />
                    <Input
                      value={tenantDraft.email}
                      type="email"
                      onChange={(event) => setTenantDraft((current) => ({ ...current, email: event.target.value }))}
                      placeholder="Tenant email"
                      className="rounded border border-slate-300 p-2"
                    />
                    <Input
                      value={tenantDraft.phone}
                      onChange={(event) => setTenantDraft((current) => ({ ...current, phone: event.target.value }))}
                      placeholder="Phone"
                      className="rounded border border-slate-300 p-2"
                    />
                    <Select
                      value={tenantDraft.propertyTempId}
                      onChange={(event) =>
                        setTenantDraft((current) => ({ ...current, propertyTempId: event.target.value }))
                      }
                      className="rounded border border-slate-300 p-2"
                    >
                      <option value="">Select property</option>
                      {temporalProperties.map((property) => (
                        <option key={property.tempId} value={property.tempId}>{property.name}</option>
                      ))}
                    </Select>
                    <Select
                      value={tenantDraft.rentCycleMonths}
                      onChange={(event) =>
                        setTenantDraft((current) => ({
                          ...current,
                          rentCycleMonths: Number(event.target.value) as 1 | 3 | 6 | 12
                        }))
                      }
                      className="rounded border border-slate-300 p-2"
                    >
                      <option value={1}>1 month cycle</option>
                      <option value={3}>3 month cycle</option>
                      <option value={6}>6 month cycle</option>
                      <option value={12}>12 month cycle</option>
                    </Select>
                    <Input
                      value={tenantDraft.rentAmount}
                      onChange={(event) => setTenantDraft((current) => ({ ...current, rentAmount: event.target.value }))}
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="Rent amount"
                      className="rounded border border-slate-300 p-2"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (!tenantDraft.fullName.trim() || !tenantDraft.email.trim() || !tenantDraft.propertyTempId) {
                        return;
                      }
                      createTemporalTennat({
                        fullName: tenantDraft.fullName.trim(),
                        email: tenantDraft.email.trim(),
                        phone: tenantDraft.phone.trim(),
                        propertyTempId: tenantDraft.propertyTempId,
                        rentCycleMonths: tenantDraft.rentCycleMonths,
                        rentAmountCents: Math.round(Number(tenantDraft.rentAmount || 0) * 100)
                      });
                      setTenantDraft({
                        fullName: "",
                        email: "",
                        phone: "",
                        propertyTempId: "",
                        rentCycleMonths: 1,
                        rentAmount: ""
                      });
                    }}
                    className="mt-3 rounded bg-slate-900 px-3 py-2 text-sm text-white"
                  >
                    Add Tenant Draft
                  </button>
                </>
              )}

              <div className="mt-3 space-y-2 text-sm">
                {temporalTennats.length === 0 && (
                  <EmptyState
                    title="No Tenant Drafts"
                    message="Add tenant drafts now or continue without tenants."
                  />
                )}
                {temporalTennats.map((tennat) => (
                  <div key={tennat.tempId} className="flex items-center justify-between rounded border border-slate-200 p-2">
                    <p>{tennat.fullName} · {tennat.email}</p>
                    <button
                      type="button"
                      onClick={() => removeTemporalTennat(tennat.tempId)}
                      className="rounded border border-slate-300 px-2 py-1 text-xs"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {currentStep.id === "credentials" && (
            <div>
              <p className="text-xs uppercase tracking-wider text-slate-500">Step 4 (Optional)</p>
              <h2 className="mt-1 text-lg font-semibold text-slate-900">Credentials Delivery</h2>
              <label className="mt-3 flex items-center gap-2 text-sm text-slate-700">
                <Input
                  type="checkbox"
                  checked={sendCredentials}
                  onChange={(event) => setSendCredentials(event.target.checked)}
                />
                Send credentials email when creating client
              </label>
              <div className="mt-3 rounded border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
                <p>Draft summary:</p>
                <p>Landlord: {temporalLandlord ? temporalLandlord.fullName : "Missing"}</p>
                <p>Properties: {temporalProperties.length}</p>
                <p>Tennats: {temporalTennats.length}</p>
              </div>
            </div>
          )}

          <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-slate-200 pt-4">
            <button
              type="button"
              disabled={step === 0}
              onClick={() => setStep((current) => Math.max(0, current - 1))}
              className="rounded border border-slate-300 px-3 py-2 text-sm text-slate-700 disabled:opacity-40"
            >
              Back
            </button>

            {currentStep.optional && step < steps.length - 1 && (
              <button
                type="button"
                onClick={() => setStep((current) => Math.min(steps.length - 1, current + 1))}
                className="rounded border border-slate-300 px-3 py-2 text-sm text-slate-700"
              >
                Skip
              </button>
            )}

            {currentStep.optional && allNextOptional && temporalLandlord && (
              <button
                type="button"
                disabled={isCreatingClient}
                onClick={() => {
                  if (!isCreatingClient) void completeCreate();
                }}
                className="rounded border border-slate-800 px-3 py-2 text-sm text-slate-900 disabled:opacity-40"
              >
                {isCreatingClient ? "Creating..." : "Skip And Create"}
              </button>
            )}

            {step < steps.length - 1 && (
              <button
                type="button"
                disabled={!canContinue}
                onClick={() => {
                  if (currentStep.id === "landlord") {
                    createTemporalLandlord({
                      fullName: landlordDraft.fullName.trim(),
                      email: landlordDraft.email.trim(),
                      phone: landlordDraft.phone.trim(),
                      paymentSubmissionFrequency: landlordDraft.paymentSubmissionFrequency,
                      proofSubmissionFrequency: landlordDraft.proofSubmissionFrequency
                    });
                  }
                  setStep((current) => Math.min(steps.length - 1, current + 1));
                }}
                className="rounded bg-slate-900 px-3 py-2 text-sm text-white disabled:opacity-40"
              >
                Next
              </button>
            )}

            {step === steps.length - 1 && (
              <button
                type="button"
                disabled={!temporalLandlord || isCreatingClient}
                onClick={() => {
                  if (!isCreatingClient) void completeCreate();
                }}
                className="rounded bg-slate-900 px-3 py-2 text-sm text-white disabled:opacity-40"
              >
                {isCreatingClient ? "Creating..." : "Complete"}
              </button>
            )}
          </div>
        </section>

        {createdSummary && (
          <section id="superadmin-add-client-created-card" className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Client Created</h2>
            <p className="mt-2 text-sm text-slate-700">Landlord ID: {createdSummary.landlordId}</p>
            <p className="text-sm text-slate-700">Properties created: {createdSummary.propertyCount}</p>
            <p className="text-sm text-slate-700">Tennats created: {createdSummary.tenantCount}</p>
          </section>
        )}
      </Main>
    </SuperAdminRouteGuard>
  );
}
