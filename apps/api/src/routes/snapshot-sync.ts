import crypto from "node:crypto";
import express, { type Express, type Request, type Response } from "express";
import {
  getCloudinaryRawResource,
  listCloudinaryRawResourcesByPrefix,
  uploadJsonToCloudinary
} from "../cloudinary";

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

interface SnapshotUploadPayload {
  landlordId: string;
  userId: string;
  snapshot: {
    state?: Record<string, unknown>;
    outbox?: Array<Record<string, unknown>>;
    changeLog?: Array<Record<string, unknown>>;
    tenantGrades?: unknown;
  };
  uploadedAt?: string;
}

interface StoredClientSnapshot {
  landlordId: string;
  userId: string;
  uploadedAt: string;
  snapshot: SnapshotUploadPayload["snapshot"];
}

const router = express.Router();

const ENTITY_COLLECTION_KEYS = [
  "superAdmins",
  "landlords",
  "tenants",
  "properties",
  "propertySubscriptions",
  "propertyProofSettings",
  "paymentSubmissions",
  "careProofSubmissions",
  "propertyExpenses",
  "fixRequests",
  "permissionRequests",
  "refundRequests",
  "tickets",
  "paymentPeriods"
] as const;

const asSafeSegment = (value: string): string =>
  value
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .replace(/_+/g, "_");

const safeIsoForFile = (iso: string): string => iso.replace(/[:.]/g, "-");

const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

const asObject = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

const normalizePersistedState = (value: unknown): Record<string, unknown> => {
  const objectValue = asObject(value);
  const nestedState = asObject(objectValue.state);
  return Object.keys(nestedState).length > 0 ? nestedState : objectValue;
};

const normalizePersistedTenantGrades = (value: unknown): unknown[] => {
  if (Array.isArray(value)) return value;
  const objectValue = asObject(value);
  const nestedState = asObject(objectValue.state);
  const nestedGrades = nestedState.tenantGrades;
  return Array.isArray(nestedGrades) ? nestedGrades : [];
};

const isRecordWithId = (value: unknown): value is Record<string, unknown> & { id: string } =>
  Boolean(value && typeof value === "object" && !Array.isArray(value) && typeof (value as { id?: unknown }).id === "string");

const parseIsoScore = (value: unknown): number => {
  if (typeof value !== "string") return 0;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
};

const pickNewestEntity = (
  current: Record<string, unknown> | undefined,
  incoming: Record<string, unknown>
): Record<string, unknown> => {
  if (!current) return incoming;
  const currentScore = Math.max(parseIsoScore(current.updatedAt), parseIsoScore(current.createdAt));
  const incomingScore = Math.max(parseIsoScore(incoming.updatedAt), parseIsoScore(incoming.createdAt));
  return incomingScore >= currentScore ? incoming : current;
};

const landlordBaseFolder = (landlordId: string): string => `colonus/${asSafeSegment(landlordId)}/db`;
const latestPublicId = (landlordId: string, userId: string): string =>
  `${landlordBaseFolder(landlordId)}/latest/${asSafeSegment(userId)}`;
const historyPublicId = (landlordId: string, userId: string, fileName: string): string =>
  `${landlordBaseFolder(landlordId)}/history/${asSafeSegment(userId)}/${fileName}`;
const mergedPublicId = (landlordId: string): string =>
  `${landlordBaseFolder(landlordId)}/merged/merged`;
const mergedMetaPublicId = (landlordId: string): string =>
  `${landlordBaseFolder(landlordId)}/merged/meta`;
const historyPrefix = (landlordId: string): string =>
  `${landlordBaseFolder(landlordId)}/history/`;

const readCloudinaryJson = async <T>(publicId: string): Promise<T | undefined> => {
  const resource = await getCloudinaryRawResource(publicId);
  if (!resource?.secure_url) return undefined;
  const response = await fetch(resource.secure_url);
  if (!response.ok) return undefined;
  return (await response.json()) as T;
};

const collectLatestClientSnapshots = async (
  landlordId: string
): Promise<StoredClientSnapshot[]> => {
  const prefix = `${landlordBaseFolder(landlordId)}/latest/`;
  const resources = await listCloudinaryRawResourcesByPrefix(prefix);
  const snapshots = await Promise.all(
    resources.map(async (resource) => {
      const response = await fetch(resource.secure_url);
      if (!response.ok) return undefined;
      try {
        return (await response.json()) as StoredClientSnapshot;
      } catch {
        return undefined;
      }
    })
  );
  return snapshots.filter((item): item is StoredClientSnapshot => Boolean(item));
};

