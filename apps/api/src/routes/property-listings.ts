import express, { type Express, type Request, type Response } from "express";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const prismaDb = prisma as any;
const router = express.Router();
const handleRouteError = (res: Response, error: unknown, context: string): void => {
  console.error(`[property-listings] ${context}`, error);
  if (!res.headersSent) {
    res.status(500).json({ error: "Internal server error." });
  }
};

const toSafeSegment = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const toSlugBase = (input: {
  headline?: string;
  propertyName?: string;
  address?: string;
}): string => {
  const joined = [input.headline, input.propertyName, input.address]
    .filter((item) => typeof item === "string" && item.trim().length > 0)
    .join("-");
  return toSafeSegment(joined || "listing");
};

const normalizeText = (value: unknown): string => (typeof value === "string" ? value.trim() : "");
const normalizeInt = (value: unknown, fallback = 0): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, Math.round(parsed));
};
const normalizeBool = (value: unknown, fallback = false): boolean => {
  if (value === true || value === "true" || value === 1 || value === "1") return true;
  if (value === false || value === "false" || value === 0 || value === "0") return false;
  return fallback;
};

const normalizePhotos = (value: unknown): Array<{ secureUrl: string; publicId?: string }> => {
  if (!Array.isArray(value)) return [];
  return value.reduce<Array<{ secureUrl: string; publicId?: string }>>((acc, item) => {
    if (!item || typeof item !== "object") return acc;
    const secureUrl = normalizeText((item as { secureUrl?: unknown }).secureUrl);
    if (!secureUrl) return acc;
    const publicId = normalizeText((item as { publicId?: unknown }).publicId);
    acc.push({ secureUrl, publicId: publicId || undefined });
    return acc;
  }, []);
};

const getMailerConfig = (): {
  token?: string;
  senderEmail?: string;
  recipientEmail?: string;
} => {
  const token =
    normalizeText(process.env.MAILERSEND_EMAIL_TOKEN) ||
    normalizeText(process.env.MAILSENDER_EMAIL_TOKEN) ||
    undefined;
  const senderDomain =
    normalizeText(process.env.MAILERSEND_EMAIL_DOMAIN) ||
    normalizeText(process.env.MAILSENDER_EMAIL_DOMAIN) ||
    undefined;
  const recipientEmail = normalizeText(process.env.COLONUS_EMAIL) || undefined;
  const senderEmail = senderDomain
    ? senderDomain.includes("@")
      ? senderDomain
      : `noreply@${senderDomain}`
    : undefined;
  return { token, senderEmail, recipientEmail };
};

const sendRentRequestEmail = async (input: {
  listingSlug: string;
  inquiryId: string;
  requesterName: string;
  requesterEmail: string;
  requesterPhone?: string;
  message?: string;
}): Promise<boolean> => {
  const { token, senderEmail, recipientEmail } = getMailerConfig();
  if (!token || !senderEmail || !recipientEmail) {
    console.warn(
      "[MAILERSEND] Missing config. Required: MAILSENDER_EMAIL_TOKEN, MAILSENDER_EMAIL_DOMAIN, COLONUS_EMAIL."
    );
    return false;
  }

  const subject = `New rent request: ${input.listingSlug}`;
  const textLines = [
    `A new rent request was submitted.`,
    ``,
    `Inquiry ID: ${input.inquiryId}`,
    `Listing slug: ${input.listingSlug}`,
    `Name: ${input.requesterName}`,
    `Email: ${input.requesterEmail}`,
    `Phone: ${input.requesterPhone || "-"}`,
    `Message: ${input.message || "-"}`
  ];
  const text = textLines.join("\n");
  const html = `<p>A new rent request was submitted.</p>
<p><strong>Inquiry ID:</strong> ${input.inquiryId}</p>
<p><strong>Listing slug:</strong> ${input.listingSlug}</p>
<p><strong>Name:</strong> ${input.requesterName}</p>
<p><strong>Email:</strong> ${input.requesterEmail}</p>
<p><strong>Phone:</strong> ${input.requesterPhone || "-"}</p>
<p><strong>Message:</strong> ${input.message || "-"}</p>`;

  try {
    const response = await fetch("https://api.mailersend.com/v1/email", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: { email: senderEmail, name: "COLONUS" },
        to: [{ email: recipientEmail }],
        reply_to: { email: input.requesterEmail, name: input.requesterName },
        subject,
        text,
        html
      })
    });
    if (!response.ok) {
      const body = await response.text();
      console.error("[MAILERSEND] Request failed:", response.status, body);
      return false;
    }
    return true;
  } catch (error) {
    console.error("[MAILERSEND] Request error:", error);
    return false;
  }
};

