"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ImageDropInput } from "@/components/image-drop-input";
import { MainMenu } from "@/components/main-menu";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Main } from "@/components/ui/main";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { centsToCurrency } from "@/lib/format";
import {
  getLandlordInquiries,
  getLandlordListings,
  type ListingPhoto,
  type PublicPropertyListing,
  type RentalInquiryRecord,
  upsertListingForProperty
} from "@/lib/property-listings-api";
import { useColonusStore } from "@/lib/store";
import { uploadMediaToApi } from "@/lib/upload";
import type { MediaUploadStub } from "@colonus/shared";

interface ListingDraft {
  slug: string;
  headline: string;
  description: string;
  monthlyRent: string;
  currency: string;
  bedrooms: string;
  bathrooms: string;
  areaSqm: string;
  isAvailable: boolean;
  isOffered: boolean;
}

const toListingDraft = (input: {
  listing?: PublicPropertyListing;
  propertyName: string;
  monthlyRentCents: number;
}): ListingDraft => ({
  slug: input.listing?.slug ?? "",
  headline: input.listing?.headline ?? input.propertyName,
  description: input.listing?.description ?? "",
  monthlyRent: String(
    Math.round(
      ((input.listing?.monthlyRentCents ?? input.monthlyRentCents) / 100) * 100
    ) / 100
  ),
  currency: input.listing?.currency ?? "USD",
  bedrooms: String(input.listing?.bedrooms ?? 0),
  bathrooms: String(input.listing?.bathrooms ?? 0),
  areaSqm: String(input.listing?.areaSqm ?? 0),
  isAvailable: input.listing?.isAvailable ?? false,
  isOffered: input.listing?.isOffered ?? false
});

const toMediaStubs = (photos?: ListingPhoto[]): MediaUploadStub[] =>
  (photos ?? []).map((photo, index) => ({
    fileName: `listing-photo-${index + 1}.jpg`,
    mimeType: "image/jpeg",
    byteSize: 0,
    localObjectUrl: photo.secureUrl,
    keystoneFileId: photo.publicId
  }));

