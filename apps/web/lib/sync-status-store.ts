"use client";

import { create } from "zustand";

export type SyncStatus = "idle" | "unsynced" | "syncing" | "synced" | "error";

interface SyncStatusState {
  status: SyncStatus;
  lastChangedAt?: string;
  lastSyncedAt?: string;
  nextSyncAt?: string;
  errorMessage?: string;
  setUnsynced: (at?: string) => void;
  setSyncing: () => void;
  setSynced: (at: string) => void;
  setNextSyncAt: (at?: string) => void;
  setError: (message: string) => void;
  reset: () => void;
}

export const useSyncStatusStore = create<SyncStatusState>((set) => ({
  status: "idle",
  lastChangedAt: undefined,
  lastSyncedAt: undefined,
  nextSyncAt: undefined,
  errorMessage: undefined,
  setUnsynced: (at) =>
    set((state) => ({
      ...state,
      status: "unsynced",
      lastChangedAt: at ?? new Date().toISOString(),
      errorMessage: undefined
    })),
  setSyncing: () => set((state) => ({ ...state, status: "syncing", errorMessage: undefined })),
  setSynced: (at) =>
    set((state) => ({
      ...state,
      status: "synced",
      lastSyncedAt: at,
      errorMessage: undefined
    })),
  setNextSyncAt: (at) =>
    set((state) => ({
      ...state,
      nextSyncAt: at
    })),
  setError: (message) =>
    set((state) => ({
      ...state,
      status: "error",
      errorMessage: message
    })),
  reset: () =>
    set({
      status: "idle",
      lastChangedAt: undefined,
      lastSyncedAt: undefined,
      nextSyncAt: undefined,
      errorMessage: undefined
    })
}));
