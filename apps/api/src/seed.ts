import { readdirSync } from "node:fs";
import { join } from "node:path";

interface KeystoneDbContext {
  sudo: () => {
    db: {
      User: {
        count: () => Promise<number>;
        findMany: (args?: { query?: string }) => Promise<Array<{ id: string; email?: string; role?: string }>>;
        createOne: (args: { data: Record<string, unknown> }) => Promise<{ id: string }>;
      };
      Property: {
        createOne: (args: { data: Record<string, unknown> }) => Promise<{ id: string }>;
      };
      Membership: {
        createOne: (args: { data: Record<string, unknown> }) => Promise<{ id: string }>;
      };
      PropertySubscription: {
        createOne: (args: { data: Record<string, unknown> }) => Promise<{ id: string }>;
      };
      PublicPropertyListing: {
        findMany: (args?: {
          query?: string;
        }) => Promise<Array<{ id: string; slug?: string; sourcePropertyId?: string; photos?: unknown }>>;
        createOne: (args: { data: Record<string, unknown> }) => Promise<{ id: string }>;
        updateOne: (args: {
          where: { id: string };
          data: Record<string, unknown>;
        }) => Promise<{ id: string }>;
      };
      SyncPolicy: {
        count: () => Promise<number>;
        findMany: (args?: { query?: string }) => Promise<Array<{ id: string; role?: string }>>;
        createOne: (args: { data: Record<string, unknown> }) => Promise<{ id: string }>;
        updateOne: (args: {
          where: { id: string };
          data: Record<string, unknown>;
        }) => Promise<{ id: string }>;
      };
    };
  };
}

const SEEDED_LISTING_SLUGS = [
  "seed-property-100-seed-street",
  "seed-property-102-seed-street",
  "seed-property-108-seed-street"
] as const;
const BULK_AVAILABLE_UNITS_TARGET = 500;
const BULK_LISTING_SLUG_PREFIX = "seed-unit-";

const toSafePublicId = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

