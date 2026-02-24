"use client";

import { useEffect, useRef } from "react";
import {
  getStorageKeys,
  type UserRole,
  type SyncPolicy,
  type SyncPolicyRole,
  type EntityKind,
  type MutationAction,
  type SyncMutation,
  type TenantGrade
} from "@colonus/shared";
import { getOutboxQueue, replaceChangeLog, replaceOutbox } from "@colonus/sync";
import { useIntervalServiceStore } from "@/lib/interval-service";
import { useColonusStore } from "@/lib/store";
import {
  buildLocalSnapshotPayload,
  getLandlordsWithMergedSnapshots,
  getMergedSnapshot,
  getMergedVersion,
  uploadSnapshot
} from "@/lib/snapshot-sync-api";
import { defaultSyncPolicyForRole, getSyncPolicyByRole } from "@/lib/sync-policy-api";
import { useSyncStatusStore } from "@/lib/sync-status-store";
import { setTenantGrades } from "@/lib/tenant-grades-store";

interface SyncMetaState {
  byLandlord: Record<string, { lastAppliedMergedVersion: number; lastSyncedAt: string }>;
}

const getPolicyRoleForSession = (
  role: UserRole
): SyncPolicyRole => {
  if (role === "super_admin" || role === "landlord" || role === "tenant") return role;
  return "tenant";
};

const readCachedPolicy = (role: SyncPolicyRole): SyncPolicy | undefined => {
  if (typeof window === "undefined") return undefined;
  const raw = window.localStorage.getItem(getStorageKeys().syncPolicyCache);
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw) as Partial<Record<SyncPolicyRole, SyncPolicy>>;
    const policy = parsed[role];
    return policy;
  } catch {
    return undefined;
  }
};

const writeCachedPolicy = (policy: SyncPolicy): void => {
  if (typeof window === "undefined") return;
  const raw = window.localStorage.getItem(getStorageKeys().syncPolicyCache);
  let parsed: Partial<Record<SyncPolicyRole, SyncPolicy>> = {};
  if (raw) {
    try {
      parsed = JSON.parse(raw) as Partial<Record<SyncPolicyRole, SyncPolicy>>;
    } catch {
      parsed = {};
    }
  }
  parsed[policy.role] = policy;
  window.localStorage.setItem(getStorageKeys().syncPolicyCache, JSON.stringify(parsed));
};

const readSyncMeta = (): SyncMetaState => {
  if (typeof window === "undefined") return { byLandlord: {} };
  const raw = window.localStorage.getItem(getStorageKeys().syncMeta);
  if (!raw) return { byLandlord: {} };
  try {
    const parsed = JSON.parse(raw) as SyncMetaState;
    return parsed?.byLandlord ? parsed : { byLandlord: {} };
  } catch {
    return { byLandlord: {} };
  }
};

const writeSyncMeta = (state: SyncMetaState): void => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(getStorageKeys().syncMeta, JSON.stringify(state));
};

const mergeUnsyncedOutbox = (
  localQueue: SyncMutation[],
  mergedQueue: Array<Record<string, unknown>>
): SyncMutation[] => {
  const localUnsynced = localQueue.filter((item) => item.status !== "synced");
  const byId = new Map<string, SyncMutation>();

  mergedQueue.forEach((raw) => {
    const parsed = toSyncMutation(raw);
    if (!parsed) return;
    byId.set(parsed.mutationId, parsed);
  });

  localUnsynced.forEach((item) => {
    byId.set(item.mutationId, item);
  });

  return Array.from(byId.values()).sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );
};

const toChangeLogEntries = (
  mergedEntries: Array<{ logId: string; timestamp: string; mutation: Record<string, unknown> }>
) =>
  mergedEntries.map((entry) => ({
    logId: entry.logId,
    timestamp: entry.timestamp,
    mutation: toSyncMutation(entry.mutation) ?? fallbackSyncMutation(entry.mutation)
  }));

const isEntityKind = (value: unknown): value is EntityKind =>
  [
    "tenant",
    "landlord",
    "property",
    "tenant_grade",
    "property_subscription",
    "property_proof_settings",
    "payment_submission",
    "care_proof_submission",
    "property_expense",
    "fix_request",
    "permission_request",
    "refund_request",
    "ticket",
    "payment_period"
  ].includes(String(value));

const isMutationAction = (value: unknown): value is MutationAction =>
  value === "create" || value === "update" || value === "delete";