const dedupeMutations = (items: Array<Record<string, unknown>>): Array<Record<string, unknown>> => {
  const byId = new Map<string, Record<string, unknown>>();
  items.forEach((item) => {
    const mutationId = typeof item.mutationId === "string" ? item.mutationId : undefined;
    if (!mutationId) return;
    const existing = byId.get(mutationId);
    if (!existing) {
      byId.set(mutationId, item);
      return;
    }
    const existingTs = parseIsoScore(existing.timestamp);
    const incomingTs = parseIsoScore(item.timestamp);
    if (incomingTs >= existingTs) byId.set(mutationId, item);
  });
  return Array.from(byId.values()).sort(
    (a, b) => parseIsoScore(a.timestamp) - parseIsoScore(b.timestamp)
  );
};

const mergeEntityCollection = (
  states: Array<Record<string, unknown>>,
  key: string
): Array<Record<string, unknown>> => {
  const map = new Map<string, Record<string, unknown>>();
  states.forEach((state) => {
    const normalizedState = normalizePersistedState(state);
    asArray(normalizedState[key]).forEach((item) => {
      if (!isRecordWithId(item)) return;
      const current = map.get(item.id);
      map.set(item.id, pickNewestEntity(current, item));
    });
  });
  return Array.from(map.values());
};

const mergeSyncUsageByProperty = (states: Array<Record<string, unknown>>): Record<string, unknown> => {
  const merged: Record<string, { date: string; count: number }> = {};
  states.forEach((state) => {
    const normalizedState = normalizePersistedState(state);
    const usage = asObject(normalizedState.syncUsageByProperty);
    Object.entries(usage).forEach(([propertyId, raw]) => {
      const entry = asObject(raw);
      const date = typeof entry.date === "string" ? entry.date : "";
      const count = typeof entry.count === "number" ? entry.count : 0;
      const existing = merged[propertyId];
      if (!existing) {
        merged[propertyId] = { date, count };
        return;
      }
      if (date > existing.date) {
        merged[propertyId] = { date, count };
        return;
      }
      if (date === existing.date && count > existing.count) {
        merged[propertyId] = { date, count };
      }
    });
  });
  return merged;
};

const mergeTenantGrades = (snapshots: StoredClientSnapshot[]): unknown => {
  const allGrades = snapshots.flatMap((item) =>
    normalizePersistedTenantGrades(item.snapshot.tenantGrades)
  );
  const byPair = new Map<string, Record<string, unknown>>();
  allGrades.forEach((raw) => {
    if (!isRecordWithId(raw)) return;
    const propertyId = typeof raw.propertyId === "string" ? raw.propertyId : "";
    const tenantId = typeof raw.tenantId === "string" ? raw.tenantId : "";
    if (!propertyId || !tenantId) return;
    const key = `${propertyId}:${tenantId}`;
    const existing = byPair.get(key);
    if (!existing) {
      byPair.set(key, raw);
      return;
    }
    const existingVersion = typeof existing.version === "number" ? existing.version : 0;
    const incomingVersion = typeof raw.version === "number" ? raw.version : 0;
    if (incomingVersion > existingVersion) {
      byPair.set(key, raw);
      return;
    }
    if (incomingVersion === existingVersion) {
      const existingUpdated = parseIsoScore(existing.updatedAt);
      const incomingUpdated = parseIsoScore(raw.updatedAt);
      if (incomingUpdated >= existingUpdated) byPair.set(key, raw);
    }
  });
  return Array.from(byPair.values());
};

