"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { MainMenu } from "@/components/main-menu";
import { InfoCard } from "@/components/ui/info-card";
import { Input } from "@/components/ui/input";
import { Main } from "@/components/ui/main";
import { Select } from "@/components/ui/select";
import { centsToCurrency } from "@/lib/format";
import { useColonusStore } from "@/lib/store";

const nextDueDate = (startDate: string, dueDay: number, cycleMonths: 1 | 3 | 6 | 12): Date => {
  const safeDueDay = Math.min(Math.max(dueDay, 1), 28);
  const start = new Date(startDate);
  if (Number.isNaN(start.getTime())) return new Date();
  const now = new Date();

  const candidate = new Date(start);
  candidate.setDate(safeDueDay);
  if (candidate < start) {
    candidate.setMonth(candidate.getMonth() + cycleMonths, safeDueDay);
  }
  while (candidate <= now) {
    candidate.setMonth(candidate.getMonth() + cycleMonths, safeDueDay);
  }
  return candidate;
};

const cycleEndDate = (startDate: string, cycleMonths: 1 | 3 | 6 | 12): Date => {
  const start = new Date(startDate);
  const end = new Date(start);
  end.setMonth(end.getMonth() + cycleMonths, 0);
  end.setHours(23, 59, 59, 999);
  return end;
};

