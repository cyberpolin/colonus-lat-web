"use client";

import { useEffect, useMemo, useState } from "react";
import { MainMenu } from "@/components/main-menu";
import { SuperAdminRouteGuard } from "@/components/super-admin-route-guard";
import { Input } from "@/components/ui/input";
import { Main } from "@/components/ui/main";
import { Select } from "@/components/ui/select";
import {
  defaultSyncPolicyForRole,
  getSyncPolicies,
  updateSyncPolicyByRole
} from "@/lib/sync-policy-api";
import { useColonusStore } from "@/lib/store";
import type { SyncPolicy, SyncPolicyMode, SyncPolicyRole } from "@colonus/shared";

const roleOrder: SyncPolicyRole[] = ["super_admin", "landlord", "tenant"];
const roleLabel: Record<SyncPolicyRole, string> = {
  super_admin: "Super Admin",
  landlord: "Landlord",
  tenant: "Tenant"
};

type PolicyDraft = SyncPolicy;

const numberField = (value: string, fallback: number): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed)) : fallback;
};

export function SuperAdminSyncSettingsPage() {
  const authSession = useColonusStore((state) => state.authSession);
  const [drafts, setDrafts] = useState<Record<SyncPolicyRole, PolicyDraft>>({
    super_admin: defaultSyncPolicyForRole("super_admin"),
    landlord: defaultSyncPolicyForRole("landlord"),
    tenant: defaultSyncPolicyForRole("tenant")
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingByRole, setIsSavingByRole] = useState<Record<SyncPolicyRole, boolean>>({
    super_admin: false,
    landlord: false,
    tenant: false
  });
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    void getSyncPolicies()
      .then((policies) => {
        if (cancelled) return;
        setDrafts({
          super_admin: policies.super_admin,
          landlord: policies.landlord,
          tenant: policies.tenant
        });
      })
      .catch((loadError) => {
        if (cancelled) return;
        setError(loadError instanceof Error ? loadError.message : "Failed to load sync policies.");
      })
      .finally(() => {
        if (cancelled) return;
        setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const canSave = Boolean(authSession?.keystoneUserId);
  const actorId = authSession?.keystoneUserId;

  const modeSummary = useMemo(() => {
    return roleOrder
      .map((role) => {
        const draft = drafts[role];
        if (!draft.enabled) return `${roleLabel[role]}: disabled`;
        if (draft.mode === "after_change") return `${roleLabel[role]}: ${draft.delayAfterChangeSeconds}s after last change`;
        if (draft.mode === "interval") return `${roleLabel[role]}: every ${draft.intervalSeconds}s`;
        return `${roleLabel[role]}: hybrid ${draft.delayAfterChangeSeconds}s + ${draft.intervalSeconds}s`;
      })
      .join(" | ");
  }, [drafts]);

  return (
    <SuperAdminRouteGuard title="Sync Settings">
      <Main
        eyebrow="Super Admin"
        title="Sync Settings"
        description="Role-based sync policies managed by Keystone. These settings affect all users by role."      >
        <MainMenu visible role="super_admin" />

        <section
          id="superadmin-sync-settings-summary-card"
          className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
        >
          <p className="text-xs uppercase tracking-wide text-slate-500">Effective Summary</p>
          <p className="mt-2 text-sm text-slate-700">{modeSummary}</p>
        </section>

        {error && (
          <section
            id="superadmin-sync-settings-error-card"
            className="mt-4 rounded-2xl border border-slate-300 bg-slate-50 p-4 shadow-sm"
          >
            <p className="text-xs text-slate-700">{error}</p>
          </section>
        )}

        {notice && (
          <section
            id="superadmin-sync-settings-notice-card"
            className="mt-4 rounded-2xl border border-slate-300 bg-slate-50 p-4 shadow-sm"
          >
            <p className="text-xs text-slate-700">{notice}</p>
          </section>
        )}

        <div className="mt-4 grid gap-4 md:grid-cols-3">
          {roleOrder.map((role) => {
            const draft = drafts[role];
            const isSaving = isSavingByRole[role];
            return (
              <section
                key={role}
                id={`superadmin-sync-settings-${role}-card`}
                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <p className="text-xs uppercase tracking-wide text-slate-500">{roleLabel[role]} Policy</p>
                {isLoading ? (
                  <p className="mt-2 text-sm text-slate-600">Loading...</p>
                ) : (
                  <form
                    className="mt-3 space-y-2"
                    onSubmit={async (event) => {
                      event.preventDefault();
                      if (!actorId) {
                        setError("Missing actor id for saving policy.");
                        return;
                      }
                      setError(undefined);
                      setNotice(undefined);
                      setIsSavingByRole((state) => ({ ...state, [role]: true }));
                      try {
                        const saved = await updateSyncPolicyByRole({
                          role,
                          actorUserId: actorId,
                          data: {
                            enabled: draft.enabled,
                            mode: draft.mode,
                            delayAfterChangeSeconds: draft.delayAfterChangeSeconds,
                            intervalSeconds: draft.intervalSeconds,
                            retryBackoffSeconds: draft.retryBackoffSeconds,
                            maxRetryBackoffSeconds: draft.maxRetryBackoffSeconds,
                            maxJitterSeconds: draft.maxJitterSeconds,
                            initialHydrationOnLogin: draft.initialHydrationOnLogin,
                            forceSyncOnLogin: draft.forceSyncOnLogin,
                            devShowCountdown: draft.devShowCountdown
                          }
                        });
                        setDrafts((state) => ({ ...state, [role]: saved }));
                        setNotice(`${roleLabel[role]} policy updated.`);
                      } catch (saveError) {
                        setError(
                          saveError instanceof Error ? saveError.message : "Failed to save policy."
                        );
                      } finally {
                        setIsSavingByRole((state) => ({ ...state, [role]: false }));
                      }
                    }}
                  >
                    <label className="flex items-center gap-2 text-xs text-slate-700">
                      <input
                        type="checkbox"
                        checked={draft.enabled}
                        onChange={(event) =>
                          setDrafts((state) => ({
                            ...state,
                            [role]: { ...state[role], enabled: event.target.checked }
                          }))
                        }
                      />
                      Enabled
                    </label>

                    <label className="text-xs uppercase tracking-wide text-slate-500">
                      Sync mode
                    </label>
                    <Select
                      value={draft.mode}
                      onChange={(event) =>
                        setDrafts((state) => ({
                          ...state,
                          [role]: {
                            ...state[role],
                            mode: event.target.value as SyncPolicyMode
                          }
                        }))
                      }
                    >
                      <option value="after_change">After last change</option>
                      <option value="interval">Fixed interval</option>
                      <option value="hybrid">Hybrid</option>
                    </Select>

                    <label className="text-xs uppercase tracking-wide text-slate-500">
                      Delay after change (seconds)
                    </label>
                    <Input
                      type="number"
                      min={0}
                      value={draft.delayAfterChangeSeconds}
                      onChange={(event) =>
                        setDrafts((state) => ({
                          ...state,
                          [role]: {
                            ...state[role],
                            delayAfterChangeSeconds: numberField(
                              event.target.value,
                              state[role].delayAfterChangeSeconds
                            )
                          }
                        }))
                      }
                      placeholder="Delay after change (seconds)"
                    />
                    <label className="text-xs uppercase tracking-wide text-slate-500">
                      Interval seconds
                    </label>
                    <Input
                      type="number"
                      min={0}
                      value={draft.intervalSeconds}
                      onChange={(event) =>
                        setDrafts((state) => ({
                          ...state,
                          [role]: {
                            ...state[role],
                            intervalSeconds: numberField(event.target.value, state[role].intervalSeconds)
                          }
                        }))
                      }
                      placeholder="Interval (seconds)"
                    />
                    <label className="text-xs uppercase tracking-wide text-slate-500">
                      Retry backoff (seconds)
                    </label>
                    <Input
                      type="number"
                      min={0}
                      value={draft.retryBackoffSeconds}
                      onChange={(event) =>
                        setDrafts((state) => ({
                          ...state,
                          [role]: {
                            ...state[role],
                            retryBackoffSeconds: numberField(
                              event.target.value,
                              state[role].retryBackoffSeconds
                            )
                          }
                        }))
                      }
                      placeholder="Retry backoff (seconds)"
                    />
                    <label className="text-xs uppercase tracking-wide text-slate-500">
                      Max retry backoff (seconds)
                    </label>
                    <Input
                      type="number"
                      min={0}
                      value={draft.maxRetryBackoffSeconds}
                      onChange={(event) =>
                        setDrafts((state) => ({
                          ...state,
                          [role]: {
                            ...state[role],
                            maxRetryBackoffSeconds: numberField(
                              event.target.value,
                              state[role].maxRetryBackoffSeconds
                            )
                          }
                        }))
                      }
                      placeholder="Max retry backoff (seconds)"
                    />
                    <label className="text-xs uppercase tracking-wide text-slate-500">
                      Jitter (seconds)
                    </label>
                    <Input
                      type="number"
                      min={0}
                      value={draft.maxJitterSeconds}
                      onChange={(event) =>
                        setDrafts((state) => ({
                          ...state,
                          [role]: {
                            ...state[role],
                            maxJitterSeconds: numberField(event.target.value, state[role].maxJitterSeconds)
                          }
                        }))
                      }
                      placeholder="Jitter (seconds)"
                    />

                    <label className="flex items-center gap-2 text-xs text-slate-700">
                      <input
                        type="checkbox"
                        checked={draft.initialHydrationOnLogin}
                        onChange={(event) =>
                          setDrafts((state) => ({
                            ...state,
                            [role]: { ...state[role], initialHydrationOnLogin: event.target.checked }
                          }))
                        }
                      />
                      Initial hydration on login
                    </label>

                    <label className="flex items-center gap-2 text-xs text-slate-700">
                      <input
                        type="checkbox"
                        checked={draft.forceSyncOnLogin}
                        onChange={(event) =>
                          setDrafts((state) => ({
                            ...state,
                            [role]: { ...state[role], forceSyncOnLogin: event.target.checked }
                          }))
                        }
                      />
                      Force upload on login
                    </label>

                    <label className="flex items-center gap-2 text-xs text-slate-700">
                      <input
                        type="checkbox"
                        checked={draft.devShowCountdown}
                        onChange={(event) =>
                          setDrafts((state) => ({
                            ...state,
                            [role]: { ...state[role], devShowCountdown: event.target.checked }
                          }))
                        }
                      />
                      Show DEV countdown
                    </label>

                    <button
                      type="submit"
                      disabled={!canSave || isSaving}
                      className="rounded bg-slate-900 px-3 py-2 text-xs text-white disabled:opacity-60"
                    >
                      {isSaving ? "Saving..." : "Save Policy"}
                    </button>
                  </form>
                )}
              </section>
            );
          })}
        </div>
      </Main>
    </SuperAdminRouteGuard>
  );
}
