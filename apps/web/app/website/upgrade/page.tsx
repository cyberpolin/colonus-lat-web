"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Main } from "@/components/ui/main";
import { Select } from "@/components/ui/select";

const steps = ["Plan", "Account", "Billing", "Confirm"] as const;

export default function WebsiteUpgradePage() {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    plan: "premium_monthly",
    companyName: "",
    contactEmail: "",
    propertiesCount: "1-5",
    cardholderName: "",
    cardEnding: "",
    accepted: false
  });
  const [completed, setCompleted] = useState(false);

  const canContinue = useMemo(() => {
    if (step === 0) return true;
    if (step === 1) return Boolean(form.companyName.trim() && form.contactEmail.trim());
    if (step === 2) return Boolean(form.cardholderName.trim() && form.cardEnding.trim().length >= 4);
    if (step === 3) return form.accepted;
    return false;
  }, [form, step]);

  const onNext = () => {
    if (!canContinue) return;
    if (step === steps.length - 1) {
      setCompleted(true);
      return;
    }
    setStep((current) => Math.min(current + 1, steps.length - 1));
  };

  const onBack = () => {
    setStep((current) => Math.max(current - 1, 0));
  };

  return (
    <Main
      eyebrow="Website Upgrade"
      title="Upgrade Wizard (Dummy)"
      description="This flow is a UI simulation for premium checkout."
      maxWidthClassName="max-w-3xl"
    >
      <section id="website-upgrade-wizard-card" className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mt-4 grid grid-cols-4 gap-2">
          {steps.map((item, index) => (
            <div
              key={item}
              className={`rounded border px-2 py-1 text-center text-xs ${
                index <= step ? "border-slate-700 bg-slate-100 text-slate-900" : "border-slate-200 text-slate-500"
              }`}
            >
              {item}
            </div>
          ))}
        </div>

        {!completed && (
          <div className="mt-5 space-y-3">
            {step === 0 && (
              <div className="space-y-2">
                <label className="block text-xs text-slate-600">
                  Plan
                  <Select
                    className="mt-1 w-full rounded border border-slate-300 p-2 text-sm"
                    value={form.plan}
                    onChange={(event) => setForm((current) => ({ ...current, plan: event.target.value }))}
                  >
                    <option value="premium_monthly">Premium Monthly - $10</option>
                  </Select>
                </label>
              </div>
            )}

            {step === 1 && (
              <div className="space-y-2">
                <label className="block text-xs text-slate-600">
                  Company name
                  <Input
                    className="mt-1 w-full rounded border border-slate-300 p-2 text-sm"
                    value={form.companyName}
                    onChange={(event) => setForm((current) => ({ ...current, companyName: event.target.value }))}
                  />
                </label>
                <label className="block text-xs text-slate-600">
                  Contact email
                  <Input
                    type="email"
                    className="mt-1 w-full rounded border border-slate-300 p-2 text-sm"
                    value={form.contactEmail}
                    onChange={(event) => setForm((current) => ({ ...current, contactEmail: event.target.value }))}
                  />
                </label>
                <label className="block text-xs text-slate-600">
                  Properties in portfolio
                  <Select
                    className="mt-1 w-full rounded border border-slate-300 p-2 text-sm"
                    value={form.propertiesCount}
                    onChange={(event) => setForm((current) => ({ ...current, propertiesCount: event.target.value }))}
                  >
                    <option value="1-5">1-5</option>
                    <option value="6-20">6-20</option>
                    <option value="21+">21+</option>
                  </Select>
                </label>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-2">
                <label className="block text-xs text-slate-600">
                  Cardholder name
                  <Input
                    className="mt-1 w-full rounded border border-slate-300 p-2 text-sm"
                    value={form.cardholderName}
                    onChange={(event) => setForm((current) => ({ ...current, cardholderName: event.target.value }))}
                  />
                </label>
                <label className="block text-xs text-slate-600">
                  Card ending (last 4)
                  <Input
                    className="mt-1 w-full rounded border border-slate-300 p-2 text-sm"
                    value={form.cardEnding}
                    onChange={(event) => setForm((current) => ({ ...current, cardEnding: event.target.value }))}
                    maxLength={4}
                  />
                </label>
              </div>
            )}

            {step === 3 && (
              <div id="website-upgrade-confirmation-card" className="rounded border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                <p>Plan: Premium Monthly ($10)</p>
                <p>Company: {form.companyName || "N/A"}</p>
                <p>Contact: {form.contactEmail || "N/A"}</p>
                <p>Card: **** {form.cardEnding || "----"}</p>
                <label className="mt-3 flex items-center gap-2 text-xs text-slate-600">
                  <Input
                    type="checkbox"
                    checked={form.accepted}
                    onChange={(event) => setForm((current) => ({ ...current, accepted: event.target.checked }))}
                  />
                  I accept this is a demo checkout flow.
                </label>
              </div>
            )}
          </div>
        )}

        {completed && (
          <div id="website-upgrade-complete-card" className="mt-5 rounded border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-medium text-slate-900">Dummy upgrade completed</p>
            <p className="mt-1 text-sm text-slate-700">
              No real charge was processed. This screen simulates successful upgrade onboarding.
            </p>
          </div>
        )}

        <div className="mt-5 flex flex-wrap gap-2">
          {!completed && (
            <>
              <button
                type="button"
                onClick={onBack}
                disabled={step === 0}
                className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 disabled:opacity-40"
              >
                Back
              </button>
              <button
                type="button"
                onClick={onNext}
                disabled={!canContinue}
                className="rounded-full border border-slate-900 bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
              >
                {step === steps.length - 1 ? "Finish" : "Continue"}
              </button>
            </>
          )}
          <Link
            href="/website"
            className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:border-slate-500"
          >
            Back To Website
          </Link>
        </div>
      </section>
    </Main>
  );
}