export function LandlordFirstTimeOnboarding() {
  const isDevMode = process.env.NODE_ENV === "development";
  const state = useColonusStore();
  const authSession = useColonusStore((store) => store.authSession);
  const setActiveLandlordId = useColonusStore((store) => store.setActiveLandlordId);
  const activeLandlordId = state.activeLandlordId ?? state.landlords[0]?.id;
  const activeLandlord = state.landlords.find((item) => item.id === activeLandlordId);
  const landlordProperties = state.properties.filter((item) => item.landlordId === activeLandlordId);

  const [step, setStep] = useState(landlordProperties.length > 0 ? 2 : 1);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>(landlordProperties[0]?.id ?? "");

  const [propertyName, setPropertyName] = useState("");
  const [propertyAddress, setPropertyAddress] = useState("");
  const [propertyTier, setPropertyTier] = useState<"free" | "unlimited">("free");

  const [rentAmount, setRentAmount] = useState("");
  const [cycleMonths, setCycleMonths] = useState<1 | 3 | 6 | 12>(1);
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [dueDay, setDueDay] = useState(1);
  const [tenantFullName, setTenantFullName] = useState("");
  const [tenantEmail, setTenantEmail] = useState("");
  const [tenantPhone, setTenantPhone] = useState("");
  const [devActionError, setDevActionError] = useState<string>();
  const [isAddingTenant, setIsAddingTenant] = useState(false);

  const selectedProperty =
    landlordProperties.find((item) => item.id === selectedPropertyId) ?? landlordProperties[0];
  const selectedPropertySubscription = selectedProperty
    ? state.propertySubscriptions.find((item) => item.propertyId === selectedProperty.id)
    : undefined;
  const selectedPropertyTenants = selectedProperty
    ? state.tenants.filter((item) => item.propertyId === selectedProperty.id)
    : [];
  const existingPeriod = selectedProperty
    ? state.paymentPeriods
        .filter((item) => item.landlordId === (activeLandlordId ?? "") && item.propertyId === selectedProperty.id)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]
    : undefined;

  useEffect(() => {
    if (!selectedProperty && landlordProperties.length > 0) {
      setSelectedPropertyId(landlordProperties[0].id);
    }
  }, [landlordProperties, selectedProperty]);

  useEffect(() => {
    if (!selectedProperty) return;
    setRentAmount((selectedProperty.monthlyRentCents / 100).toFixed(2));
    setCycleMonths((existingPeriod?.durationMonths ?? 1) as 1 | 3 | 6 | 12);
    setStartDate((existingPeriod?.startDate ?? new Date().toISOString()).slice(0, 10));
    setDueDay(existingPeriod?.dueDay ?? 1);
  }, [selectedProperty?.id, selectedProperty?.monthlyRentCents, existingPeriod?.id, existingPeriod?.durationMonths, existingPeriod?.startDate, existingPeriod?.dueDay]);

  const summary = useMemo(() => {
    if (!selectedProperty) return undefined;
    const amountCents = Math.round(Number(rentAmount || 0) * 100);
    const tier = selectedPropertySubscription?.tier ?? propertyTier;
    const preview = nextDueDate(startDate, dueDay, cycleMonths);
    return {
      propertyName: selectedProperty.name,
      tier,
      amountCents,
      cycleMonths,
      startDate,
      dueDay,
      tenantCount: selectedPropertyTenants.length,
      nextDueDate: preview
    };
  }, [
    selectedProperty,
    selectedPropertySubscription?.tier,
    propertyTier,
    rentAmount,
    cycleMonths,
    startDate,
    dueDay,
    selectedPropertyTenants.length
  ]);

  const hasValidTenantDraft = tenantFullName.trim().length > 0 && (tenantEmail.trim().length > 0 || tenantPhone.trim().length > 0);

  const createTenantFromDraft = async (): Promise<boolean> => {
    if (!selectedProperty) return false;
    const fullName = tenantFullName.trim();
    const email = tenantEmail.trim();
    const phone = tenantPhone.trim();
    if (!fullName || (!email && !phone)) return false;
    try {
      setIsAddingTenant(true);
      await state.addTenant({
        fullName,
        email: email || `${fullName.toLowerCase().replace(/\s+/g, ".")}@placeholder.local`,
        phone,
        landlordId: activeLandlordId,
        propertyId: selectedProperty.id,
        rentCycleMonths: cycleMonths,
        rentAmountCents: Math.round(Number(rentAmount || 0) * 100)
      });
      setDevActionError(undefined);
    } catch (error) {
      console.error("Failed to add tenant", error);
      if (isDevMode) {
        setDevActionError(
          error instanceof Error ? `Dev: add tenant failed - ${error.message}` : "Dev: add tenant failed."
        );
      }
      return false;
    } finally {
      setIsAddingTenant(false);
    }
    setTenantFullName("");
    setTenantEmail("");
    setTenantPhone("");
    return true;
  };

  const hasPropertyCreated = landlordProperties.length > 0;
  const hasRentConfigured = Boolean(existingPeriod && selectedProperty && selectedProperty.monthlyRentCents > 0);
  const hasTenants = selectedPropertyTenants.length > 0;

  if (!activeLandlordId || !activeLandlord) {
    return (
      <Main
        eyebrow="Landlord Onboarding"
        title="Let's set up your first property"
        description="Select a landlord before starting onboarding."
        maxWidthClassName="max-w-3xl"      >
        <MainMenu visible role="landlord" />
        <InfoCard
          badge={<span className="inline-flex rounded-full border border-slate-300 px-2 py-1 text-xs text-slate-600">Landlord</span>}
          description="Select a landlord from the pretend user selector before onboarding."
        />
      </Main>
    );
  }

  return (
    <Main
      eyebrow="Landlord Onboarding"
      title="Let's set up your first property"
      description="You can finish in 2 minutes. You can skip steps and return later."
      className="space-y-4"    >
      <MainMenu visible role="landlord" />
      <nav id="landlord-onboarding-breadcrumb" aria-label="Breadcrumb" className="text-xs text-slate-500">
        <p className="flex flex-wrap items-center gap-2">
          <Link href="/" className="hover:text-slate-700">
            Home
          </Link>
          <span>/</span>
          <Link href="/landlord" className="hover:text-slate-700">
            Landlord
          </Link>
          <span>/</span>
          <span className="text-slate-700">Onboarding</span>
        </p>
      </nav>

      <section id="landlord-onboarding-context-card" className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <label className="block text-xs uppercase tracking-wider text-slate-500">Acting as landlord</label>
        <Select
          className="mt-2 w-full rounded border border-slate-300 p-2 md:max-w-md"
          value={activeLandlordId ?? ""}
          onChange={(event) => setActiveLandlordId(event.target.value)}
          disabled={authSession?.role === "landlord"}
        >
          {state.landlords.map((landlord) => (
            <option key={landlord.id} value={landlord.id}>
              {landlord.fullName} ({landlord.email})
            </option>
          ))}
        </Select>
      </section>

      <section id="landlord-onboarding-checklist-card" className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-2 md:grid-cols-2">
          <p className="text-sm text-slate-700">{hasPropertyCreated ? "✅" : "⏳"} Property created</p>
          <p className="text-sm text-slate-700">{hasRentConfigured ? "✅" : "⏳"} Rent schedule configured</p>
          <p className="text-sm text-slate-700">{hasTenants ? "✅" : "⏳"} Invite tenants</p>
          <p className="text-sm text-slate-700">⏳ Optional: deposit & starting balances</p>
        </div>
      </section>

      <section id="landlord-onboarding-stepper-card" className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-2 md:grid-cols-4">
          {["Property", "Rent Rules", "Tenants", "Summary"].map((label, index) => (
            <div
              key={label}
              className={`rounded border px-3 py-2 text-xs ${
                step === index + 1 ? "border-slate-700 bg-slate-50 text-slate-900" : "border-slate-200 text-slate-600"
              }`}
            >
              {index + 1}. {label}
            </div>
          ))}
        </div>
      </section>
      {isDevMode && devActionError && (
        <section id="landlord-onboarding-dev-error-card" className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs text-slate-700">{devActionError}</p>
        </section>
      )}

      {step === 1 && (
        <section id="landlord-onboarding-step-property-card" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Step 1: Create Property</h2>
          {landlordProperties.length > 0 && (
            <div className="mt-3 space-y-2">
              <p className="text-sm text-slate-600">You already have properties. You can skip this step.</p>
              <button
                type="button"
                onClick={() => {
                  setSelectedPropertyId(landlordProperties[0].id);
                  setStep(2);
                }}
                className="rounded border border-slate-300 px-3 py-2 text-sm text-slate-700"
              >
                Skip To Rent Rules
              </button>
            </div>
          )}
          {landlordProperties.length === 0 && (
            <form
              className="mt-3 grid gap-2 md:grid-cols-2"
              onSubmit={(event) => {
                event.preventDefault();
                if (!propertyName.trim()) return;
                const created = state.addProperty({
                  landlordId: activeLandlordId,
                  name: propertyName.trim(),
                  address: propertyAddress.trim(),
                  unitCode: "",
                  monthlyRentCents: 0
                });
                state.setPropertySubscriptionTier({
                  propertyId: created.id,
                  tier: propertyTier,
                  subscriptionStatus: propertyTier === "free" ? "trial" : "active",
                  billingProviderId: propertyTier === "unlimited" ? `sub_${created.id}` : undefined,
                  trialEndsAt: propertyTier === "free" ? new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString() : undefined
                });
                setSelectedPropertyId(created.id);
                setStep(2);
              }}
            >
              <Input
                value={propertyName}
                onChange={(event) => setPropertyName(event.target.value)}
                placeholder="Property name"
                className="rounded border border-slate-300 p-2"
                required
              />
              <Input
                value={propertyAddress}
                onChange={(event) => setPropertyAddress(event.target.value)}
                placeholder="Address (optional)"
                className="rounded border border-slate-300 p-2"
              />
              <Select
                value={propertyTier}
                onChange={(event) => setPropertyTier(event.target.value as "free" | "unlimited")}
                className="rounded border border-slate-300 p-2"
              >
                <option value="free">Free / Trial</option>
                <option value="unlimited">Unlimited</option>
              </Select>
              <button className="rounded bg-slate-900 px-3 py-2 text-sm text-white">Save Property</button>
            </form>
          )}
        </section>
      )}

      {step === 2 && (
        <section id="landlord-onboarding-step-rent-rules-card" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Step 2: Configure Rent Rules</h2>
          <p className="mt-1 text-sm text-slate-600">How often do you charge rent?</p>
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            <Select
              value={selectedProperty?.id ?? ""}
              onChange={(event) => setSelectedPropertyId(event.target.value)}
              className="rounded border border-slate-300 p-2"
            >
              {landlordProperties.map((property) => (
                <option key={property.id} value={property.id}>
                  {property.name}
                </option>
              ))}
            </Select>
            <Input
              value={rentAmount}
              onChange={(event) => setRentAmount(event.target.value)}
              type="number"
              min="0"
              step="0.01"
              placeholder="Rent amount"
              className="rounded border border-slate-300 p-2"
            />
            <Select
              value={cycleMonths}
              onChange={(event) => setCycleMonths(Number(event.target.value) as 1 | 3 | 6 | 12)}
              className="rounded border border-slate-300 p-2"
            >
              <option value={1}>Every 1 month</option>
              <option value={3}>Every 3 months</option>
              <option value={6}>Every 6 months</option>
              <option value={12}>Every 12 months</option>
            </Select>
            <Input
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
              type="date"
              className="rounded border border-slate-300 p-2"
            />
            <Input
              value={dueDay}
              onChange={(event) => setDueDay(Math.min(28, Math.max(1, Number(event.target.value) || 1)))}
              type="number"
              min="1"
              max="28"
              className="rounded border border-slate-300 p-2"
              placeholder="Due day (1-28)"
            />
          </div>
          {existingPeriod && (
            <p className="mt-2 text-xs text-slate-600">
              Existing schedule found. Save to apply edits.
            </p>
          )}
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => {
                if (!selectedProperty) return;
                const amountCents = Math.round(Number(rentAmount || 0) * 100);
                state.updatePropertySettings({
                  propertyId: selectedProperty.id,
                  name: selectedProperty.name,
                  address: selectedProperty.address,
                  unitCode: selectedProperty.unitCode,
                  monthlyRentCents: amountCents
                });
                const end = cycleEndDate(startDate, cycleMonths);
                state.createPaymentPeriod({
                  landlordId: activeLandlordId,
                  propertyId: selectedProperty.id,
                  label: `${cycleMonths} Month${cycleMonths > 1 ? "s" : ""} (Due day ${dueDay})`,
                  durationMonths: cycleMonths,
                  startDate: new Date(startDate).toISOString(),
                  endDate: end.toISOString(),
                  dueDay
                });
                setStep(3);
              }}
              className="rounded bg-slate-900 px-3 py-2 text-sm text-white"
            >
              Save Rent Rules
            </button>
            <button
              type="button"
              onClick={() => setStep(3)}
              className="rounded border border-slate-300 px-3 py-2 text-sm text-slate-700"
            >
              Continue
            </button>
          </div>
        </section>
      )}

      {step === 3 && (
        <section id="landlord-onboarding-step-tenants-card" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Step 3: Add Tenants (Optional)</h2>
          {selectedPropertyTenants.length > 0 && (
            <div className="mt-3 space-y-2 text-sm">
              <p className="text-slate-700">Existing tenants:</p>
              {selectedPropertyTenants.map((tenant) => (
                <div key={tenant.id} className="rounded border border-slate-200 p-2">
                  {tenant.fullName} · {tenant.email}
                </div>
              ))}
            </div>
          )}
          <form
            className="mt-3 grid gap-2 md:grid-cols-2"
            onSubmit={async (event) => {
              event.preventDefault();
              await createTenantFromDraft();
            }}
          >
            <Input
              name="fullName"
              value={tenantFullName}
              onChange={(event) => setTenantFullName(event.target.value)}
              placeholder="Tenant full name"
              className="rounded border border-slate-300 p-2"
            />
            <Input
              name="email"
              value={tenantEmail}
              onChange={(event) => setTenantEmail(event.target.value)}
              placeholder="Tenant email (optional if phone exists)"
              className="rounded border border-slate-300 p-2"
            />
            <Input
              name="phone"
              value={tenantPhone}
              onChange={(event) => setTenantPhone(event.target.value)}
              placeholder="Tenant phone (optional if email exists)"
              className="rounded border border-slate-300 p-2"
            />
            <button
              className="rounded border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-700 hover:border-slate-500"
              disabled={isAddingTenant}
            >
              {isAddingTenant ? "Saving..." : "Save and add another tenant"}
            </button>
          </form>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              className="rounded border border-slate-300 px-3 py-2 text-sm text-slate-500"
              disabled
              title="Invite flow will be added later"
            >
              Invite via link (later)
            </button>
            <button
              type="button"
              onClick={() => setStep(4)}
              className="rounded border border-slate-300 px-3 py-2 text-sm text-slate-700"
            >
              Skip for now
            </button>
            {hasValidTenantDraft ? (
              <button
                type="button"
                onClick={async () => {
                  const saved = await createTenantFromDraft();
                  if (saved) setStep(4);
                }}
                disabled={isAddingTenant}
                className="rounded bg-slate-900 px-3 py-2 text-sm text-white"
              >
                {isAddingTenant ? "Saving..." : "Add tenant and continue"}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setStep(4)}
                className="rounded bg-slate-900 px-3 py-2 text-sm text-white"
              >
                Continue
              </button>
            )}
          </div>
        </section>
      )}

      {step === 4 && summary && (
        <section id="landlord-onboarding-step-summary-card" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Step 4: Property Summary</h2>
          <div className="mt-3 grid gap-2 md:grid-cols-2 text-sm">
            <div className="rounded border border-slate-200 bg-slate-50 p-2">Property: {summary.propertyName}</div>
            <div className="rounded border border-slate-200 bg-slate-50 p-2">Tier: {summary.tier}</div>
            <div className="rounded border border-slate-200 bg-slate-50 p-2">
              Rent schedule: {centsToCurrency(summary.amountCents)} every {summary.cycleMonths} month(s)
            </div>
            <div className="rounded border border-slate-200 bg-slate-50 p-2">Tenants: {summary.tenantCount}</div>
            <div className="rounded border border-slate-200 bg-slate-50 p-2">
              Start date: {new Date(summary.startDate).toLocaleDateString("en-US")}
            </div>
            <div className="rounded border border-slate-200 bg-slate-50 p-2">
              Next due date preview: {summary.nextDueDate.toLocaleDateString("en-US")}
            </div>
          </div>
          <div className="mt-4">
            <div className="flex flex-wrap gap-2">
              <Link
                href="/landlord/properties"
                className="inline-flex rounded bg-slate-900 px-4 py-2 text-sm text-white"
              >
                Open Property Portfolio
              </Link>
              <Link
                href="/landlord"
                className="inline-flex rounded border border-slate-300 px-4 py-2 text-sm text-slate-700"
              >
                Go To Landlord Dashboard
              </Link>
            </div>
          </div>
        </section>
      )}
    </Main>
  );
}