const getDemoImageUrls = (): string[] => {
  const webOrigin = process.env.WEB_ORIGIN ?? "http://localhost:3000";
  const demoDir = join(process.cwd(), "..", "web", "public", "demo");
  try {
    const files = readdirSync(demoDir, { withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name)
      .sort();
    return files.map((fileName) => `${webOrigin}/demo/${encodeURIComponent(fileName)}`);
  } catch {
    return [
      "https://picsum.photos/seed/seed-public-listing-fallback-1/1280/720",
      "https://picsum.photos/seed/seed-public-listing-fallback-2/1280/720",
      "https://picsum.photos/seed/seed-public-listing-fallback-3/1280/720",
      "https://picsum.photos/seed/seed-public-listing-fallback-4/1280/720"
    ];
  }
};

const seededPhotosForListing = (
  imageUrls: string[],
  listingIndex: number
): Array<{ secureUrl: string; publicId: string }> => {
  const desiredCount = Math.max(4, Math.min(6, imageUrls.length));
  const selected: string[] = [];
  const used = new Set<number>();
  let state = (listingIndex + 1) * 7919;
  while (selected.length < desiredCount) {
    state = (state * 1103515245 + 12345) % 2147483647;
    const pickIndex = Math.abs(state) % imageUrls.length;
    if (used.has(pickIndex) && used.size < imageUrls.length) continue;
    used.add(pickIndex);
    selected.push(imageUrls[pickIndex]);
  }
  return selected.map((secureUrl, photoIndex) => ({
    secureUrl,
    publicId: `seed_public_listing_${listingIndex + 1}_${photoIndex + 1}_${toSafePublicId(
      decodeURIComponent(secureUrl.split("/").pop() ?? `photo_${photoIndex + 1}`)
    )}`
  }));
};

const pick = <T>(items: T[], index: number): T => items[index % items.length] as T;

const toBulkListingPayload = (input: {
  landlordId: string;
  index: number;
  imageUrls: string[];
}): Record<string, unknown> => {
  const { landlordId, index, imageUrls } = input;
  const unitNo = index + 1;
  const slug = `${BULK_LISTING_SLUG_PREFIX}${String(unitNo).padStart(4, "0")}`;
  const areaNames = [
    "North District",
    "Downtown",
    "Garden Quarter",
    "River Walk",
    "Old Town",
    "University Zone"
  ];
  const streets = ["Maple", "Oak", "Cedar", "Pine", "Willow", "Lake", "Hill", "Park"];
  const propertyName = `${pick(areaNames, index)} Residences ${unitNo}`;
  const address = `${100 + (unitNo % 900)} ${pick(streets, unitNo)} Street`;
  const bedrooms = 1 + (unitNo % 4);
  const bathrooms = 1 + (unitNo % 3);
  const areaSqm = 38 + (unitNo % 90);
  const monthlyRentCents = 85000 + (unitNo % 180) * 1250;

  return {
    landlord: { connect: { id: landlordId } },
    sourcePropertyId: `seed_public_source_${String(unitNo).padStart(4, "0")}`,
    slug,
    propertyName,
    address,
    unitCode: `U-${String(unitNo).padStart(4, "0")}`,
    headline: `${bedrooms}BR ${pick(["Loft", "Apartment", "Unit", "Suite"], unitNo)} in ${pick(areaNames, unitNo)}`,
    description: `Demo listing ${unitNo}. Spacious layout with practical amenities for day-to-day living.`,
    monthlyRentCents,
    currency: "USD",
    bedrooms,
    bathrooms,
    areaSqm,
    isAvailable: true,
    isOffered: true,
    photos: seededPhotosForListing(imageUrls, index + 1000)
  };
};

const hasUsablePhotos = (value: unknown): boolean => {
  if (!Array.isArray(value) || value.length === 0) return false;
  return value.some((item) => {
    if (!item || typeof item !== "object") return false;
    const secureUrl = (item as { secureUrl?: unknown }).secureUrl;
    return typeof secureUrl === "string" && secureUrl.trim().length > 0;
  });
};

export const ensureInitialSeed = async (context: KeystoneDbContext): Promise<void> => {
  const sudoContext = context.sudo();
  const demoImageUrls = getDemoImageUrls();
  const upsertSyncPolicyByRole = async (data: Record<string, unknown>): Promise<void> => {
    const role = typeof data.role === "string" ? data.role : "";
    if (!role) return;
    const existing = await sudoContext.db.SyncPolicy.findMany({ query: "id role" });
    const current = existing.find((item) => item.role === role);
    if (current?.id) {
      await sudoContext.db.SyncPolicy.updateOne({
        where: { id: current.id },
        data
      });
      return;
    }
    await sudoContext.db.SyncPolicy.createOne({ data });
  };

  await upsertSyncPolicyByRole({
    role: "super_admin",
    enabled: true,
    mode: "interval",
    delayAfterChangeSeconds: 60,
    intervalSeconds: 10,
    retryBackoffSeconds: 30,
    maxRetryBackoffSeconds: 180,
    maxJitterSeconds: 0,
    initialHydrationOnLogin: true,
    forceSyncOnLogin: false,
    devShowCountdown: true
  });
  await upsertSyncPolicyByRole({
    role: "landlord",
    enabled: true,
    mode: "after_change",
    delayAfterChangeSeconds: 60,
    intervalSeconds: 300,
    retryBackoffSeconds: 60,
    maxRetryBackoffSeconds: 300,
    maxJitterSeconds: 0,
    initialHydrationOnLogin: true,
    forceSyncOnLogin: false,
    devShowCountdown: true
  });
  await upsertSyncPolicyByRole({
    role: "tenant",
    enabled: true,
    mode: "after_change",
    delayAfterChangeSeconds: 60,
    intervalSeconds: 300,
    retryBackoffSeconds: 60,
    maxRetryBackoffSeconds: 300,
    maxJitterSeconds: 0,
    initialHydrationOnLogin: true,
    forceSyncOnLogin: false,
    devShowCountdown: true
  });

  const refreshSeededListingsMedia = async (): Promise<void> => {
    const existingListings = await sudoContext.db.PublicPropertyListing.findMany({
      query: "id slug photos"
    });
    const targetSlugSet = new Set<string>(SEEDED_LISTING_SLUGS);
    const seededListings = existingListings.filter(
      (item) => typeof item.slug === "string" && targetSlugSet.has(item.slug)
    );
    const listingsNeedingPhotos = existingListings.filter((item) => !hasUsablePhotos(item.photos));

    await Promise.all([
      ...seededListings.map((listing, listingIndex) =>
        sudoContext.db.PublicPropertyListing.updateOne({
          where: { id: listing.id },
          data: {
            isAvailable: true,
            isOffered: true,
            photos: seededPhotosForListing(demoImageUrls, listingIndex)
          }
        })
      ),
      ...listingsNeedingPhotos
        .filter((listing) => !seededListings.some((seeded) => seeded.id === listing.id))
        .map((listing, listingIndex) =>
          sudoContext.db.PublicPropertyListing.updateOne({
            where: { id: listing.id },
            data: { photos: seededPhotosForListing(demoImageUrls, listingIndex + 30) }
          })
        )
    ]);
  };

  await refreshSeededListingsMedia();

  const ensureBulkAvailableUnits = async (): Promise<void> => {
    const users = await sudoContext.db.User.findMany({
      query: "id email role"
    });
    const landlordUser =
      users.find((user) => user.role === "landlord" && user.email?.toLowerCase() === "demo3@colonus.lat") ??
      users.find((user) => user.role === "landlord");
    if (!landlordUser?.id) return;

    const existingListings = await sudoContext.db.PublicPropertyListing.findMany({
      query: "id slug"
    });
    const existingSlugSet = new Set(
      existingListings
        .map((listing) => listing.slug)
        .filter((slug): slug is string => typeof slug === "string")
    );

    const createOps: Promise<{ id: string }>[] = [];
    for (let index = 0; index < BULK_AVAILABLE_UNITS_TARGET; index += 1) {
      const slug = `${BULK_LISTING_SLUG_PREFIX}${String(index + 1).padStart(4, "0")}`;
      if (existingSlugSet.has(slug)) continue;
      createOps.push(
        sudoContext.db.PublicPropertyListing.createOne({
          data: toBulkListingPayload({
            landlordId: landlordUser.id,
            index,
            imageUrls: demoImageUrls
          })
        })
      );
    }

    if (createOps.length > 0) {
      await Promise.all(createOps);
    }
  };

  await ensureBulkAvailableUnits();

  const usersCount = await sudoContext.db.User.count();
  if (usersCount > 0) return;

  const superAdmin = await sudoContext.db.User.createOne({
    data: {
      email: "demo.admin@colonus.lat",
      fullName: "Demo Super Admin",
      password: "demo123",
      mustChangePassword: false,
      onboardingCompleted: true,
      role: "superAdmin",
      status: "active"
    }
  });

  const landlord = await sudoContext.db.User.createOne({
    data: {
      email: "demo3@colonus.lat",
      fullName: "Demo Landlord 3",
      phone: "555-3000-1001",
      password: "demo123",
      mustChangePassword: false,
      onboardingCompleted: true,
      role: "landlord",
      status: "active"
    }
  });

  await sudoContext.db.User.createOne({
    data: {
      email: "demo1@colonus.lat",
      fullName: "Demo Landlord 1",
      phone: "555-3000-1002",
      password: "demo123",
      mustChangePassword: false,
      onboardingCompleted: true,
      role: "landlord",
      status: "active"
    }
  });

  await sudoContext.db.User.createOne({
    data: {
      email: "demo2@colonus.lat",
      fullName: "Demo Landlord 2",
      phone: "555-3000-1003",
      password: "demo123",
      mustChangePassword: false,
      onboardingCompleted: true,
      role: "landlord",
      status: "active"
    }
  });

  const tenant = await sudoContext.db.User.createOne({
    data: {
      email: "tenant.demo3@colonus.lat",
      fullName: "Demo Tenant 3",
      phone: "555-3000-2001",
      password: "demo123",
      mustChangePassword: false,
      onboardingCompleted: true,
      role: "tenant",
      status: "active"
    }
  });

  const seededProperties = await Promise.all([
    sudoContext.db.Property.createOne({
      data: {
        landlord: { connect: { id: landlord.id } },
        name: "Seed Property",
        address: "100 Seed Street",
        unitCode: "A-1"
      }
    }),
    sudoContext.db.Property.createOne({
      data: {
        landlord: { connect: { id: landlord.id } },
        name: "Seed Property North",
        address: "102 Seed Street",
        unitCode: "B-4"
      }
    }),
    sudoContext.db.Property.createOne({
      data: {
        landlord: { connect: { id: landlord.id } },
        name: "Seed Property Garden",
        address: "108 Seed Street",
        unitCode: "C-2"
      }
    })
  ]);

  await Promise.all(
    seededProperties.map((property) =>
      sudoContext.db.Membership.createOne({
        data: {
          user: { connect: { id: landlord.id } },
          property: { connect: { id: property.id } },
          role: "owner",
          status: "active"
        }
      })
    )
  );

  const [propertyA, propertyB, propertyC] = seededProperties;

  await sudoContext.db.Membership.createOne({
    data: {
      user: { connect: { id: tenant.id } },
      property: { connect: { id: propertyA.id } },
      role: "tenant",
      status: "active"
    }
  });

  await Promise.all(
    seededProperties.map((property, index) =>
      sudoContext.db.PropertySubscription.createOne({
        data: {
          property: { connect: { id: property.id } },
          tier: index === 0 ? "free" : "unlimited",
          subscriptionStatus: index === 0 ? "trial" : "active"
        }
      })
    )
  );

  await Promise.all([
    sudoContext.db.PublicPropertyListing.createOne({
      data: {
        landlord: { connect: { id: landlord.id } },
        sourcePropertyId: propertyA.id,
        slug: "seed-property-100-seed-street",
        propertyName: "Seed Property",
        address: "100 Seed Street",
        unitCode: "A-1",
        headline: "Bright 1BR Near Downtown",
        description: "Cozy one-bedroom apartment with natural light and convenient access.",
        monthlyRentCents: 125000,
        currency: "USD",
        bedrooms: 1,
        bathrooms: 1,
        areaSqm: 52,
        isAvailable: true,
        isOffered: true,
        photos: seededPhotosForListing(demoImageUrls, 0)
      }
    }),
    sudoContext.db.PublicPropertyListing.createOne({
      data: {
        landlord: { connect: { id: landlord.id } },
        sourcePropertyId: propertyB.id,
        slug: "seed-property-102-seed-street",
        propertyName: "Seed Property North",
        address: "102 Seed Street",
        unitCode: "B-4",
        headline: "Modern 2BR With Balcony",
        description: "Two-bedroom unit with balcony, updated kitchen, and gated parking.",
        monthlyRentCents: 168000,
        currency: "USD",
        bedrooms: 2,
        bathrooms: 2,
        areaSqm: 84,
        isAvailable: true,
        isOffered: true,
        photos: seededPhotosForListing(demoImageUrls, 1)
      }
    }),
    sudoContext.db.PublicPropertyListing.createOne({
      data: {
        landlord: { connect: { id: landlord.id } },
        sourcePropertyId: propertyC.id,
        slug: "seed-property-108-seed-street",
        propertyName: "Seed Property Garden",
        address: "108 Seed Street",
        unitCode: "C-2",
        headline: "Garden Level Studio",
        description: "Open-plan studio with private patio and storage space.",
        monthlyRentCents: 99000,
        currency: "USD",
        bedrooms: 1,
        bathrooms: 1,
        areaSqm: 43,
        isAvailable: true,
        isOffered: true,
        photos: seededPhotosForListing(demoImageUrls, 2)
      }
    })
  ]);

  void superAdmin;
};

export const ensureProductionSeed = async (context: KeystoneDbContext): Promise<void> => {
  const sudoContext = context.sudo();
  const demoImageUrls = getDemoImageUrls();

  const superAdminEmail = "cyberpolin@gmail.com";
  const listingSlug = "ejemplo-departamento-centro";
  const listingSourcePropertyId = "production_example_public_listing_001";

  const users = await sudoContext.db.User.findMany({ query: "id email role" });
  let superAdminUser = users.find((user) => user.email?.toLowerCase() === superAdminEmail);

  if (!superAdminUser) {
    const created = await sudoContext.db.User.createOne({
      data: {
        email: superAdminEmail,
        fullName: "COLONUS Super Admin",
        password: "changeme",
        mustChangePassword: true,
        onboardingCompleted: true,
        role: "superAdmin",
        status: "active"
      }
    });
    superAdminUser = { id: created.id, email: superAdminEmail, role: "superAdmin" };
  }

  const listings = await sudoContext.db.PublicPropertyListing.findMany({
    query: "id slug sourcePropertyId"
  });
  const existingListing = listings.find(
    (listing) =>
      listing.slug === listingSlug || listing.sourcePropertyId === listingSourcePropertyId
  );
  const listingData: Record<string, unknown> = {
    sourcePropertyId: listingSourcePropertyId,
    slug: listingSlug,
    propertyName: "Departamento Centro",
    address: "Av. Reforma 245, Centro",
    unitCode: "D-302",
    headline: "Departamento Amueblado en el Centro",
    description:
      "Unidad de ejemplo con dos recamaras, balcon y buena iluminacion. Ideal para renta inmediata.",
    monthlyRentCents: 145000,
    currency: "USD",
    bedrooms: 2,
    bathrooms: 2,
    areaSqm: 78,
    isAvailable: true,
    isOffered: true,
    photos: seededPhotosForListing(demoImageUrls, 9001)
  };

  if (existingListing?.id) {
    await sudoContext.db.PublicPropertyListing.updateOne({
      where: { id: existingListing.id },
      data: listingData
    });
    return;
  }

  await sudoContext.db.PublicPropertyListing.createOne({ data: listingData });
};
