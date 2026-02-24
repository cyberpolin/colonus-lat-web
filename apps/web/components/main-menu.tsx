"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useIntervalServiceStore } from "@/lib/interval-service";
import menuByRole from "@/lib/main-menu.by-role.json";
import { useSyncStatusStore } from "@/lib/sync-status-store";
import type { UserRole } from "@colonus/shared";

type MainMenuAction = "seedFake" | "clearDatabase";

interface MenuItem {
  id: string;
  label: string;
  type: "link" | "action";
  href?: string;
  action?: MainMenuAction;
  badge?: "draft";
}

interface RoleMenuConfig {
  title: string;
  items: MenuItem[];
}

interface MainMenuProps {
  visible: boolean;
  role: UserRole;
  hasClientDraft?: boolean;
  freeTrialUsage?: {
    count: number;
    limit: number;
  };
  onSeedFake?: () => void | Promise<void>;
  onClearDatabase?: () => void | Promise<void>;
}

const config = menuByRole as Record<UserRole, RoleMenuConfig>;

export function MainMenu({
  visible,
  role,
  hasClientDraft = false,
  freeTrialUsage,
  onSeedFake,
  onClearDatabase
}: MainMenuProps) {
  const isDevMode = process.env.NODE_ENV === "development";
  const [activeAction, setActiveAction] = useState<MainMenuAction | undefined>();
  const syncStatus = useSyncStatusStore((store) => store.status);
  const syncError = useSyncStatusStore((store) => store.errorMessage);
  const syncLastSyncedAt = useSyncStatusStore((store) => store.lastSyncedAt);
  const syncNextAt = useSyncStatusStore((store) => store.nextSyncAt);
  const nowMs = useIntervalServiceStore((store) => store.nowMs);
  const [showSynced, setShowSynced] = useState(true);
  const roleMenu = config[role];
  const title =
    role === "super_admin"
      ? "super-admin-menu-title"
      : role === "landlord"
        ? "landlord-menu-title"
        : "tenant-menu-title";
  const showSyncState = role === "tenant" || role === "landlord" || role === "super_admin";
  const syncLabel =
    syncStatus === "syncing"
      ? "Syncing"
      : syncStatus === "synced"
        ? "Synced"
        : syncStatus === "error"
          ? "Sync error"
          : syncStatus === "unsynced"
            ? "Not synced"
            : "Local only";
  const syncIconClassName =
    syncStatus === "syncing"
      ? "text-slate-500"
      : syncStatus === "synced"
        ? "text-emerald-600"
        : "text-red-600";
  const syncTitle =
    syncStatus === "error"
      ? syncError ?? "Auto sync failed."
      : syncLastSyncedAt
        ? `Last sync: ${new Date(syncLastSyncedAt).toLocaleTimeString()}`
        : "Waiting for first sync.";
  const showSyncPill = useMemo(() => {
    if (!showSyncState) return false;
    if (syncNextAt) return true;
    if (isDevMode) return true;
    if (syncStatus !== "synced") return true;
    return showSynced;
  }, [isDevMode, showSyncState, showSynced, syncNextAt, syncStatus]);
  const countdownLabel = useMemo(() => {
    if (!syncNextAt) return undefined;
    const diffMs = Math.max(0, new Date(syncNextAt).getTime() - nowMs);
    const totalSeconds = Math.floor(diffMs / 1000);
    const minutes = Math.floor(totalSeconds / 60)
      .toString()
      .padStart(2, "0");
    const seconds = (totalSeconds % 60).toString().padStart(2, "0");
    return `${minutes}:${seconds}`;
  }, [nowMs, syncNextAt]);

  useEffect(() => {
    if (syncStatus !== "synced") {
      setShowSynced(true);
      return;
    }

    setShowSynced(true);
    const timeoutId = window.setTimeout(() => setShowSynced(false), 60_000);
    return () => window.clearTimeout(timeoutId);
  }, [syncStatus, syncLastSyncedAt]);

  if (!visible) return null;

  return (
    <div
      id="main-menu-banner"
      className="fixed inset-x-0 top-0 z-50 border-b border-slate-200 bg-white/95 backdrop-blur"
    >
      <div
        id="main-menu-content"
        className="mx-auto flex max-w-6xl items-center justify-between px-4 py-2 md:px-6"
      >
        <p id={title} className="text-xs uppercase tracking-[0.2em] text-slate-500">
          {roleMenu.title}
        </p>
        <div id="main-menu-actions" className="flex items-center gap-2">
          {showSyncPill &&
            (isDevMode ? (
              <button
                type="button"
                id="main-menu-sync-status"
                title={`${syncTitle} Click to sync now.`}
                onClick={() => window.dispatchEvent(new Event("colonus:sync-now"))}
                className="mr-2 inline-flex items-center gap-1 rounded border border-slate-300 bg-slate-50 px-2 py-1 text-[11px] text-slate-700 hover:border-slate-400"
              >
                <span
                  aria-hidden
                  className={`${syncIconClassName} ${syncStatus === "syncing" ? "animate-pulse" : ""}`}
                >
                  ●
                </span>
                {syncLabel}
                {countdownLabel ? ` · ${countdownLabel}` : ""}
              </button>
            ) : (
              <p
                id="main-menu-sync-status"
                title={syncTitle}
                className="mr-2 inline-flex items-center gap-1 rounded border border-slate-300 bg-slate-50 px-2 py-1 text-[11px] text-slate-700"
              >
                <span
                  aria-hidden
                  className={`${syncIconClassName} ${syncStatus === "syncing" ? "animate-pulse" : ""}`}
                >
                  ●
                </span>
                {syncLabel}
              </p>
            ))}
          {freeTrialUsage && (
            <div
              id="main-menu-free-trial-gauge"
              className="group relative mr-2 min-w-36 rounded border border-slate-300 bg-slate-50 px-2 py-1"
            >
              <p className="text-[10px] uppercase tracking-wide text-slate-600">
                Free trial {freeTrialUsage.count}/{freeTrialUsage.limit}
              </p>
              <div className="mt-1 h-1.5 w-full overflow-hidden rounded bg-slate-200">
                <div
                  className="h-full bg-slate-700"
                  style={{
                    width: `${Math.min(100, Math.round((freeTrialUsage.count / freeTrialUsage.limit) * 100))}%`
                  }}
                />
              </div>
              <Link
                href="/website/upgrade"
                id="main-menu-free-trial-upgrade"
                className="pointer-events-none absolute inset-0 flex items-center justify-center rounded bg-white/95 text-[11px] font-semibold text-slate-800 opacity-0 transition-opacity group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100"
              >
                Upgrade
              </Link>
            </div>
          )}
          {roleMenu.items.map((item) => {
            const sharedClassName =
              "inline-flex items-center gap-1 rounded border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:border-slate-500";

            if (item.type === "link" && item.href) {
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  id={`main-menu-link-${item.id}`}
                  className={sharedClassName}
                >
                  {item.label}
                  {item.badge === "draft" && hasClientDraft && (
                    <span className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-slate-500 text-[10px] leading-none">
                      !
                    </span>
                  )}
                </Link>
              );
            }

            if (item.type === "action" && item.action) {
              const isLoading = activeAction === item.action;
              return (
                <button
                  key={item.id}
                  type="button"
                  id={`main-menu-action-${item.id}`}
                  onClick={async () => {
                    setActiveAction(item.action);
                    try {
                      if (item.action === "seedFake") await onSeedFake?.();
                      if (item.action === "clearDatabase") await onClearDatabase?.();
                    } finally {
                      setActiveAction(undefined);
                    }
                  }}
                  disabled={Boolean(activeAction)}
                  className={`${sharedClassName} disabled:opacity-60`}
                >
                  {isLoading ? `${item.label}...` : item.label}
                </button>
              );
            }

            return null;
          })}
        </div>
      </div>
    </div>
  );
}
