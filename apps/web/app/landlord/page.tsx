import { RoleRoute } from "@/components/role-route";

export default async function LandlordPage({
  searchParams
}: {
  searchParams: Promise<{ firstTime?: string }>;
}) {
  const { firstTime } = await searchParams;
  return <RoleRoute role="landlord" label="Landlord" firstTime={firstTime === "1"} />;
}
