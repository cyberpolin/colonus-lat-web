const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

export interface SyncHistoryFileItem {
  publicId: string;
  secureUrl: string;
  createdAt: string | null;
}

const ensureOk = async (response: Response, fallback: string): Promise<void> => {
  if (response.ok) return;
  let message = fallback;
  try {
    const body = (await response.json()) as { error?: string };
    if (body.error) message = body.error;
  } catch {
    // Ignore parse failure.
  }
  throw new Error(message);
};

export const getSyncHistoryList = async (
  landlordId: string
): Promise<SyncHistoryFileItem[]> => {
  const response = await fetch(
    `${API_BASE_URL}/api/sync/history/${encodeURIComponent(landlordId)}`
  );
  await ensureOk(response, "Failed to load sync history.");
  const body = (await response.json()) as { files?: SyncHistoryFileItem[] };
  return Array.isArray(body.files) ? body.files : [];
};

export const getSyncHistoryFileContent = async (
  publicId: string
): Promise<unknown> => {
  const url = new URL(`${API_BASE_URL}/api/sync/history-file`);
  url.searchParams.set("publicId", publicId);
  const response = await fetch(url.toString());
  await ensureOk(response, "Failed to load history file content.");
  const body = (await response.json()) as { payload?: unknown };
  return body.payload;
};