const buildMergedForLandlord = async (landlordId: string): Promise<{ mergedVersion: number }> => {
  const snapshots = await collectLatestClientSnapshots(landlordId);
  const states = snapshots.map((item) => normalizePersistedState(item.snapshot.state));
  const latestSnapshot = [...snapshots].sort((a, b) => parseIsoScore(b.uploadedAt) - parseIsoScore(a.uploadedAt))[0];
  const latestState = normalizePersistedState(latestSnapshot?.snapshot.state);

  const mergedState: Record<string, unknown> = {};
  ENTITY_COLLECTION_KEYS.forEach((key) => {
    mergedState[key] = mergeEntityCollection(states, key);
  });

  mergedState.syncUsageByProperty = mergeSyncUsageByProperty(states);
  mergedState.lastSyncNotice =
    latestState.lastSyncNotice && typeof latestState.lastSyncNotice === "string"
      ? latestState.lastSyncNotice
      : undefined;
  mergedState.themeColorHex =
    typeof latestState.themeColorHex === "string" ? latestState.themeColorHex : "#64748b";
  mergedState.themeHueRotate =
    typeof latestState.themeHueRotate === "number" ? latestState.themeHueRotate : 0;
  mergedState.devBannerCollapsed =
    typeof latestState.devBannerCollapsed === "boolean" ? latestState.devBannerCollapsed : false;
  mergedState.activeRole =
    typeof latestState.activeRole === "string" ? latestState.activeRole : "super_admin";
  mergedState.activeSuperAdminId =
    typeof latestState.activeSuperAdminId === "string" ? latestState.activeSuperAdminId : undefined;
  mergedState.activeLandlordId =
    typeof latestState.activeLandlordId === "string" ? latestState.activeLandlordId : undefined;
  mergedState.activeTenantId =
    typeof latestState.activeTenantId === "string" ? latestState.activeTenantId : undefined;
  mergedState.authSession = undefined;

  const mergedOutbox = dedupeMutations(
    snapshots.flatMap((item) => asArray(item.snapshot.outbox) as Array<Record<string, unknown>>)
  );
  const mergedChangeLog = dedupeMutations(
    snapshots.flatMap((item) =>
      asArray(item.snapshot.changeLog).map((entry) => asObject(entry).mutation).filter(Boolean) as Array<Record<string, unknown>>
    )
  );
  const mergedTenantGrades = mergeTenantGrades(snapshots);

  const existingMeta =
    (await readCloudinaryJson<{ mergedVersion: number }>(mergedMetaPublicId(landlordId))) ??
    { mergedVersion: 0 };
  const mergedVersion = existingMeta.mergedVersion + 1;

  const generatedAt = new Date().toISOString();
  const mergedPayload = {
    landlordId,
    mergedVersion,
    generatedAt,
    clients: snapshots.map((item) => ({
      userId: item.userId,
      uploadedAt: item.uploadedAt
    })),
    merged: {
      state: mergedState,
      outbox: mergedOutbox,
      changeLog: mergedChangeLog.map((mutation) => ({
        logId: typeof mutation.mutationId === "string" ? mutation.mutationId : crypto.randomUUID(),
        timestamp:
          typeof mutation.timestamp === "string" ? mutation.timestamp : new Date().toISOString(),
        mutation
      })),
      tenantGrades: mergedTenantGrades
    }
  };

  await uploadJsonToCloudinary({
    publicId: mergedPublicId(landlordId),
    data: mergedPayload,
    overwrite: true
  });
  await uploadJsonToCloudinary({
    publicId: mergedMetaPublicId(landlordId),
    data: { landlordId, mergedVersion, updatedAt: generatedAt },
    overwrite: true
  });

  return { mergedVersion };
};

router.post(
  "/api/sync/upload-snapshot",
  express.json({ limit: "15mb" }),
  async (req: Request, res: Response): Promise<void> => {
    const body = req.body as Partial<SnapshotUploadPayload> & { propertyId?: string };
    const landlordId =
      typeof body.landlordId === "string"
        ? body.landlordId.trim()
        : typeof body.propertyId === "string"
          ? body.propertyId.trim()
          : "";
    const userId = typeof body.userId === "string" ? body.userId.trim() : "";
    const snapshot = body.snapshot;

    if (!landlordId || !userId || !snapshot || typeof snapshot !== "object") {
      res.status(400).json({ error: "Missing landlordId, userId, or snapshot payload." });
      return;
    }

    const uploadedAt =
      typeof body.uploadedAt === "string" && !Number.isNaN(Date.parse(body.uploadedAt))
        ? body.uploadedAt
        : new Date().toISOString();

    const record: StoredClientSnapshot = {
      landlordId: asSafeSegment(landlordId),
      userId: asSafeSegment(userId),
      uploadedAt,
      snapshot: {
        state: asObject(snapshot.state),
        outbox: asArray(snapshot.outbox) as Array<Record<string, unknown>>,
        changeLog: asArray(snapshot.changeLog) as Array<Record<string, unknown>>,
        tenantGrades: snapshot.tenantGrades
      }
    };

    const checksum = crypto
      .createHash("sha1")
      .update(JSON.stringify(record.snapshot))
      .digest("hex")
      .slice(0, 10);
    const historyFile = `${safeIsoForFile(uploadedAt)}-${checksum}`;

    const latestId = latestPublicId(landlordId, userId);
    const historyId = historyPublicId(landlordId, userId, historyFile);

    await uploadJsonToCloudinary({ publicId: latestId, data: record, overwrite: true });
    await uploadJsonToCloudinary({ publicId: historyId, data: record, overwrite: false });

    const merged = await buildMergedForLandlord(landlordId);
    res.status(200).json({
      ok: true,
      landlordId,
      userId,
      uploadedAt,
      latestPublicId: latestId,
      historyPublicId: historyId,
      mergedVersion: merged.mergedVersion
    });
  }
);

