import { AvailableUnitDetailPage } from "@/components/available-unit-detail-page";

interface AvailableUnitSlugPageProps {
  params: Promise<{ listingSlug: string }>;
}

export default async function AvailableUnitSlugPage({ params }: AvailableUnitSlugPageProps) {
  const { listingSlug } = await params;
  return <AvailableUnitDetailPage listingSlug={listingSlug} />;
}
