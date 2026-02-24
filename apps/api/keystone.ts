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
const webOrigin = process.env.WEB_ORIGIN ?? "http://localhost:3000";
const databaseUrl =
  process.env.DATABASE_URL ??
  "postgresql://<user>:<password>@<host>:5432/<database>?sslmode=require";

export default config({
  db: {
    provider: "postgresql",
    url: databaseUrl,
    onConnect: async (context) => {
      await ensureInitialSeed(context as unknown as Parameters<typeof ensureInitialSeed>[0]);
    }
  },
  lists,
  server: {
    port,
    extendExpressApp: (app) => {
      app.use((req: Request, res: Response, next: NextFunction) => {
        res.header("Access-Control-Allow-Origin", webOrigin);
        res.header("Vary", "Origin");
        res.header("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
        res.header(
          "Access-Control-Allow-Headers",
          "Content-Type, Authorization, X-Requested-With"
        );
        if (req.method === "OPTIONS") {
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
