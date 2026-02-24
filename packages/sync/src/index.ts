import { STORAGE_KEYS, type SyncMutation } from "@colonus/shared";

const MAX_RETRIES = 5;
export interface ChangeLogEntry {
  logId: string;
  timestamp: string;
  mutation: SyncMutation;
}

const readOutbox = (): SyncMutation[] => {
  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(STORAGE_KEYS.outbox);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw) as SyncMutation[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeOutbox = (queue: SyncMutation[]): void => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEYS.outbox, JSON.stringify(queue));
};

const readChangeLog = (): ChangeLogEntry[] => {
  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(STORAGE_KEYS.changeLog);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as ChangeLogEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeChangeLog = (entries: ChangeLogEntry[]): void => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEYS.changeLog, JSON.stringify(entries));
};

const appendChangeLogEntry = (mutation: SyncMutation): void => {
  const current = readChangeLog();
  const nextEntry: ChangeLogEntry = {
    logId: mutation.mutationId,
    timestamp: new Date().toISOString(),
    mutation
  };
  writeChangeLog([...current, nextEntry]);
};

export const enqueueMutation = (mutation: SyncMutation): SyncMutation[] => {
  const queue = readOutbox();
  const next = [...queue, mutation];
  writeOutbox(next);
  appendChangeLogEntry(mutation);
  return next;
};

export const markMutation = (
  mutationId: string,
  status: SyncMutation["status"]
): SyncMutation[] => {
  const queue = readOutbox().map((item) =>
    item.mutationId === mutationId ? { ...item, status } : item
  );
  writeOutbox(queue);
  return queue;
};

export const retryFailedMutation = (mutationId: string): SyncMutation[] => {
  const queue = readOutbox().map((item) => {
    if (item.mutationId !== mutationId) return item;
    if (item.retries >= MAX_RETRIES) {
      return { ...item, status: "needsReview" as const };
    }

    return {
      ...item,
      retries: item.retries + 1,
      status: "queued" as const
    };
  });

  writeOutbox(queue);
  return queue;
};

export const getOutboxQueue = (): SyncMutation[] => readOutbox();

export const clearOutbox = (): void => {
  writeOutbox([]);
};

export const replaceOutbox = (queue: SyncMutation[]): void => {
  writeOutbox(queue);
};

export const getChangeLog = (): ChangeLogEntry[] => readChangeLog();

export const clearChangeLog = (): void => {
  writeChangeLog([]);
};

export const replaceChangeLog = (entries: ChangeLogEntry[]): void => {
  writeChangeLog(entries);
};

export const processOutbox = async (): Promise<SyncMutation[]> => {
  // Placeholder for future Keystone sync transport.
  // Keeps local-first guarantee by running async and never blocking UI writes.
  const queue = readOutbox().map((item) => ({ ...item, status: "queued" as const }));
  writeOutbox(queue);
  return queue;
};
