"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Main } from "@/components/ui/main";
import { Textarea } from "@/components/ui/textarea";
import { centsToCurrency } from "@/lib/format";
import {
  getPublicListingBySlug,
  requestRentForListing,
  type PublicPropertyListing
} from "@/lib/property-listings-api";

interface AvailableUnitDetailPageProps {
  listingSlug: string;
}

const REQUESTED_UNITS_STORAGE_KEY = "COLONUS_REQUESTED_UNITS";

export function AvailableUnitDetailPage({ listingSlug }: AvailableUnitDetailPageProps) {
  const [listing, setListing] = useState<PublicPropertyListing>();
  const [relatedListings, setRelatedListings] = useState<PublicPropertyListing[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string>();
  const [submitError, setSubmitError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [hasRequested, setHasRequested] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [lightboxIndex, setLightboxIndex] = useState<number>();

  useEffect(() => {
    setIsLoading(true);
    setError(undefined);
    void getPublicListingBySlug(listingSlug)
      .then((result) => {
        setListing(result.listing);
        setRelatedListings(result.relatedListings);
      })
      .catch((loadError) => {
        setError(loadError instanceof Error ? loadError.message : "Failed to load listing.");
      })
      .finally(() => setIsLoading(false));
  }, [listingSlug]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(REQUESTED_UNITS_STORAGE_KEY);
      const parsed = raw ? (JSON.parse(raw) as unknown) : [];
      const requested = Array.isArray(parsed) ? parsed : [];
      setHasRequested(requested.includes(listingSlug));
    } catch {
      setHasRequested(false);
    }
  }, [listingSlug]);

  const galleryPhotos = useMemo(() => listing?.photos ?? [], [listing?.photos]);
  const heroPhoto = useMemo(() => galleryPhotos[0]?.secureUrl, [galleryPhotos]);
  const hasLightbox = typeof lightboxIndex === "number" && galleryPhotos.length > 0;

  useEffect(() => {
    if (!hasLightbox) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setLightboxIndex(undefined);
        return;
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        setLightboxIndex((current) => {
          if (typeof current !== "number") return current;
          return (current - 1 + galleryPhotos.length) % galleryPhotos.length;
        });
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        setLightboxIndex((current) => {
          if (typeof current !== "number") return current;
          return (current + 1) % galleryPhotos.length;
        });
      }
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [galleryPhotos.length, hasLightbox]);

  return (
    <Main
      eyebrow="COLONUS"
      title="Available Unit"
      description="Public listing detail and rent request form."
    >

      <nav id="available-unit-detail-breadcrumb" aria-label="Breadcrumb" className="mt-3 text-xs text-slate-500">
        <p className="flex flex-wrap items-center gap-2">
          <Link href="/" className="hover:text-slate-700">
            Home
          </Link>
          <span>/</span>
          <Link href="/available-units" className="hover:text-slate-700">
            Available Units
          </Link>
          <span>/</span>
          <span className="text-slate-700">{listing?.headline ?? listingSlug}</span>
        </p>
      </nav>

      {isLoading && (
        <section id="available-unit-detail-loading-card" className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-600">Loading listing details...</p>
        </section>
      )}

      {error && (
        <section id="available-unit-detail-error-card" className="mt-4 rounded-2xl border border-slate-300 bg-slate-50 p-4 shadow-sm">
          <p className="text-xs text-slate-700">{error}</p>
          <Link
            href="/available-units"
            className="mt-3 inline-flex rounded border border-slate-300 px-3 py-1.5 text-xs text-slate-700 hover:border-slate-500"
          >
            Back To Listings
          </Link>
        </section>
      )}

      {!isLoading && !error && listing && (
        <div className="mt-4 grid gap-4 lg:grid-cols-[1.35fr_1fr]">
          <section id="available-unit-detail-info-card" className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
              {heroPhoto ? (
                <button type="button" className="block w-full" onClick={() => setLightboxIndex(0)}>
                  <img src={heroPhoto} alt={listing.headline} className="h-72 w-full object-cover md:h-96" />
                </button>
              ) : (
                <div className="h-72 md:h-96" />
              )}
            </div>

            {galleryPhotos.length > 1 && (
              <div className="mt-3 grid grid-cols-3 gap-2 md:grid-cols-4">
                {galleryPhotos.slice(1).map((photo, index) => (
                  <div key={`${photo.secureUrl}-${index}`} className="overflow-hidden rounded border border-slate-200 bg-slate-100">
                    <button
                      type="button"
                      className="block w-full"
                      onClick={() => setLightboxIndex(index + 1)}
                    >
                      <img
                        src={photo.secureUrl}
                        alt={`${listing.headline} photo ${index + 2}`}
                        className="h-20 w-full object-cover md:h-24"
                      />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <h2 className="mt-4 text-2xl font-semibold text-slate-900">{listing.headline}</h2>
            <p className="mt-1 text-sm text-slate-600">{listing.address || listing.propertyName}</p>
            <p className="mt-3 text-xl font-semibold text-slate-900">
              {centsToCurrency(listing.monthlyRentCents)} / month
            </p>
            <p className="mt-1 text-sm text-slate-600">
              {listing.bedrooms} beds · {listing.bathrooms} baths · {listing.areaSqm} sqm
            </p>
            <p className="mt-3 text-sm text-slate-700">{listing.description || "No description provided."}</p>
          </section>

          {!hasRequested ? (
            <section id="available-unit-detail-request-card" className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">Request This Unit</h2>
              <p className="mt-1 text-xs text-slate-600">
                Send your contact details. The landlord will review your request.
              </p>

              {notice && (
                <div className="mt-3 rounded border border-slate-300 bg-slate-50 p-2">
                  <p className="text-xs text-slate-700">{notice}</p>
                </div>
              )}
              {submitError && (
                <div className="mt-3 rounded border border-slate-300 bg-slate-50 p-2">
                  <p className="text-xs text-slate-700">{submitError}</p>
                </div>
              )}

              <form
                className="mt-3 space-y-2"
                onSubmit={async (event) => {
                  event.preventDefault();
                  setSubmitError(undefined);
                  setNotice(undefined);
                  setIsSubmitting(true);
                  try {
                    await requestRentForListing({
                      listingSlug,
                      name,
                      email,
                      phone: phone.trim() || undefined,
                      message: message.trim() || undefined
                    });
                    const raw = window.localStorage.getItem(REQUESTED_UNITS_STORAGE_KEY);
                    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
                    const requested = Array.isArray(parsed) ? parsed : [];
                    const nextRequested = Array.from(new Set([...requested, listingSlug]));
                    window.localStorage.setItem(
                      REQUESTED_UNITS_STORAGE_KEY,
                      JSON.stringify(nextRequested)
                    );
                    setNotice("Request sent successfully.");
                    setHasRequested(true);
                    setName("");
                    setEmail("");
                    setPhone("");
                    setMessage("");
                  } catch (requestError) {
                    setSubmitError(
                      requestError instanceof Error ? requestError.message : "Failed to submit request."
                    );
                  } finally {
                    setIsSubmitting(false);
                  }
                }}
              >
                <Input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Your full name"
                  required
                />
                <Input
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  type="email"
                  placeholder="Email"
                  required
                />
                <Input
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  placeholder="Phone (optional)"
                />
                <Textarea
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  placeholder="Message (optional)"
                  rows={4}
                />
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded bg-slate-900 px-3 py-2 text-sm text-white disabled:opacity-60"
                >
                  {isSubmitting ? "Sending..." : "Send Request"}
                </button>
              </form>
            </section>
          ) : (
            <section id="available-unit-detail-related-card" className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="rounded-xl border border-slate-300 bg-slate-50 p-4 md:p-5">
                <h2 className="text-base font-semibold text-slate-900 md:text-lg">Request Sent</h2>
                <p className="mt-2 text-sm leading-6 text-slate-700">
                  We received your request. Explore similar units while you wait.
                </p>
              </div>
              <h3 className="mt-4 text-xs font-semibold uppercase tracking-wide text-slate-600">
                Related Units
              </h3>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {relatedListings.map((relatedListing) => (
                  <article
                    key={relatedListing.id}
                    className="overflow-hidden rounded border border-slate-200 bg-white"
                  >
                    {relatedListing.photos?.[0]?.secureUrl ? (
                      <img
                        src={relatedListing.photos[0].secureUrl}
                        alt={relatedListing.headline}
                        className="h-28 w-full object-cover"
                      />
                    ) : (
                      <div className="h-28 w-full bg-slate-100" />
                    )}
                    <div className="p-2">
                      <p className="text-xs font-semibold text-slate-900">{relatedListing.headline}</p>
                      <p className="mt-1 text-[11px] text-slate-600">
                        {centsToCurrency(relatedListing.monthlyRentCents)} / month
                      </p>
                      <Link
                        href={`/available-units/${relatedListing.slug}`}
                        className="mt-2 inline-flex rounded border border-slate-300 px-2 py-1 text-[11px] text-slate-700 hover:border-slate-500"
                      >
                        View Unit
                      </Link>
                    </div>
                  </article>
                ))}
              </div>
              {relatedListings.length === 0 && (
                <p className="mt-3 text-xs text-slate-500">No related units found right now.</p>
              )}
            </section>
          )}
        </div>
      )}
      {hasLightbox && typeof lightboxIndex === "number" && (
        <div
          id="available-unit-detail-lightbox-overlay"
          className="fixed inset-0 z-[90] flex h-[100dvh] w-[100dvw] items-center justify-center bg-slate-950/80 p-4"
          onClick={() => setLightboxIndex(undefined)}
        >
          <div
            id="available-unit-detail-lightbox-frame"
            className="relative flex h-[100dvh] w-[100dvw] items-center justify-center"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setLightboxIndex(undefined)}
              className="absolute right-2 top-2 z-10 rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-800 hover:border-slate-500"
            >
              Close
            </button>
            <button
              type="button"
              aria-label="Previous image"
              onClick={() =>
                setLightboxIndex((current) =>
                  typeof current === "number"
                    ? (current - 1 + galleryPhotos.length) % galleryPhotos.length
                    : current
                )
              }
              className="absolute left-2 top-1/2 z-10 -translate-y-1/2 rounded-full border border-slate-300 bg-white px-3 py-2 text-lg text-slate-800 hover:border-slate-500"
            >
              ‹
            </button>
            <img
              src={galleryPhotos[lightboxIndex]?.secureUrl}
              alt={`${listing?.headline ?? "Listing"} image ${lightboxIndex + 1}`}
              className="max-h-[90dvh] max-w-[92dvw] rounded border border-slate-300 bg-white object-contain"
            />
            <button
              type="button"
              aria-label="Next image"
              onClick={() =>
                setLightboxIndex((current) =>
                  typeof current === "number" ? (current + 1) % galleryPhotos.length : current
                )
              }
              className="absolute right-2 top-1/2 z-10 -translate-y-1/2 rounded-full border border-slate-300 bg-white px-3 py-2 text-lg text-slate-800 hover:border-slate-500"
            >
              ›
            </button>
          </div>
        </div>
      )}
    </Main>
  );
}