const toNumber = (value: string, fallback = 0): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export function LandlordListingsPage() {
  const state = useColonusStore();
  const impersonationRole = useColonusStore((store) => store.impersonationRole);
  const activeLandlordId = state.activeLandlordId ?? state.landlords[0]?.id;
  const activeLandlord = state.landlords.find((landlord) => landlord.id === activeLandlordId);
  const properties = state.properties.filter((property) => property.landlordId === activeLandlordId);
  const isLocked = impersonationRole !== "landlord";

  const [listings, setListings] = useState<PublicPropertyListing[]>([]);
  const [inquiries, setInquiries] = useState<RentalInquiryRecord[]>([]);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>();
  const [draft, setDraft] = useState<ListingDraft>({
    slug: "",
    headline: "",
    description: "",
    monthlyRent: "0",
    currency: "USD",
    bedrooms: "0",
    bathrooms: "0",
    areaSqm: "0",
    isAvailable: false,
    isOffered: false
  });
  const [photoStubs, setPhotoStubs] = useState<MediaUploadStub[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();

  const activeLandlordKsId = activeLandlord?.keystoneUserId;
  const listingsByPropertyId = useMemo(
    () =>
      new Map<string, PublicPropertyListing>(
        listings.map((listing) => [listing.sourcePropertyId, listing])
      ),
    [listings]
  );
  const selectedProperty =
    properties.find((property) => property.id === selectedPropertyId) ?? properties[0];
  const selectedListing = selectedProperty
    ? listingsByPropertyId.get(selectedProperty.id)
    : undefined;

  useEffect(() => {
    if (!selectedProperty && properties.length > 0) {
      setSelectedPropertyId(properties[0].id);
    }
  }, [properties, selectedProperty]);

  useEffect(() => {
    if (!selectedProperty) return;
    setDraft(
      toListingDraft({
        listing: selectedListing,
        propertyName: selectedProperty.name,
        monthlyRentCents: selectedProperty.monthlyRentCents
      })
    );
    setPhotoStubs(toMediaStubs(selectedListing?.photos));
  }, [selectedProperty?.id, selectedListing?.id]);

  useEffect(() => {
    if (!activeLandlordKsId) return;
    setIsLoading(true);
    setError(undefined);
    void Promise.all([
      getLandlordListings(activeLandlordKsId),
      getLandlordInquiries(activeLandlordKsId)
    ])
      .then(([listingsResult, inquiriesResult]) => {
        setListings(listingsResult);
        setInquiries(inquiriesResult);
      })
      .catch((loadError) => {
        setError(loadError instanceof Error ? loadError.message : "Failed to load listings.");
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [activeLandlordKsId]);

  if (isLocked) {
    return (
      <Main
        eyebrow="Landlord"
        title="Property Listings"
        description="Select landlord from role selector before opening this route."
        maxWidthClassName="max-w-2xl"      >
        <MainMenu visible role="landlord" />
        <section
          id="landlord-listings-route-locked-card"
          className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
        >
          <h1 className="text-2xl font-semibold text-slate-900">Landlord Listings Locked</h1>
          <p className="mt-2 text-slate-600">
            Select landlord from the pretend-user selector before opening this route.
          </p>
          <Link
            href="/"
            className="mt-4 inline-flex rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:border-slate-500"
          >
            Go To Role Selector
          </Link>
        </section>
      </Main>
    );
  }

  return (
    <Main
      eyebrow="Landlord"
      title="Property Listings"
      description="Manage public property information, availability, offers, and photos."    >
      <MainMenu visible role="landlord" />
      <nav id="landlord-listings-breadcrumb" aria-label="Breadcrumb" className="text-xs text-slate-500">
        <p className="flex flex-wrap items-center gap-2">
          <Link href="/" className="hover:text-slate-700">
            Home
          </Link>
          <span>/</span>
          <Link href="/landlord" className="hover:text-slate-700">
            Landlord
          </Link>
          <span>/</span>
          <span className="text-slate-700">Listings</span>
        </p>
      </nav>

      {error && (
        <section
          id="landlord-listings-error-card"
          className="mt-4 rounded-2xl border border-slate-300 bg-slate-50 p-4 shadow-sm"
        >
          <p className="text-xs text-slate-700">{error}</p>
        </section>
      )}
      {notice && (
        <section
          id="landlord-listings-notice-card"
          className="mt-4 rounded-2xl border border-slate-300 bg-slate-50 p-4 shadow-sm"
        >
          <p className="text-xs text-slate-700">{notice}</p>
        </section>
      )}

      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_1.3fr]">
        <section id="landlord-listings-properties-card" className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">My Properties</h2>
          <div className="mt-3 space-y-2">
            {properties.map((property) => {
              const listing = listingsByPropertyId.get(property.id);
              return (
                <button
                  key={property.id}
                  type="button"
                  onClick={() => setSelectedPropertyId(property.id)}
                  className={`w-full rounded border p-3 text-left text-sm ${
                    selectedProperty?.id === property.id
                      ? "border-slate-700 bg-slate-50"
                      : "border-slate-200 hover:border-slate-400"
                  }`}
                >
                  <p className="font-medium text-slate-900">{property.name}</p>
                  <p className="text-xs text-slate-600">{property.address}</p>
                  <p className="text-xs text-slate-600">
                    {listing?.isAvailable ? "Available" : "Unavailable"} ·{" "}
                    {listing?.isOffered ? "Offered publicly" : "Not offered"}
                  </p>
                </button>
              );
            })}
            {properties.length === 0 && (
              <EmptyState
                title="No Properties"
                message="Add a property first to create a public listing."
              />
            )}
          </div>
        </section>

        <section id="landlord-listings-editor-card" className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          {!selectedProperty && (
            <EmptyState
              title="No Property Selected"
              message="Pick a property to edit its public listing information."
            />
          )}

          {selectedProperty && (
            <form
              className="space-y-3"
              onSubmit={async (event) => {
                event.preventDefault();
                if (!activeLandlordKsId) {
                  setError("Missing landlord Keystone user id.");
                  return;
                }
                setError(undefined);
                setNotice(undefined);
                setIsSaving(true);
                try {
                  const uploadedPhotos: ListingPhoto[] = [];
                  for (const photo of photoStubs) {
                    if (photo.localObjectUrl.startsWith("blob:")) {
                      const uploaded = await uploadMediaToApi({
                        proof: photo,
                        landlordId: activeLandlordKsId,
                        propertyId: selectedProperty.id,
                        category: "listing-photos"
                      });
                      uploadedPhotos.push({
                        secureUrl: uploaded.secureUrl,
                        publicId: uploaded.publicId
                      });
                    } else {
                      uploadedPhotos.push({
                        secureUrl: photo.localObjectUrl,
                        publicId: photo.keystoneFileId
                      });
                    }
                  }

                  const listing = await upsertListingForProperty({
                    sourcePropertyId: selectedProperty.id,
                    landlordId: activeLandlordKsId,
                    slug: draft.slug,
                    propertyName: selectedProperty.name,
                    address: selectedProperty.address,
                    unitCode: selectedProperty.unitCode,
                    headline: draft.headline,
                    description: draft.description,
                    monthlyRentCents: Math.round(toNumber(draft.monthlyRent, 0) * 100),
                    currency: draft.currency || "USD",
                    bedrooms: toNumber(draft.bedrooms, 0),
                    bathrooms: toNumber(draft.bathrooms, 0),
                    areaSqm: toNumber(draft.areaSqm, 0),
                    isAvailable: draft.isAvailable,
                    isOffered: draft.isOffered,
                    photos: uploadedPhotos
                  });

                  setListings((current) => {
                    const next = current.filter((item) => item.id !== listing.id);
                    return [listing, ...next];
                  });
                  setDraft((current) => ({ ...current, slug: listing.slug }));
                  setPhotoStubs(toMediaStubs(listing.photos));
                  setNotice("Listing saved.");
                } catch (saveError) {
                  setError(saveError instanceof Error ? saveError.message : "Failed to save listing.");
                } finally {
                  setIsSaving(false);
                }
              }}
            >
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">
                Edit Listing: {selectedProperty.name}
              </h2>
              {isLoading && (
                <p className="text-xs text-slate-500">Loading current listing data...</p>
              )}
              <Input
                value={draft.slug}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, slug: event.target.value }))
                }
                placeholder="listing-slug"
              />
              <Input
                value={draft.headline}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, headline: event.target.value }))
                }
                placeholder="Headline"
                required
              />
              <Textarea
                value={draft.description}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, description: event.target.value }))
                }
                placeholder="Property description"
              />
              <div className="grid gap-2 md:grid-cols-2">
                <Input
                  type="number"
                  value={draft.monthlyRent}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, monthlyRent: event.target.value }))
                  }
                  placeholder="Monthly rent"
                />
                <Input
                  value={draft.currency}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, currency: event.target.value.toUpperCase() }))
                  }
                  placeholder="Currency"
                />
                <Input
                  type="number"
                  value={draft.bedrooms}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, bedrooms: event.target.value }))
                  }
                  placeholder="Bedrooms"
                />
                <Input
                  type="number"
                  value={draft.bathrooms}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, bathrooms: event.target.value }))
                  }
                  placeholder="Bathrooms"
                />
                <Input
                  type="number"
                  value={draft.areaSqm}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, areaSqm: event.target.value }))
                  }
                  placeholder="Area (sqm)"
                />
                <Select
                  value={draft.isAvailable ? "yes" : "no"}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, isAvailable: event.target.value === "yes" }))
                  }
                >
                  <option value="yes">Available</option>
                  <option value="no">Not available</option>
                </Select>
                <Select
                  value={draft.isOffered ? "yes" : "no"}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, isOffered: event.target.value === "yes" }))
                  }
                >
                  <option value="yes">Offered publicly</option>
                  <option value="no">Not offered</option>
                </Select>
              </div>

              <ImageDropInput
                label="Property Photos"
                multiple
                values={photoStubs}
                onChange={() => undefined}
                onChangeMany={setPhotoStubs}
              />

              <button
                type="submit"
                disabled={isSaving || !activeLandlordKsId}
                className="rounded bg-slate-900 px-3 py-2 text-sm text-white disabled:opacity-60"
              >
                {isSaving ? "Saving..." : "Save Listing"}
              </button>
            </form>
          )}
        </section>
      </div>

      <section
        id="landlord-listings-preview-card"
        className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
      >
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">Listing Preview</h2>
        {!selectedProperty && (
          <EmptyState title="No Preview" message="Select a property to see listing preview." />
        )}
        {selectedProperty && (
          <article className="mt-3 rounded border border-slate-200 p-3">
            <p className="text-lg font-semibold text-slate-900">{draft.headline || selectedProperty.name}</p>
            <p className="text-sm text-slate-600">{selectedProperty.address}</p>
            <p className="mt-2 text-sm text-slate-700">{draft.description || "No description yet."}</p>
            <p className="mt-2 text-sm text-slate-700">
              {centsToCurrency(Math.round(toNumber(draft.monthlyRent, 0) * 100))} / month · {toNumber(draft.bedrooms, 0)} beds ·{" "}
              {toNumber(draft.bathrooms, 0)} baths · {toNumber(draft.areaSqm, 0)} sqm
            </p>
            <p className="mt-1 text-xs text-slate-600">
              {draft.isAvailable ? "Available" : "Unavailable"} ·{" "}
              {draft.isOffered ? "Visible in available-units" : "Hidden from public list"}
            </p>
          </article>
        )}
      </section>

      <section
        id="landlord-listings-inquiries-card"
        className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
      >
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">Rent Requests</h2>
        <div className="mt-3 space-y-2">
          {inquiries.length === 0 && (
            <EmptyState
              title="No Requests Yet"
              message="Potential tenant requests will appear here."
            />
          )}
          {inquiries.map((inquiry) => (
            <article key={inquiry.id} className="rounded border border-slate-200 p-3 text-sm">
              <p className="font-medium text-slate-900">
                {inquiry.requesterName} ({inquiry.requesterEmail})
              </p>
              <p className="text-xs text-slate-600">
                Listing: {inquiry.listing?.headline ?? inquiry.listing?.propertyName ?? "Unknown"} · Status: {inquiry.status}
              </p>
              {inquiry.requesterPhone && (
                <p className="text-xs text-slate-600">Phone: {inquiry.requesterPhone}</p>
              )}
              {inquiry.message && <p className="mt-1 text-xs text-slate-700">{inquiry.message}</p>}
            </article>
          ))}
        </div>
      </section>
    </Main>
  );
}
