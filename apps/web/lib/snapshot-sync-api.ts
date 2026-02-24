import { getStorageKeys } from "@colonus/shared";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

export interface SnapshotPayload {
  state: Record<string, unknown>;
  outbox: Array<Record<string, unknown>>;
  changeLog: Array<Record<string, unknown>>;
  tenantGrades: unknown;
}

export interface MergedSnapshotPayload {
  landlordId: string;
  mergedVersion: number;
  generatedAt: string;
  merged: {
    state: Record<string, unknown>;
    outbox: Array<Record<string, unknown>>;
    changeLog: Array<{ logId: string; timestamp: string; mutation: Record<string, unknown> }>;
    tenantGrades: unknown;
  };
}

interface PersistedEnvelope<T> {
  state?: T;
  version?: number;
}

const readJson = <T>(key: string, fallback: T): T => {
  if (typeof window === "undefined") return fallback;
  const raw = window.localStorage.getItem(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
};

const ensureOk = async (response: Response, fallback: string): Promise<void> => {
  if (response.ok) return;
  let message = fallback;
  try {
    const body = (await response.json()) as { error?: string };
    if (body.error) message = body.error;
  } catch {
    // Ignore parse failure
  }
  throw new Error(message);
};

const readPersistedState = <T>(key: string, fallback: T): T => {
  const raw = readJson<unknown>(key, fallback as unknown);
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return fallback;
  const envelope = raw as PersistedEnvelope<T>;
  if (envelope.state && typeof envelope.state === "object") {
    return envelope.state;
  }
  return raw as T;
};

export const buildLocalSnapshotPayload = (): SnapshotPayload => ({
  state: readPersistedState<Record<string, unknown>>(getStorageKeys().state, {}),
  outbox: readJson<Array<Record<string, unknown>>>(getStorageKeys().outbox, []),
  changeLog: readJson<Array<Record<string, unknown>>>(getStorageKeys().changeLog, []),
  tenantGrades: readPersistedState<unknown>(getStorageKeys().tenantGrades, [])
});

export const uploadSnapshot = async (input: {
  landlordId: string;
  userId: string;
  snapshot: SnapshotPayload;
  uploadedAt?: string;
}): Promise<{ mergedVersion: number }> => {
  const response = await fetch(`${API_BASE_URL}/api/sync/upload-snapshot`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input)
  });
  await ensureOk(response, "Snapshot upload failed.");
  const body = (await response.json()) as { mergedVersion: number };
  return { mergedVersion: body.mergedVersion };
};

export const getMergedVersion = async (landlordId: string): Promise<number> => {
  const response = await fetch(
    `${API_BASE_URL}/api/sync/version/${encodeURIComponent(landlordId)}`
  );
  await ensureOk(response, "Merged version fetch failed.");
  const body = (await response.json()) as { mergedVersion?: number };
  return typeof body.mergedVersion === "number" ? body.mergedVersion : 0;
};

export const getMergedSnapshot = async (landlordId: string): Promise<MergedSnapshotPayload> => {
  const response = await fetch(
    `${API_BASE_URL}/api/sync/merged/${encodeURIComponent(landlordId)}`
  );
  await ensureOk(response, "Merged snapshot fetch failed.");
  return (await response.json()) as MergedSnapshotPayload;
};

export const getLandlordsWithMergedSnapshots = async (): Promise<string[]> => {
  const response = await fetch(`${API_BASE_URL}/api/sync/landlords-with-merged`);
  await ensureOk(response, "Merged landlord index fetch failed.");
  const body = (await response.json()) as { landlordIds?: string[] };
  return Array.isArray(body.landlordIds) ? body.landlordIds : [];
};
