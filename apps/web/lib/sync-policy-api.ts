import type { SyncPolicy, SyncPolicyMode, SyncPolicyRole } from "@colonus/shared";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

const defaultsByRole: Record<SyncPolicyRole, SyncPolicy> = {
  super_admin: {
    id: "default-super-admin",
    role: "super_admin",
    enabled: true,
    mode: "interval",
    delayAfterChangeSeconds: 60,
    intervalSeconds: 30,
    retryBackoffSeconds: 30,
    maxRetryBackoffSeconds: 180,
    maxJitterSeconds: 0,
    initialHydrationOnLogin: true,
    forceSyncOnLogin: false,
    devShowCountdown: true,
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString()
  },
  landlord: {
    id: "default-landlord",
    role: "landlord",
    enabled: true,
    mode: "after_change",
    delayAfterChangeSeconds: 60,
    intervalSeconds: 300,
    retryBackoffSeconds: 60,
    maxRetryBackoffSeconds: 300,
    maxJitterSeconds: 0,
    initialHydrationOnLogin: true,
    forceSyncOnLogin: false,
    devShowCountdown: true,
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString()
  },
  tenant: {
    id: "default-tenant",
    role: "tenant",
    enabled: true,
    mode: "after_change",
    delayAfterChangeSeconds: 60,
    intervalSeconds: 300,
    retryBackoffSeconds: 60,
    maxRetryBackoffSeconds: 300,
    maxJitterSeconds: 0,
    initialHydrationOnLogin: true,
    forceSyncOnLogin: false,
    devShowCountdown: true,
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString()
  }
};

const ensureOk = async (response: Response, fallback: string): Promise<void> => {
  if (response.ok) return;
  let message = fallback;
  try {
    const body = (await response.json()) as { error?: string };
    if (body.error) message = body.error;
  } catch {
    // ignore
  }
  throw new Error(message);
};

const normalizePolicy = (raw: unknown, fallbackRole: SyncPolicyRole): SyncPolicy => {
  const policy = (raw ?? {}) as Partial<SyncPolicy> & { role?: unknown; mode?: unknown };
  const role =
    policy.role === "super_admin" || policy.role === "landlord" || policy.role === "tenant"
      ? policy.role
      : fallbackRole;
  const mode: SyncPolicyMode =
    policy.mode === "after_change" || policy.mode === "interval" || policy.mode === "hybrid"
      ? policy.mode
      : defaultsByRole[role].mode;

  return {
    ...defaultsByRole[role],
    ...policy,
    role,
    mode,
    id: typeof policy.id === "string" ? policy.id : defaultsByRole[role].id
  };
};

export const getSyncPolicies = async (): Promise<Record<SyncPolicyRole, SyncPolicy>> => {
  const response = await fetch(`${API_BASE_URL}/api/sync/policy`);
  await ensureOk(response, "Failed to load sync policies.");
  const body = (await response.json()) as { policies?: unknown[] };
  const policies = Array.isArray(body.policies) ? body.policies : [];
  const merged: Record<SyncPolicyRole, SyncPolicy> = {
    ...defaultsByRole
  };
  policies.forEach((item) => {
    const normalized = normalizePolicy(item, "tenant");
    merged[normalized.role] = normalized;
  });
  return merged;
};

export const getSyncPolicyByRole = async (role: SyncPolicyRole): Promise<SyncPolicy> => {
  const response = await fetch(`${API_BASE_URL}/api/sync/policy/${encodeURIComponent(role)}`);
  if (response.status === 404) return defaultsByRole[role];
  await ensureOk(response, "Failed to load sync policy.");
  const body = (await response.json()) as { policy?: unknown };
  return normalizePolicy(body.policy, role);
};

export const updateSyncPolicyByRole = async (input: {
  role: SyncPolicyRole;
  actorUserId: string;
  data: Partial<
    Pick<
      SyncPolicy,
      | "enabled"
      | "mode"
      | "delayAfterChangeSeconds"
      | "intervalSeconds"
      | "retryBackoffSeconds"
      | "maxRetryBackoffSeconds"
      | "maxJitterSeconds"
      | "initialHydrationOnLogin"
      | "forceSyncOnLogin"
      | "devShowCountdown"
    >
  >;
}): Promise<SyncPolicy> => {
  const response = await fetch(`${API_BASE_URL}/api/sync/policy/${encodeURIComponent(input.role)}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-colonus-user-id": input.actorUserId
    },
    body: JSON.stringify(input.data)
  });
  await ensureOk(response, "Failed to save sync policy.");
  const body = (await response.json()) as { policy?: unknown };
  return normalizePolicy(body.policy, input.role);
};

export const defaultSyncPolicyForRole = (role: SyncPolicyRole): SyncPolicy => defaultsByRole[role];
