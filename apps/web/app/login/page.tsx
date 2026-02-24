"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Main } from "@/components/ui/main";
import { useColonusStore } from "@/lib/store";

export default function LoginPage() {
  const isDevMode = process.env.NODE_ENV === "development";
  const router = useRouter();
  const loginWithPassword = useColonusStore((state) => state.loginWithPassword);
  const seedFakeData = useColonusStore((state) => state.seedFakeData);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string>();
  const [isSeedingDevData, setIsSeedingDevData] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);

  return (
    <Main
      eyebrow="COLONUS"
      title="Login"
      description="Sign in as super admin, landlord, or tenant."
      maxWidthClassName="max-w-md"
    >
      <section id="login-main-card" className="rounded-2xl rounded-t-none border border-slate-200 bg-white p-6 shadow-sm">
        <form
          className="mt-4 space-y-3"
          onSubmit={async (event) => {
            event.preventDefault();
            if (isDevMode && isSeedingDevData) {
              setError("Dev seed is still running. Wait until it finishes.");
              return;
            }
            setIsSigningIn(true);
            try {
              const result = await loginWithPassword({ email, password });
              if (!result.ok) {
                setError(result.error);
                return;
              }
              setError(undefined);
              if (result.role === "super_admin") router.push("/superadmin");
              if ((result.role === "landlord" || result.role === "tenant") && result.requiresPasswordChange) {
                const tokenQuery = result.firstTimePasswordToken
                  ? `?token=${encodeURIComponent(result.firstTimePasswordToken)}`
                  : "";
                router.push(`/onboarding${tokenQuery}`);
                return;
              }
              if (result.role === "landlord") router.push("/landlord");
              if (result.role === "tenant") router.push("/tenant");
            } finally {
              setIsSigningIn(false);
            }
          }}
        >
          <Input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="Email"
            disabled={(isDevMode && isSeedingDevData) || isSigningIn}
            className="w-full rounded border border-slate-300 p-2"
          />
          <Input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Password"
            disabled={(isDevMode && isSeedingDevData) || isSigningIn}
            className="w-full rounded border border-slate-300 p-2"
          />
          {error && <p className="text-xs text-slate-700">{error}</p>}
          <p className="text-xs text-slate-500">Demo password: demo123</p>
          <button
            type="submit"
            disabled={(isDevMode && isSeedingDevData) || isSigningIn}
            className="w-full rounded bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-60"
          >
            {isSigningIn ? "Signing In..." : "Sign In"}
          </button>
        </form>
        {isDevMode && (
          <section id="login-dev-legend-card" className="mt-4 rounded border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
            <p className="font-semibold uppercase tracking-wider text-slate-600">Dev Login Legend</p>
            <p className="mt-2">Password (all): <span className="font-medium">demo123</span></p>
            <div className="mt-2 space-y-1">
              <p>Super Admin: <span className="font-medium">demo.admin@colonus.lat</span></p>
              <p>Landlord: <span className="font-medium">demo3@colonus.lat</span></p>
              <p>Tenant: <span className="font-medium">tenant.demo3@colonus.lat</span></p>
            </div>
            <button
              type="button"
              onClick={async () => {
                setIsSeedingDevData(true);
                try {
                  if (typeof window !== "undefined") {
                    const keys = Object.keys(window.localStorage);
                    keys
                      .filter((key) => key.startsWith("COLONUS_"))
                      .forEach((key) => window.localStorage.removeItem(key));
                  }
                  await seedFakeData();
                  setError(undefined);
                } catch (seedError) {
                  setError(
                    seedError instanceof Error
                      ? `Seed failed: ${seedError.message}`
                      : "Seed failed. Check API server connection."
                  );
                } finally {
                  setIsSeedingDevData(false);
                }
              }}
              disabled={isSeedingDevData}
              className="mt-3 rounded border border-slate-300 bg-white px-3 py-1 text-xs text-slate-700 hover:border-slate-500"
            >
              {isSeedingDevData ? "Seeding..." : "Seed Fake Data (Dev)"}
            </button>
          </section>
        )}
      </section>
    </Main>
  );
}
