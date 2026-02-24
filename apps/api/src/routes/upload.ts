import express, { type Express, type Request, type Response } from "express";
import multer from "multer";
import { PrismaClient } from "@prisma/client";
import { uploadToCloudinary } from "../cloudinary";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 15 * 1024 * 1024
  }
});

const prisma = new PrismaClient();
const prismaDb = prisma as any;
const allowedCategories = new Set([
  "receipts",
  "service-payments",
  "care-proof",
  "refund-requests",
  "tickets",
  "services",
  "condition"
]);

const requireUploadAuth = process.env.REQUIRE_UPLOAD_AUTH === "1";

const sanitizeSegment = (value: string): string =>
  value
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .replace(/_+/g, "_");

const fileNameWithoutExtension = (name: string): string => {
  const cleaned = name.trim();
  const dotIndex = cleaned.lastIndexOf(".");
  if (dotIndex <= 0) return cleaned;
  return cleaned.slice(0, dotIndex);
};

export const addUploadRoutes = (app: Express): void => {
  app.options("/api/upload", (_req: Request, res: Response) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.status(204).end();
  });

  app.post(
    "/api/upload",
    upload.single("file"),
    async (req: Request, res: Response): Promise<void> => {
      res.setHeader("Access-Control-Allow-Origin", "*");
      const landlordId = typeof req.body.landlordId === "string" ? req.body.landlordId : "";
      const propertyId = typeof req.body.propertyId === "string" ? req.body.propertyId : "";
      const category = typeof req.body.category === "string" ? req.body.category : "";

      if (!req.file) {
        res.status(400).json({ error: 'Missing file. Use multipart/form-data with field "file".' });
        return;
      }

      if (!landlordId || !propertyId || !category) {
        res.status(400).json({
          error: "Missing landlordId, propertyId, or category."
        });
        return;
      }
      if (!allowedCategories.has(category)) {
        res.status(400).json({
          error: `Unsupported category. Allowed: ${Array.from(allowedCategories).join(", ")}`
        });
        return;
      }

      const actorFromHeaderId = req.header("x-colonus-user-id");
      const actorFromHeader =
        actorFromHeaderId
          ? await prismaDb.user.findUnique({ where: { id: actorFromHeaderId } })
          : null;

      if (requireUploadAuth && !actorFromHeader) {
        res.status(401).json({
          error:
            "Unauthorized upload. Provide header x-colonus-user-id with a valid User id."
        });
        return;
      }

      const folder = `colonus/${sanitizeSegment(landlordId)}/${sanitizeSegment(propertyId)}/${sanitizeSegment(category)}`;

      try {
        const uploaded = await uploadToCloudinary({
          buffer: req.file.buffer,
          folder,
          filename: sanitizeSegment(fileNameWithoutExtension(req.file.originalname))
        });

        const [landlordActor, property] = await Promise.all([
          prismaDb.user.findUnique({ where: { id: landlordId } }),
          prismaDb.property.findUnique({ where: { id: propertyId } })
        ]);
        const syncActor = actorFromHeader ?? landlordActor;

        await prismaDb.uploadedAsset.create({
          data: {
            category,
            secureUrl: uploaded.secure_url,
            publicId: uploaded.public_id,
            bytes: req.file.size,
            format: req.file.mimetype.split("/")[1] || undefined,
            resourceType: req.file.mimetype.split("/")[0] || undefined,
            landlord: landlordActor ? { connect: { id: landlordActor.id } } : undefined,
            property: property ? { connect: { id: property.id } } : undefined
          }
        });

        await prismaDb.syncEvent.create({
          data: {
            kind: "upload_asset",
            status: "ok",
            clientSessionId:
              typeof req.body.clientSessionId === "string" ? req.body.clientSessionId : undefined,
            clientStorageVersion:
              typeof req.body.clientStorageVersion === "string"
                ? req.body.clientStorageVersion
                : undefined,
            counts: { assets: 1, bytes: req.file.size },
            actor: syncActor ? { connect: { id: syncActor.id } } : undefined,
            property: property ? { connect: { id: property.id } } : undefined
          }
        });

        res.status(200).json({
          secureUrl: uploaded.secure_url,
          publicId: uploaded.public_id
        });
      } catch (error) {
        console.error("Upload failed", error);
        try {
          const [actor, property] = await Promise.all([
            prismaDb.user.findUnique({ where: { id: landlordId } }),
            prismaDb.property.findUnique({ where: { id: propertyId } })
          ]);
          await prismaDb.syncEvent.create({
            data: {
              kind: "upload_asset",
              status: "error",
              errorMessage: error instanceof Error ? error.message : "Upload failed.",
              clientSessionId:
                typeof req.body.clientSessionId === "string" ? req.body.clientSessionId : undefined,
              clientStorageVersion:
                typeof req.body.clientStorageVersion === "string"
                  ? req.body.clientStorageVersion
                  : undefined,
              counts: { assets: 1 },
              actor: actor ? { connect: { id: actor.id } } : undefined,
              property: property ? { connect: { id: property.id } } : undefined
            }
          });
        } catch (syncLogError) {
          console.error("SyncEvent logging failed", syncLogError);
        }
        res.status(500).json({ error: "Upload failed." });
      }
    }
  );

  app.post(
    "/api/sync/backup",
    express.json(),
    async (req: Request, res: Response): Promise<void> => {
      res.setHeader("Access-Control-Allow-Origin", "*");
      const actorId = typeof req.body.actorId === "string" ? req.body.actorId : undefined;
      const propertyId =
        typeof req.body.propertyId === "string" ? req.body.propertyId : undefined;
      const clientSessionId =
        typeof req.body.clientSessionId === "string" ? req.body.clientSessionId : undefined;
      const clientStorageVersion =
        typeof req.body.clientStorageVersion === "string"
          ? req.body.clientStorageVersion
          : undefined;
      const counts = req.body.counts ?? { backups: 1 };

      try {
        const [actor, property] = await Promise.all([
          actorId ? prismaDb.user.findUnique({ where: { id: actorId } }) : null,
          propertyId ? prismaDb.property.findUnique({ where: { id: propertyId } }) : null
        ]);

        const event = await prismaDb.syncEvent.create({
          data: {
            kind: "backup_db",
            status: "ok",
            clientSessionId,
            clientStorageVersion,
            counts,
            actor: actor ? { connect: { id: actor.id } } : undefined,
            property: property ? { connect: { id: property.id } } : undefined
          }
        });

        res.status(200).json({ ok: true, syncEventId: event.id });
      } catch (error) {
        console.error("Backup sync log failed", error);
        try {
          await prismaDb.syncEvent.create({
            data: {
              kind: "backup_db",
              status: "error",
              errorMessage:
                error instanceof Error ? error.message : "Backup sync log failed.",
              clientSessionId,
              clientStorageVersion,
              counts
            }
          });
        } catch {
          // Ignore nested logging failure.
        }
        res.status(500).json({ error: "Backup sync log failed." });
      }
    }
  );
};
