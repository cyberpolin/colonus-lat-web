import { SuperAdminClientDetailsPage } from "@/components/superadmin-client-details-page";

export default async function SuperAdminClientDetailsRoute({
  params
}: {
  params: Promise<{ landlordId: string }>;
}) {
  const { landlordId } = await params;
  return <SuperAdminClientDetailsPage landlordId={landlordId} />;
}
