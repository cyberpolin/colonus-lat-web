"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Main } from "@/components/ui/main";
import { completeTenantOnboarding } from "@/lib/auth-api";
import { useColonusStore } from "@/lib/store";

export default function OnboardingPage() {
  const router = useRouter();
  const loginWithPassword = useColonusStore((state) => state.loginWithPassword);
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const tokenFromQuery = new URLSearchParams(window.location.search).get("token") ?? "";
    setToken(tokenFromQuery);
  }, []);

  return (
    <Main
      eyebrow="First Access"
      title="Set your password"
      description="This is required before accessing your workspace."
      maxWidthClassName="max-w-md"
    >
      <section id="user-onboarding-main-card" className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <form
          className="mt-4 space-y-3"
          onSubmit={async (event) => {
            event.preventDefault();
            if (!token) {
              setError("Missing onboarding token. Ask admin for a new invitation.");
              return;
            }
            if (password.length < 6) {
              setError("Password must be at least 6 characters.");
              return;
            }
            if (password !== confirmPassword) {
              setError("Passwords do not match.");
              return;
            }
            try {
              setSubmitting(true);
              const user = await completeTenantOnboarding({
                token,
                password,
                phone: phone.trim() || undefined
              });
              const loginResult = await loginWithPassword({
                email: user.email,
                password
              });
              if (!loginResult.ok) {
                setError(loginResult.error);
                return;
              }
              setError(undefined);
              if (loginResult.role === "landlord") {
                router.push("/landlord");
                return;
              }
              if (loginResult.role === "tenant") {
                router.push("/tenant");
                return;
              }
              router.push("/superadmin");
            } catch (submitError) {
              setError(
                submitError instanceof Error ? submitError.message : "Unable to complete onboarding."
              );
            } finally {
              setSubmitting(false);
            }
          }}
        >
          <Input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="New password"
            className="w-full rounded border border-slate-300 p-2"
          />
          <Input
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            placeholder="Confirm new password"
            className="w-full rounded border border-slate-300 p-2"
          />
          <Input
            type="tel"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            placeholder="Phone (optional)"
            className="w-full rounded border border-slate-300 p-2"
          />
          {error && <p className="text-xs text-slate-700">{error}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-60"
          >
            {submitting ? "Saving..." : "Complete Onboarding"}
          </button>
        </form>
        <div className="mt-4">
          <Link
            href="/login"
            className="rounded-full border border-slate-300 px-4 py-2 text-xs text-slate-700 hover:border-slate-500"
          >
            Back To Login
          </Link>
        </div>
      </section>
    </Main>
  );
}