const ensureUniqueSlug = async (input: {
  requestedSlug: string;
  excludeId?: string;
}): Promise<string> => {
  const base = toSafeSegment(input.requestedSlug) || "listing";
  let attempt = 0;
  while (attempt < 50) {
    const slug = attempt === 0 ? base : `${base}-${attempt + 1}`;
    const conflict = await prismaDb.publicPropertyListing.findFirst({
      where: {
        slug,
        ...(input.excludeId ? { id: { not: input.excludeId } } : {})
      },
      select: { id: true }
    });
    if (!conflict) return slug;
    attempt += 1;
  }
  return `${base}-${Math.random().toString(36).slice(2, 6)}`;
};

router.get("/api/listings/landlord/:landlordId", async (req: Request, res: Response): Promise<void> => {
  const landlordId = normalizeText(req.params.landlordId);
  if (!landlordId) {
    res.status(400).json({ error: "Missing landlordId." });
    return;
  }
  const listings = await prismaDb.publicPropertyListing.findMany({
    where: { landlordId },
    orderBy: { updatedAt: "desc" }
  });
  res.status(200).json({ listings });
});

router.get(
  "/api/listings/landlord/:landlordId/inquiries",
  async (req: Request, res: Response): Promise<void> => {
    const landlordId = normalizeText(req.params.landlordId);
    if (!landlordId) {
      res.status(400).json({ error: "Missing landlordId." });
      return;
    }
    const inquiries = await prismaDb.rentalInquiry.findMany({
      where: { landlordId },
      include: {
        listing: {
          select: { id: true, slug: true, propertyName: true, headline: true }
        }
      },
      orderBy: { createdAt: "desc" }
    });
    res.status(200).json({ inquiries });
  }
);

router.put(
  "/api/listings/property/:sourcePropertyId",
  express.json(),
  async (req: Request, res: Response): Promise<void> => {
    const sourcePropertyId = normalizeText(req.params.sourcePropertyId);
    const landlordId = normalizeText(req.body?.landlordId);
    if (!sourcePropertyId || !landlordId) {
      res.status(400).json({ error: "Missing sourcePropertyId or landlordId." });
      return;
    }

    const landlord = await prismaDb.user.findUnique({
      where: { id: landlordId },
      select: { id: true, role: true }
    });
    if (!landlord || landlord.role !== "landlord") {
      res.status(404).json({ error: "Landlord not found." });
      return;
    }

    const propertyName = normalizeText(req.body?.propertyName);
    const address = normalizeText(req.body?.address);
    const unitCode = normalizeText(req.body?.unitCode);
    const headline = normalizeText(req.body?.headline);
    const description = normalizeText(req.body?.description);
    const monthlyRentCents = normalizeInt(req.body?.monthlyRentCents, 0);
    const currency = normalizeText(req.body?.currency) || "USD";
    const bedrooms = normalizeInt(req.body?.bedrooms, 0);
    const bathrooms = normalizeInt(req.body?.bathrooms, 0);
    const areaSqm = normalizeInt(req.body?.areaSqm, 0);
    const isAvailable = normalizeBool(req.body?.isAvailable, false);
    const isOffered = normalizeBool(req.body?.isOffered, false);
    const photos = normalizePhotos(req.body?.photos);
    const requestedSlug = normalizeText(req.body?.slug);

    const existing = await prismaDb.publicPropertyListing.findUnique({
      where: { sourcePropertyId }
    });
    const derivedSlugBase =
      requestedSlug ||
      toSlugBase({
        headline,
        propertyName,
        address
      });
    const slug = await ensureUniqueSlug({
      requestedSlug: derivedSlugBase,
      excludeId: existing?.id
    });

    const safeHeadline = headline || propertyName || "Property listing";
    const safePropertyName = propertyName || "Property";

    const listing = existing
      ? await prismaDb.publicPropertyListing.update({
          where: { id: existing.id },
          data: {
            landlord: { connect: { id: landlordId } },
            slug,
            propertyName: safePropertyName,
            address: address || undefined,
            unitCode: unitCode || undefined,
            headline: safeHeadline,
            description: description || undefined,
            monthlyRentCents,
            currency,
            bedrooms,
            bathrooms,
            areaSqm,
            isAvailable,
            isOffered,
            photos
          }
        })
      : await prismaDb.publicPropertyListing.create({
          data: {
            landlord: { connect: { id: landlordId } },
            sourcePropertyId,
            slug,
            propertyName: safePropertyName,
            address: address || undefined,
            unitCode: unitCode || undefined,
            headline: safeHeadline,
            description: description || undefined,
            monthlyRentCents,
            currency,
            bedrooms,
            bathrooms,
            areaSqm,
            isAvailable,
            isOffered,
            photos
          }
        });

    res.status(200).json({ listing });
  }
);