router.post(
  "/api/sync/merge/:landlordId",
  async (req: Request, res: Response): Promise<void> => {
    const landlordId = typeof req.params.landlordId === "string" ? req.params.landlordId : "";
    if (!landlordId) {
      res.status(400).json({ error: "Missing landlordId." });
      return;
    }
    const merged = await buildMergedForLandlord(landlordId);
    res.status(200).json({ ok: true, landlordId, mergedVersion: merged.mergedVersion });
  }
);

router.get(
  "/api/sync/merged/:landlordId",
  async (req: Request, res: Response): Promise<void> => {
    const landlordId = typeof req.params.landlordId === "string" ? req.params.landlordId : "";
    if (!landlordId) {
      res.status(400).json({ error: "Missing landlordId." });
      return;
    }
    const merged = await readCloudinaryJson<Record<string, JsonValue>>(mergedPublicId(landlordId));
    if (!merged) {
      res.status(404).json({ error: "No merged snapshot yet." });
      return;
    }
    res.status(200).json(merged);
  }
);

router.get(
  "/api/sync/version/:landlordId",
  async (req: Request, res: Response): Promise<void> => {
    const landlordId = typeof req.params.landlordId === "string" ? req.params.landlordId : "";
    if (!landlordId) {
      res.status(400).json({ error: "Missing landlordId." });
      return;
    }
    const meta = await readCloudinaryJson<{ landlordId: string; mergedVersion: number; updatedAt: string }>(
      mergedMetaPublicId(landlordId)
    );
    if (!meta) {
      res.status(200).json({ landlordId, mergedVersion: 0, updatedAt: null });
      return;
    }
    res.status(200).json(meta);
  }
);

router.get(
  "/api/sync/landlords-with-merged",
  async (_req: Request, res: Response): Promise<void> => {
    const resources = await listCloudinaryRawResourcesByPrefix("colonus/");
    const landlordIds = new Set<string>();

    resources.forEach((resource) => {
      const parts = resource.public_id.split("/");
      // Expected: colonus/{landlordId}/db/merged/meta
      if (parts.length >= 5 && parts[0] === "colonus" && parts[2] === "db" && parts[3] === "merged" && parts[4] === "meta") {
        landlordIds.add(parts[1]);
      }
    });

    res.status(200).json({ landlordIds: Array.from(landlordIds).sort() });
  }
);

router.get(
  "/api/sync/history/:landlordId",
  async (req: Request, res: Response): Promise<void> => {
    const landlordId = typeof req.params.landlordId === "string" ? req.params.landlordId : "";
    if (!landlordId) {
      res.status(400).json({ error: "Missing landlordId." });
      return;
    }

    const resources = await listCloudinaryRawResourcesByPrefix(historyPrefix(landlordId));
    const files = resources
      .map((item) => ({
        publicId: item.public_id,
        secureUrl: item.secure_url,
        createdAt: item.created_at ?? null
      }))
      .sort((a, b) => parseIsoScore(b.createdAt) - parseIsoScore(a.createdAt));

    res.status(200).json({ landlordId, files });
  }
);

router.get(
  "/api/sync/history-file",
  async (req: Request, res: Response): Promise<void> => {
    const publicIdRaw = req.query.publicId;
    const publicId = typeof publicIdRaw === "string" ? publicIdRaw.trim() : "";
    if (!publicId) {
      res.status(400).json({ error: "Missing publicId." });
      return;
    }

    const resource = await getCloudinaryRawResource(publicId);
    if (!resource?.secure_url) {
      res.status(404).json({ error: "History file not found." });
      return;
    }

    const response = await fetch(resource.secure_url);
    if (!response.ok) {
      res.status(502).json({ error: "Failed to fetch history file payload." });
      return;
    }

    try {
      const payload = (await response.json()) as JsonValue;
      res.status(200).json({
        publicId,
        createdAt: resource.created_at ?? null,
        payload
      });
    } catch {
      res.status(500).json({ error: "History file payload is not valid JSON." });
    }
  }
);

export const addSnapshotSyncRoutes = (app: Express): void => {
  app.use(router);
};
