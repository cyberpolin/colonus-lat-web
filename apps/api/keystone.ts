import "dotenv/config";
import { config } from "@keystone-6/core";
import type { Request, Response, NextFunction } from "express";
import { addAuthRoutes } from "./src/routes/auth";
import { addPropertyListingRoutes } from "./src/routes/property-listings";
import { addSyncPolicyRoutes } from "./src/routes/sync-policy";
import { addSnapshotSyncRoutes } from "./src/routes/snapshot-sync";
import { addUploadRoutes } from "./src/routes/upload";
import { lists } from "./src/schema";
import { ensureInitialSeed } from "./src/seed";

const port = Number(process.env.PORT ?? process.env.API_PORT ?? 4000);
const isDevMode = process.env.NODE_ENV === "development";
const fallbackDatabaseUrl = "postgresql://postgres:postgres@127.0.0.1:5432/postgres?sslmode=disable";
const databaseUrl = process.env.DATABASE_URL ?? (isDevMode ? fallbackDatabaseUrl : undefined);
const allowedWebOrigins = (
  process.env.WEB_ORIGINS ??
  process.env.WEB_ORIGIN ??
  "http://localhost:3000"
)
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required when NODE_ENV is not development.");
}

export default config({
  db: {
    provider: "postgresql",
    url: databaseUrl,
    onConnect: async (context) => {
      if (!isDevMode) return;
      await ensureInitialSeed(context as unknown as Parameters<typeof ensureInitialSeed>[0]);
    }
  },
  lists,
  server: {
    port,
    extendExpressApp: (app) => {
      app.use((req: Request, res: Response, next: NextFunction) => {
        const origin = req.headers.origin;
        if (!origin) {
          res.header("Access-Control-Allow-Origin", allowedWebOrigins[0] ?? "http://localhost:3000");
        } else if (allowedWebOrigins.includes(origin)) {
          res.header("Access-Control-Allow-Origin", origin);
        }
        res.header("Vary", "Origin");
        res.header("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
        res.header(
          "Access-Control-Allow-Headers",
          "Content-Type, Authorization, X-Requested-With"
        );
        if (req.method === "OPTIONS") {
          if (origin && !allowedWebOrigins.includes(origin)) {
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