const isMutationStatus = (
  value: unknown
): value is SyncMutation["status"] =>
  value === "queued" ||
  value === "processing" ||
  value === "failed" ||
  value === "synced" ||
  value === "needsReview";

const fallbackSyncMutation = (raw: Record<string, unknown>): SyncMutation => ({
  mutationId:
    typeof raw.mutationId === "string" && raw.mutationId.length > 0
      ? raw.mutationId
      : `merged_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
  entity: isEntityKind(raw.entity) ? raw.entity : "property",
  action: isMutationAction(raw.action) ? raw.action : "update",
  timestamp:
    typeof raw.timestamp === "string" && raw.timestamp.length > 0
      ? raw.timestamp
      : new Date().toISOString(),
  payload: raw.payload ?? {},
  retries: typeof raw.retries === "number" ? raw.retries : 0,
  status: isMutationStatus(raw.status) ? raw.status : "queued"
});

const toSyncMutation = (raw: Record<string, unknown>): SyncMutation | undefined => {
  if (
    typeof raw.mutationId !== "string" ||
    !isEntityKind(raw.entity) ||
    !isMutationAction(raw.action) ||
    typeof raw.timestamp !== "string" ||
    typeof raw.retries !== "number" ||
    !isMutationStatus(raw.status)
  ) {
    return undefined;
  }

  return {
    mutationId: raw.mutationId,
    entity: raw.entity,
    action: raw.action,
    timestamp: raw.timestamp,
    payload: raw.payload,
    retries: raw.retries,
    status: raw.status
  };
};

const safeRolePropertyScope = (
  state: ReturnType<typeof useColonusStore.getState>
): { userId?: string; landlordId?: string } => {
  const session = state.authSession;
  if (!session) return { userId: undefined, landlordId: undefined };
  const actorId = session.keystoneUserId ?? session.userId;

  if (session.role === "tenant") {
    const tenant = state.tenants.find((item) => item.id === session.userId);
    return { userId: actorId, landlordId: tenant?.landlordId };
  }

  if (session.role === "landlord") {
    return { userId: actorId, landlordId: session.userId };
  }

  return { userId: actorId, landlordId: undefined };
};

const applyMergedSnapshot = (input: {
  mergedState: Record<string, unknown>;
  mergedOutbox: Array<Record<string, unknown>>;
  mergedChangeLog: Array<{ logId: string; timestamp: string; mutation: Record<string, unknown> }>;
  mergedTenantGrades: unknown;
}): void => {
  const current = useColonusStore.getState();
  const localQueue = getOutboxQueue();
  const reconciledOutbox = mergeUnsyncedOutbox(localQueue, input.mergedOutbox);

  useColonusStore.setState((state) => ({
    ...state,
    ...input.mergedState,
    authSession: state.authSession,
    activeRole: state.activeRole,
    impersonationRole: state.impersonationRole,
    activeSuperAdminId: state.activeSuperAdminId,
    activeLandlordId: state.activeLandlordId,
    activeTenantId: state.activeTenantId,
    themeColorHex: state.themeColorHex,
    themeHueRotate: state.themeHueRotate,
    devBannerCollapsed: state.devBannerCollapsed
  }));

  replaceOutbox(reconciledOutbox);
  replaceChangeLog(toChangeLogEntries(input.mergedChangeLog));

  const tenantGrades = Array.isArray(input.mergedTenantGrades)
    ? (input.mergedTenantGrades as TenantGrade[])
    : [];
  setTenantGrades(tenantGrades);
  void current;
};

export const useAutoSnapshotSync = (): void => {
  const authSession = useColonusStore((state) => state.authSession);
  const sessionKey = authSession
    ? `${authSession.role}:${authSession.userId}:${authSession.loggedInAt}`
    : "no-session";
  const inFlightRef = useRef(false);
  const policyRef = useRef<SyncPolicy>(defaultSyncPolicyForRole("tenant"));
  const changeDueAtRef = useRef<number | undefined>(undefined);
  const intervalDueAtRef = useRef<number | undefined>(undefined);
  const suppressChangeDetectionUntilRef = useRef<number>(0);
  const lastFingerprintRef = useRef<string | undefined>(undefined);
  const hasBootstrappedRef = useRef(false);
  const setUnsynced = useSyncStatusStore((store) => store.setUnsynced);
  const setSyncing = useSyncStatusStore((store) => store.setSyncing);
  const setSynced = useSyncStatusStore((store) => store.setSynced);
  const setNextSyncAt = useSyncStatusStore((store) => store.setNextSyncAt);
  const setError = useSyncStatusStore((store) => store.setError);
  const reset = useSyncStatusStore((store) => store.reset);

  useEffect(() => {
    const hostname = typeof window !== "undefined" ? window.location.hostname.toLowerCase() : "";
    const pathname = typeof window !== "undefined" ? window.location.pathname : "";
    const isPublicWebsiteHost =
      hostname === "propiedades.colonus.lat" ||
      hostname === "www.colonus.lat" ||
      hostname === "colonus.lat";
    const isPublicWebsitePath = pathname === "/" || pathname.startsWith("/website") || pathname.startsWith("/available-units");
    if (isPublicWebsiteHost || isPublicWebsitePath) {
      reset();
      return;
    }

    let mounted = true;
    const readRaw = (key: string): string => window.localStorage.getItem(key) ?? "";
    const getSyncFingerprint = (): string =>
      [
        readRaw(getStorageKeys().state),
        readRaw(getStorageKeys().outbox),
        readRaw(getStorageKeys().changeLog),
        readRaw(getStorageKeys().tenantGrades)
      ].join("|");

    const applyPolicy = (policy: SyncPolicy): void => {
      policyRef.current = policy;

      if (!policy.enabled) {
        changeDueAtRef.current = undefined;
        intervalDueAtRef.current = undefined;
        setNextSyncAt(undefined);
        return;
      }

      if (policy.mode === "interval" || policy.mode === "hybrid") {
        intervalDueAtRef.current = Date.now() + Math.max(1, policy.intervalSeconds) * 1000;
      } else {
        intervalDueAtRef.current = undefined;
      }

      if (policy.mode === "interval") {
        changeDueAtRef.current = undefined;
      } else if (changeDueAtRef.current) {
        changeDueAtRef.current =
          Date.now() + Math.max(1, policy.delayAfterChangeSeconds) * 1000;
      }
    };

    const refreshPolicyFromServer = async (): Promise<void> => {
      const session = useColonusStore.getState().authSession;
      if (!session) return;
      const role = getPolicyRoleForSession(session.role);
      try {
        const remotePolicy = await getSyncPolicyByRole(role);
        applyPolicy(remotePolicy);
        writeCachedPolicy(remotePolicy);
      } catch {
        // Keep active policy when policy endpoint is unavailable.
      }
    };

    const runSync = async (mode: "pull_only" | "pull_and_push" = "pull_and_push"): Promise<void> => {
      if (inFlightRef.current) return;
      const current = useColonusStore.getState();
      const context = safeRolePropertyScope(current);
      if (!context.userId || !context.landlordId) {
        changeDueAtRef.current = undefined;
        lastFingerprintRef.current = undefined;
        hasBootstrappedRef.current = false;
        setNextSyncAt(undefined);
        reset();
        return;
      }

      inFlightRef.current = true;
      setNextSyncAt(undefined);
      setSyncing();

      try {
        const syncMeta = readSyncMeta();
        let remoteVersion = await getMergedVersion(context.landlordId);
        const localVersion = syncMeta.byLandlord[context.landlordId]?.lastAppliedMergedVersion ?? 0;
        if (remoteVersion > localVersion) {
          const merged = await getMergedSnapshot(context.landlordId);
          suppressChangeDetectionUntilRef.current = Date.now() + 2_000;
          applyMergedSnapshot({
            mergedState: merged.merged.state,
            mergedOutbox: merged.merged.outbox,
            mergedChangeLog: merged.merged.changeLog,
            mergedTenantGrades: merged.merged.tenantGrades
          });
          syncMeta.byLandlord[context.landlordId] = {
            lastAppliedMergedVersion: merged.mergedVersion,
            lastSyncedAt: new Date().toISOString()
          };
        } else {
          syncMeta.byLandlord[context.landlordId] = {
            lastAppliedMergedVersion: localVersion,
            lastSyncedAt: new Date().toISOString()
          };
        }

        if (mode === "pull_and_push") {
          const snapshot = buildLocalSnapshotPayload();
          const uploadResult = await uploadSnapshot({
            landlordId: context.landlordId,
            userId: context.userId,
            snapshot,
            uploadedAt: new Date().toISOString()
          });
          remoteVersion = uploadResult.mergedVersion;
          const appliedVersion = syncMeta.byLandlord[context.landlordId]?.lastAppliedMergedVersion ?? 0;
          if (remoteVersion > appliedVersion) {
            const merged = await getMergedSnapshot(context.landlordId);
            suppressChangeDetectionUntilRef.current = Date.now() + 2_000;
            applyMergedSnapshot({
              mergedState: merged.merged.state,
              mergedOutbox: merged.merged.outbox,
              mergedChangeLog: merged.merged.changeLog,
              mergedTenantGrades: merged.merged.tenantGrades
            });
            syncMeta.byLandlord[context.landlordId] = {
              lastAppliedMergedVersion: merged.mergedVersion,
              lastSyncedAt: new Date().toISOString()
            };
          }
        }

        writeSyncMeta(syncMeta);
        changeDueAtRef.current = undefined;
        setNextSyncAt(undefined);
        if (policyRef.current.mode === "interval") {
          const intervalMs = Math.max(1, policyRef.current.intervalSeconds) * 1000;
          intervalDueAtRef.current = Date.now() + intervalMs;
          setNextSyncAt(new Date(intervalDueAtRef.current).toISOString());
        }
        await refreshPolicyFromServer();
        setNextSyncFromSchedules();
        lastFingerprintRef.current = getSyncFingerprint();
        if (mounted) setSynced(new Date().toISOString());
      } catch (error) {
        const retryMs = Math.max(1, policyRef.current.retryBackoffSeconds) * 1000;
        changeDueAtRef.current = Date.now() + retryMs;
        setNextSyncAt(new Date(changeDueAtRef.current).toISOString());
        if (mounted) {
          setError(error instanceof Error ? error.message : "Auto sync failed.");
        }
      } finally {
        inFlightRef.current = false;
      }
    };

    const runSuperAdminBootstrap = async (): Promise<void> => {
      const current = useColonusStore.getState();
      const session = current.authSession;
      if (!session || session.role !== "super_admin") return;
      if (inFlightRef.current) return;

      inFlightRef.current = true;
      setSyncing();
      try {
        const syncMeta = readSyncMeta();
        const landlordIds = await getLandlordsWithMergedSnapshots();
        for (const landlordId of landlordIds) {
          const remoteVersion = await getMergedVersion(landlordId);
          const localVersion = syncMeta.byLandlord[landlordId]?.lastAppliedMergedVersion ?? 0;
          if (remoteVersion <= localVersion) continue;
          const merged = await getMergedSnapshot(landlordId);
          suppressChangeDetectionUntilRef.current = Date.now() + 2_000;
          applyMergedSnapshot({
            mergedState: merged.merged.state,
            mergedOutbox: merged.merged.outbox,
            mergedChangeLog: merged.merged.changeLog,
            mergedTenantGrades: merged.merged.tenantGrades
          });
          syncMeta.byLandlord[landlordId] = {
            lastAppliedMergedVersion: merged.mergedVersion,
            lastSyncedAt: new Date().toISOString()
          };
        }
        writeSyncMeta(syncMeta);
        if (policyRef.current.mode === "interval") {
          const intervalMs = Math.max(1, policyRef.current.intervalSeconds) * 1000;
          intervalDueAtRef.current = Date.now() + intervalMs;
          setNextSyncAt(new Date(intervalDueAtRef.current).toISOString());
        }
        await refreshPolicyFromServer();
        setNextSyncFromSchedules();
        lastFingerprintRef.current = getSyncFingerprint();
        setSynced(new Date().toISOString());
      } catch (error) {
        setError(error instanceof Error ? error.message : "Initial bootstrap sync failed.");
      } finally {
        inFlightRef.current = false;
      }
    };

    const ensureBootstrap = (): void => {
      if (hasBootstrappedRef.current) return;
      lastFingerprintRef.current = getSyncFingerprint();
      hasBootstrappedRef.current = true;
    };

    const setNextSyncFromSchedules = (): void => {
      const candidates = [changeDueAtRef.current, intervalDueAtRef.current].filter(
        (value): value is number => typeof value === "number"
      );
      if (candidates.length === 0) {
        setNextSyncAt(undefined);
        return;
      }
      const nextAt = Math.min(...candidates);
      setNextSyncAt(new Date(nextAt).toISOString());
    };

    const checkForLocalChanges = (): void => {
      ensureBootstrap();
      if (Date.now() < suppressChangeDetectionUntilRef.current) return;
      const nextFingerprint = getSyncFingerprint();
      if (nextFingerprint === lastFingerprintRef.current) return;
      lastFingerprintRef.current = nextFingerprint;
      const changedAt = new Date().toISOString();
      const mode = policyRef.current.mode;
      if (mode === "after_change" || mode === "hybrid") {
        const delayMs = Math.max(1, policyRef.current.delayAfterChangeSeconds) * 1000;
        changeDueAtRef.current = Date.now() + delayMs;
      }
      setNextSyncFromSchedules();
      setUnsynced(changedAt);
    };

    const onTick = (now: number): void => {
      const current = useColonusStore.getState();
      const session = current.authSession;
      if (!session) return;
      if (!policyRef.current.enabled) return;

      if (session.role === "super_admin") {
        checkForLocalChanges();
        const dueByChange = changeDueAtRef.current && now >= changeDueAtRef.current;
        const dueByInterval = intervalDueAtRef.current && now >= intervalDueAtRef.current;
        if (dueByChange || dueByInterval) {
          if (dueByInterval) {
            if (policyRef.current.mode === "interval" || policyRef.current.mode === "hybrid") {
              const intervalMs = Math.max(1, policyRef.current.intervalSeconds) * 1000;
              intervalDueAtRef.current = now + intervalMs;
            } else {
              intervalDueAtRef.current = undefined;
            }
          }
          void runSuperAdminBootstrap();
          return;
        }
        setNextSyncFromSchedules();
        return;
      }

      const context = safeRolePropertyScope(current);
      if (!context.userId || !context.landlordId) return;
      checkForLocalChanges();
      const dueByChange = changeDueAtRef.current && now >= changeDueAtRef.current;
      const dueByInterval = intervalDueAtRef.current && now >= intervalDueAtRef.current;
      if (dueByChange || dueByInterval) {
        if (dueByInterval) {
          if (policyRef.current.mode === "interval" || policyRef.current.mode === "hybrid") {
            const intervalMs = Math.max(1, policyRef.current.intervalSeconds) * 1000;
            intervalDueAtRef.current = now + intervalMs;
          } else {
            intervalDueAtRef.current = undefined;
          }
        }
        void runSync();
        return;
      }
      setNextSyncFromSchedules();
    };

    const unsubscribeTick = useIntervalServiceStore.subscribe((state, previousState) => {
      if (state.nowMs === previousState.nowMs) return;
      onTick(state.nowMs);
    });

    const onFocus = (): void => {
      if (document.visibilityState !== "visible") return;
      const session = useColonusStore.getState().authSession;
      if (!session) return;
      checkForLocalChanges();
      const now = Date.now();
      const dueByChange = changeDueAtRef.current && now >= changeDueAtRef.current;
      const dueByInterval = intervalDueAtRef.current && now >= intervalDueAtRef.current;
      if (dueByChange || dueByInterval) {
        if (session.role === "super_admin") {
          void runSuperAdminBootstrap();
        } else {
          void runSync("pull_and_push");
        }
      }
    };
    const onManualSync = (): void => {
      const session = useColonusStore.getState().authSession;
      if (!session) return;
      changeDueAtRef.current = undefined;
      setNextSyncAt(undefined);
      if (session.role === "super_admin") {
        void runSuperAdminBootstrap();
      } else {
        void runSync("pull_and_push");
      }
    };
    document.addEventListener("visibilitychange", onFocus);
    window.addEventListener("focus", onFocus);
    window.addEventListener("colonus:sync-now", onManualSync);
    ensureBootstrap();
    void (async () => {
      const session = useColonusStore.getState().authSession;
      const role = session ? getPolicyRoleForSession(session.role) : "tenant";
      applyPolicy(readCachedPolicy(role) ?? defaultSyncPolicyForRole(role));
      try {
        const remotePolicy = await getSyncPolicyByRole(role);
        applyPolicy(remotePolicy);
        writeCachedPolicy(remotePolicy);
      } catch {
        // Keep cached/default policy when API is unavailable.
      }

      setNextSyncFromSchedules();

      if (!policyRef.current.initialHydrationOnLogin) return;
      if (session?.role === "super_admin") {
        void runSuperAdminBootstrap();
        return;
      }
      if (policyRef.current.forceSyncOnLogin) {
        void runSync("pull_and_push");
      } else {
        void runSync("pull_only");
      }
    })();

    return () => {
      mounted = false;
      unsubscribeTick();
      document.removeEventListener("visibilitychange", onFocus);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("colonus:sync-now", onManualSync);
    };
  }, [reset, setError, setNextSyncAt, setSynced, setSyncing, setUnsynced, sessionKey]);
};
