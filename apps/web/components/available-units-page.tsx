"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Main } from "@/components/ui/main";
import { Select } from "@/components/ui/select";
import { centsToCurrency } from "@/lib/format";
import {
  getPublicAvailableListings,
  type PublicPropertyListing
} from "@/lib/property-listings-api";

export function AvailableUnitsPage() {
  const [q, setQ] = useState("");
  const [minBeds, setMinBeds] = useState("0");
  const [maxRent, setMaxRent] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [listings, setListings] = useState<PublicPropertyListing[]>([]);

  useEffect(() => {
    setIsLoading(true);
    setError(undefined);
    void getPublicAvailableListings({
      q: q.trim() || undefined,
      minBeds: Number(minBeds) > 0 ? Number(minBeds) : undefined,
      maxRentCents: Number(maxRent) > 0 ? Math.round(Number(maxRent) * 100) : undefined
    })
      .then((result) => setListings(result))
      .catch((loadError) => {
        setError(loadError instanceof Error ? loadError.message : "Failed to load available units.");
      })
      .finally(() => setIsLoading(false));
  }, [q, minBeds, maxRent]);

  return (
    <Main
      eyebrow="COLONUS"
      title="Available Units"
      description="Browse currently available and offered rental units."
    >

      <section id="available-units-filters-card" className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-2 md:grid-cols-3">
          <Input
            value={q}
            onChange={(event) => setQ(event.target.value)}
            placeholder="Search by area, name, headline"
          />
          <Select value={minBeds} onChange={(event) => setMinBeds(event.target.value)}>
            <option value="0">Any beds</option>
            <option value="1">1+ beds</option>
            <option value="2">2+ beds</option>
            <option value="3">3+ beds</option>
            <option value="4">4+ beds</option>
          </Select>
          <Input
            type="number"
            min={0}
            step="0.01"
            value={maxRent}
            onChange={(event) => setMaxRent(event.target.value)}
            placeholder="Max monthly rent"
          />
        </div>
      </section>

      {error && (
        <section id="available-units-error-card" className="mt-4 rounded-2xl border border-slate-300 bg-slate-50 p-4 shadow-sm">
          <p className="text-xs text-slate-700">{error}</p>
        </section>
      )}

      <section id="available-units-list-card" className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        {isLoading && <p className="text-sm text-slate-600">Loading available units...</p>}
        {!isLoading && listings.length === 0 && (
          <EmptyState
            title="No Available Units"
            message="No properties match your filters right now."
          />
        )}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {listings.map((listing) => (
            <article key={listing.id} className="overflow-hidden rounded border border-slate-200 bg-white">
              {listing.photos?.[0]?.secureUrl ? (
                <img
                  src={listing.photos[0].secureUrl}
                  alt={listing.headline}
                  className="h-44 w-full object-cover"
                />
              ) : (
                <div className="h-44 w-full bg-slate-100" />
              )}
              <div className="p-3">
                <p className="text-sm font-semibold text-slate-900">{listing.headline}</p>
                <p className="mt-1 text-xs text-slate-600">{listing.address || listing.propertyName}</p>
                <p className="mt-2 text-sm text-slate-700">
                  {centsToCurrency(listing.monthlyRentCents)} / month
                </p>
                <p className="text-xs text-slate-600">
                  {listing.bedrooms} beds · {listing.bathrooms} baths · {listing.areaSqm} sqm
                </p>
                <Link
                  href={`/available-units/${listing.slug}`}
                  className="mt-3 inline-flex rounded border border-slate-300 px-3 py-1.5 text-xs text-slate-700 hover:border-slate-500"
                >
                  View Unit
                </Link>
              </div>
            </article>
          ))}
        </div>
      </section>
    </Main>
  );
}