router.get(
  "/api/public/listings",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const q = normalizeText(req.query.q);
      const minRentCents = normalizeInt(req.query.minRentCents, 0);
      const maxRentCents = normalizeInt(req.query.maxRentCents, 0);
      const minBeds = normalizeInt(req.query.minBeds, 0);

      const listings = await prismaDb.publicPropertyListing.findMany({
        where: {
          isAvailable: true,
          isOffered: true,
          ...(minRentCents > 0 ? { monthlyRentCents: { gte: minRentCents } } : {}),
          ...(maxRentCents > 0 ? { monthlyRentCents: { lte: maxRentCents } } : {}),
          ...(minBeds > 0 ? { bedrooms: { gte: minBeds } } : {}),
          ...(q
            ? {
                OR: [
                  { propertyName: { contains: q } },
                  { address: { contains: q } },
                  { headline: { contains: q } },
                  { description: { contains: q } }
                ]
              }
            : {})
        },
        orderBy: { updatedAt: "desc" }
      });

      res.status(200).json({ listings });
    } catch (error) {
      handleRouteError(res, error, "GET /api/public/listings");
    }
  }
);

router.get(
  "/api/public/listings/:listingSlug",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const listingSlug = normalizeText(req.params.listingSlug);
      if (!listingSlug) {
        res.status(400).json({ error: "Missing listingSlug." });
        return;
      }
      const listing = await prismaDb.publicPropertyListing.findUnique({
        where: { slug: listingSlug }
      });
      if (!listing || !listing.isAvailable || !listing.isOffered) {
        res.status(404).json({ error: "Listing not found." });
        return;
      }
      const orConditions: Array<Record<string, unknown>> = [];
      if (listing.landlordId) {
        orConditions.push({ landlordId: listing.landlordId });
      }
      if (Number.isFinite(listing.bedrooms) && listing.bedrooms > 0) {
        orConditions.push({ bedrooms: listing.bedrooms });
      }
      if (Number.isFinite(listing.monthlyRentCents) && listing.monthlyRentCents > 0) {
        const delta = Math.max(25000, Math.round(listing.monthlyRentCents * 0.2));
        orConditions.push({
          monthlyRentCents: {
            gte: Math.max(0, listing.monthlyRentCents - delta),
            lte: listing.monthlyRentCents + delta
          }
        });
      }
      const relatedListings = await prismaDb.publicPropertyListing.findMany({
        where: {
          id: { not: listing.id },
          isAvailable: true,
          isOffered: true,
          ...(orConditions.length > 0 ? { OR: orConditions } : {})
        },
        orderBy: { updatedAt: "desc" },
        take: 6
      });

      res.status(200).json({ listing, relatedListings });
    } catch (error) {
      handleRouteError(res, error, "GET /api/public/listings/:listingSlug");
    }
  }
);

router.post(
  "/api/public/listings/:listingSlug/request-rent",
  express.json(),
  async (req: Request, res: Response): Promise<void> => {
    const listingSlug = normalizeText(req.params.listingSlug);
    const requesterName = normalizeText(req.body?.name);
    const requesterEmail = normalizeText(req.body?.email);
    const requesterPhone = normalizeText(req.body?.phone);
    const message = normalizeText(req.body?.message);

    if (!listingSlug || !requesterName || !requesterEmail) {
      res.status(400).json({ error: "Missing listingSlug, name, or email." });
      return;
    }

    const listing = await prismaDb.publicPropertyListing.findUnique({
      where: { slug: listingSlug },
      select: { id: true, landlordId: true, isAvailable: true, isOffered: true }
    });
    if (!listing || !listing.isAvailable || !listing.isOffered) {
      res.status(404).json({ error: "Listing not found." });
      return;
    }

    const inquiry = await prismaDb.rentalInquiry.create({
      data: {
        listing: { connect: { id: listing.id } },
        landlord: listing.landlordId ? { connect: { id: listing.landlordId } } : undefined,
        requesterName,
        requesterEmail,
        requesterPhone: requesterPhone || undefined,
        message: message || undefined,
        status: "new"
      }
    });

    const emailSent = await sendRentRequestEmail({
      listingSlug,
      inquiryId: inquiry.id,
      requesterName,
      requesterEmail,
      requesterPhone: requesterPhone || undefined,
      message: message || undefined
    });

    res.status(201).json({ inquiryId: inquiry.id, emailSent });
  }
);

export const addPropertyListingRoutes = (app: Express): void => {
  app.use(router);
};
