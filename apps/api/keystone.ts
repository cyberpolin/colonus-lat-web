import "dotenv/config";
import { config } from "@keystone-6/core";
import type { Request, Response, NextFunction } from "express";
import { addAuthRoutes } from "./src/routes/auth";
import { addPropertyListingRoutes } from "./src/routes/property-listings";
import { addSyncPolicyRoutes } from "./src/routes/sync-policy";
import { addSnapshotSyncRoutes } from "./src/routes/snapshot-sync";
import { addUploadRoutes } from "./src/routes/upload";
import { lists } from "./src/schema";
import { ensureInitialSeed, ensureProductionSeed } from "./src/seed";

const port = Number(process.env.PORT ?? process.env.API_PORT ?? 4000);
const isDevMode = process.env.NODE_ENV === "development";
const fallbackDatabaseUrl = "postgresql://postgres:postgres@127.0.0.1:5432/postgres?sslmode=disable";
const databaseUrl = process.env.DATABASE_URL ?? (isDevMode ? fallbackDatabaseUrl : undefined);
const normalizeOrigin = (value: string): string =>
  value.trim().replace(/\/+$/, "").toLowerCase();
const splitOrigins = (value: string): string[] =>
  value
    .split(/[,\n]/g)
    .map((item) => item.trim())
    .filter(Boolean);
const configuredOrigins = [
  ...splitOrigins(process.env.WEB_ORIGINS ?? ""),
  ...splitOrigins(process.env.WEB_ORIGIN ?? "")
];
const allowedWebOrigins =
  configuredOrigins.length > 0 ? configuredOrigins.map(normalizeOrigin) : ["http://localhost:3000"];

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required when NODE_ENV is not development.");
}

export default config({
  db: {
    provider: "postgresql",
    url: databaseUrl,
    onConnect: async (context) => {
      if (isDevMode) {
        await ensureInitialSeed(context as unknown as Parameters<typeof ensureInitialSeed>[0]);
        return;
      }
      try {
        await ensureProductionSeed(context as unknown as Parameters<typeof ensureProductionSeed>[0]);
      } catch (error) {
        console.error("[seed] Production bootstrap seed failed:", error);
      }
    }
  },
  lists,
  server: {
    port,
    extendExpressApp: (app) => {
      app.use((req: Request, res: Response, next: NextFunction) => {
        const origin = req.headers.origin;
        const normalizedOrigin = typeof origin === "string" ? normalizeOrigin(origin) : undefined;
        const allowsAny = allowedWebOrigins.includes("*");
        const isAllowedOrigin =
          typeof normalizedOrigin === "string" &&
          (allowsAny || allowedWebOrigins.includes(normalizedOrigin));

        if (!origin) {
          res.header("Access-Control-Allow-Origin", allowedWebOrigins[0] ?? "http://localhost:3000");
        } else if (isAllowedOrigin) {
          res.header("Access-Control-Allow-Origin", origin);
        }
        res.header("Vary", "Origin");
        res.header("Access-Control-Allow-Credentials", "true");
        res.header("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
        res.header(
          "Access-Control-Allow-Headers",
          "Content-Type, Authorization, X-Requested-With"
        );
        if (req.method === "OPTIONS") {
          if (origin && !isAllowedOrigin) {
            res.status(403).json({ error: "Origin not allowed." });
            return;
          }
          res.status(204).end();
          return;
        }
        next();
      });
      addAuthRoutes(app);
      addPropertyListingRoutes(app);
      addSyncPolicyRoutes(app);
      addSnapshotSyncRoutes(app);
      addUploadRoutes(app);
    }
  }
});
