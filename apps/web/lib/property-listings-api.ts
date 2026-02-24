const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

export interface ListingPhoto {
  secureUrl: string;
  publicId?: string;
}

export interface PublicPropertyListing {
  id: string;
  landlordId?: string;
  sourcePropertyId: string;
  slug: string;
  propertyName: string;
  address?: string;
  unitCode?: string;
  headline: string;
  description?: string;
  monthlyRentCents: number;
  currency: string;
  bedrooms: number;
  bathrooms: number;
  areaSqm: number;
  isAvailable: boolean;
  isOffered: boolean;
  photos?: ListingPhoto[];
  createdAt: string;
  updatedAt: string;
}

export interface PublicPropertyListingDetailResponse {
  listing: PublicPropertyListing;
  relatedListings: PublicPropertyListing[];
}

export interface RentalInquiryRecord {
  id: string;
  listingId?: string;
  landlordId?: string;
  requesterName: string;
  requesterEmail: string;
  requesterPhone?: string;
  message?: string;
  status: "new" | "contacted" | "closed";
  createdAt: string;
  updatedAt: string;
  listing?: {
    id: string;
    slug: string;
    propertyName: string;
    headline: string;
  };
}

const normalizeListingPhoto = (value: unknown): ListingPhoto | undefined => {
  if (!value || typeof value !== "object") return undefined;
  const secureUrl = (value as { secureUrl?: unknown }).secureUrl;
  if (typeof secureUrl !== "string" || secureUrl.trim().length === 0) return undefined;
  const publicId = (value as { publicId?: unknown }).publicId;
  return {
    secureUrl,
    publicId: typeof publicId === "string" && publicId.trim().length > 0 ? publicId : undefined
  };
};

const normalizeListingPhotos = (value: unknown): ListingPhoto[] => {
  let raw: unknown = value;
  if (typeof raw === "string") {
    try {
      raw = JSON.parse(raw);
    } catch {
      return [];
    }
  }

  if (Array.isArray(raw)) {
    return raw.map(normalizeListingPhoto).filter((item): item is ListingPhoto => Boolean(item));
  }

  if (raw && typeof raw === "object") {
    const maybeSingle = normalizeListingPhoto(raw);
    if (maybeSingle) return [maybeSingle];
    return Object.values(raw)
      .map(normalizeListingPhoto)
      .filter((item): item is ListingPhoto => Boolean(item));
  }

  return [];
};

const normalizeListing = (value: PublicPropertyListing): PublicPropertyListing => ({
  ...value,
  photos: normalizeListingPhotos(value.photos)
});

const ensureOk = async (response: Response, fallback: string): Promise<void> => {
  if (response.ok) return;
  let message = fallback;
  try {
    const body = (await response.json()) as { error?: string };
    if (body.error) message = body.error;
  } catch {
    // ignore parse error
  }
  throw new Error(message);
};

export const getLandlordListings = async (
  landlordId: string
): Promise<PublicPropertyListing[]> => {
  const response = await fetch(`${API_BASE_URL}/api/listings/landlord/${encodeURIComponent(landlordId)}`);
  await ensureOk(response, "Failed to load landlord listings.");
  const body = (await response.json()) as { listings?: PublicPropertyListing[] };
  return Array.isArray(body.listings) ? body.listings.map(normalizeListing) : [];
};

export const getLandlordInquiries = async (
  landlordId: string
): Promise<RentalInquiryRecord[]> => {
  const response = await fetch(
    `${API_BASE_URL}/api/listings/landlord/${encodeURIComponent(landlordId)}/inquiries`
  );
  await ensureOk(response, "Failed to load rental inquiries.");
  const body = (await response.json()) as { inquiries?: RentalInquiryRecord[] };
  return Array.isArray(body.inquiries) ? body.inquiries : [];
};

export const upsertListingForProperty = async (input: {
  sourcePropertyId: string;
  landlordId: string;
  slug?: string;
  propertyName: string;
  address?: string;
  unitCode?: string;
  headline: string;
  description?: string;
  monthlyRentCents: number;
  currency: string;
  bedrooms: number;
  bathrooms: number;
  areaSqm: number;
  isAvailable: boolean;
  isOffered: boolean;
  photos: ListingPhoto[];
}): Promise<PublicPropertyListing> => {
  const response = await fetch(
    `${API_BASE_URL}/api/listings/property/${encodeURIComponent(input.sourcePropertyId)}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input)
    }
  );
  await ensureOk(response, "Failed to save listing.");
  const body = (await response.json()) as { listing: PublicPropertyListing };
  return normalizeListing(body.listing);
};

export const getPublicAvailableListings = async (filters?: {
  q?: string;
  minRentCents?: number;
  maxRentCents?: number;
  minBeds?: number;
}): Promise<PublicPropertyListing[]> => {
  const url = new URL(`${API_BASE_URL}/api/public/listings`);
  if (filters?.q) url.searchParams.set("q", filters.q);
  if (filters?.minRentCents && filters.minRentCents > 0) {
    url.searchParams.set("minRentCents", String(filters.minRentCents));
  }
  if (filters?.maxRentCents && filters.maxRentCents > 0) {
    url.searchParams.set("maxRentCents", String(filters.maxRentCents));
  }
  if (filters?.minBeds && filters.minBeds > 0) {
    url.searchParams.set("minBeds", String(filters.minBeds));
  }
  const response = await fetch(url.toString());
  await ensureOk(response, "Failed to load public listings.");
  const body = (await response.json()) as { listings?: PublicPropertyListing[] };
  return Array.isArray(body.listings) ? body.listings.map(normalizeListing) : [];
};

export const getPublicListingBySlug = async (
  listingSlug: string
): Promise<PublicPropertyListingDetailResponse> => {
  const response = await fetch(
    `${API_BASE_URL}/api/public/listings/${encodeURIComponent(listingSlug)}`
  );
  await ensureOk(response, "Failed to load listing details.");
  const body = (await response.json()) as {
    listing: PublicPropertyListing;
    relatedListings?: PublicPropertyListing[];
  };
  return {
    listing: normalizeListing(body.listing),
    relatedListings: Array.isArray(body.relatedListings)
      ? body.relatedListings.map(normalizeListing)
      : []
  };
};

export const requestRentForListing = async (input: {
  listingSlug: string;
  name: string;
  email: string;
  phone?: string;
  message?: string;
}): Promise<void> => {
  const response = await fetch(
    `${API_BASE_URL}/api/public/listings/${encodeURIComponent(input.listingSlug)}/request-rent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: input.name,
        email: input.email,
        phone: input.phone,
        message: input.message
      })
    }
  );
  await ensureOk(response, "Failed to submit rental inquiry.");
};
