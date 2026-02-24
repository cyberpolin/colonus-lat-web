import express, { type Express, type Request, type Response } from "express";
import { PrismaClient } from "@prisma/client";

type SyncPolicyRole = "super_admin" | "landlord" | "tenant";
type SyncPolicyMode = "after_change" | "interval" | "hybrid";

const prisma = new PrismaClient();
const prismaDb = prisma as any;
const router = express.Router();
const handleRouteError = (res: Response, error: unknown, context: string): void => {
  console.error(`[sync-policy] ${context}`, error);
  if (!res.headersSent) {
    res.status(500).json({ error: "Internal server error." });
  }
};

const jsonHeaders = (res: Response): void => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-colonus-user-id");
};

const normalizeRole = (value: unknown): SyncPolicyRole | undefined => {
  if (value === "super_admin" || value === "landlord" || value === "tenant") return value;
  return undefined;
};

const normalizeMode = (value: unknown): SyncPolicyMode | undefined => {
  if (value === "after_change" || value === "interval" || value === "hybrid") return value;
  return undefined;
};

const normalizeInt = (value: unknown, fallback: number, min = 0, max = 86400): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.round(parsed)));
};

const normalizeBool = (value: unknown, fallback: boolean): boolean => {
  if (value === true || value === "true" || value === 1 || value === "1") return true;
  if (value === false || value === "false" || value === 0 || value === "0") return false;
  return fallback;
};

const requireSuperAdmin = async (req: Request, res: Response): Promise<string | undefined> => {
  const actorId = typeof req.header("x-colonus-user-id") === "string" ? req.header("x-colonus-user-id") : "";
  if (!actorId) {
    res.status(401).json({ error: "Missing x-colonus-user-id header." });
    return undefined;
  }
  const actor = await prismaDb.user.findUnique({ where: { id: actorId } });
  if (!actor || actor.role !== "superAdmin") {
    res.status(403).json({ error: "Super admin access required." });
    return undefined;
  }
  return actor.id as string;
};

router.options("/api/sync/policy", (_req: Request, res: Response) => {
  jsonHeaders(res);
  res.status(204).end();
});
router.options("/api/sync/policy/:role", (_req: Request, res: Response) => {
  jsonHeaders(res);
  res.status(204).end();
});

router.get("/api/sync/policy", async (_req: Request, res: Response): Promise<void> => {
  jsonHeaders(res);
  try {
    const policies = await prismaDb.syncPolicy.findMany({
      orderBy: { role: "asc" }
    });
    res.status(200).json({ policies });
  } catch (error) {
    handleRouteError(res, error, "GET /api/sync/policy");
  }
});

router.get("/api/sync/policy/:role", async (req: Request, res: Response): Promise<void> => {
  jsonHeaders(res);
  try {
    const role = normalizeRole(req.params.role);
    if (!role) {
      res.status(400).json({ error: "Invalid role." });
      return;
    }
    const policy = await prismaDb.syncPolicy.findUnique({ where: { role } });
    if (!policy) {
      res.status(404).json({ error: "Policy not found." });
      return;
    }
    res.status(200).json({ policy });
  } catch (error) {
    handleRouteError(res, error, "GET /api/sync/policy/:role");
  }
});

router.post("/api/sync/policy/:role", express.json(), async (req: Request, res: Response): Promise<void> => {
  jsonHeaders(res);
  const actorId = await requireSuperAdmin(req, res);
  if (!actorId) return;

  const role = normalizeRole(req.params.role);
  if (!role) {
    res.status(400).json({ error: "Invalid role." });
    return;
  }

  const existing = await prismaDb.syncPolicy.findUnique({ where: { role } });
  const mode = normalizeMode(req.body?.mode) ?? existing?.mode ?? "after_change";
  const enabled = normalizeBool(req.body?.enabled, existing?.enabled ?? true);
  const delayAfterChangeSeconds = normalizeInt(
    req.body?.delayAfterChangeSeconds,
    existing?.delayAfterChangeSeconds ?? 60
  );
  const intervalSeconds = normalizeInt(req.body?.intervalSeconds, existing?.intervalSeconds ?? 300);
  const retryBackoffSeconds = normalizeInt(
    req.body?.retryBackoffSeconds,
    existing?.retryBackoffSeconds ?? 60
  );
  const maxRetryBackoffSeconds = normalizeInt(
    req.body?.maxRetryBackoffSeconds,
    existing?.maxRetryBackoffSeconds ?? 300
  );
  const maxJitterSeconds = normalizeInt(req.body?.maxJitterSeconds, existing?.maxJitterSeconds ?? 0);
  const initialHydrationOnLogin = normalizeBool(
    req.body?.initialHydrationOnLogin,
    existing?.initialHydrationOnLogin ?? true
  );
  const forceSyncOnLogin = normalizeBool(req.body?.forceSyncOnLogin, existing?.forceSyncOnLogin ?? false);
  const devShowCountdown = normalizeBool(req.body?.devShowCountdown, existing?.devShowCountdown ?? true);

  const policy = existing
    ? await prismaDb.syncPolicy.update({
        where: { role },
        data: {
          enabled,
          mode,
          delayAfterChangeSeconds,
          intervalSeconds,
          retryBackoffSeconds,
          maxRetryBackoffSeconds,
          maxJitterSeconds,
          initialHydrationOnLogin,
          forceSyncOnLogin,
          devShowCountdown,
          updatedByUser: { connect: { id: actorId } }
        }
      })
    : await prismaDb.syncPolicy.create({
        data: {
          role,
          enabled,
          mode,
          delayAfterChangeSeconds,
          intervalSeconds,
          retryBackoffSeconds,
          maxRetryBackoffSeconds,
          maxJitterSeconds,
          initialHydrationOnLogin,
          forceSyncOnLogin,
          devShowCountdown,
          updatedByUser: { connect: { id: actorId } }
        }
      });

  res.status(200).json({ policy });
});

export const addSyncPolicyRoutes = (app: Express): void => {
  app.use(router);
};
